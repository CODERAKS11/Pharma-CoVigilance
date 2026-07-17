-- 001_init.sql
-- Supabase Postgres Migration for PharmaSafe (Phase 1)

create extension if not exists "uuid-ossp";

-- Ensure auth schema and auth.users dummy table exist for standalone local PostgreSQL run
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique,
  created_at timestamptz default now()
);

-- Core tables
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references tenants(id) not null,
  role text not null check (role in ('reporter','reviewer','admin')),
  full_name text,
  created_at timestamptz default now()
);

create table drugs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id),
  name text not null,
  generic_name text,
  created_at timestamptz default now()
);

create table patients (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) not null,
  age int,
  sex text check (sex in ('male','female','other','unknown')),
  created_at timestamptz default now()
);

create table cases (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) not null,
  patient_id uuid references patients(id) not null,
  drug_id uuid references drugs(id) not null,
  reporter_id uuid references app_users(id),
  reporter_type text check (reporter_type in ('healthcare_professional','patient','caregiver','manufacturer')) not null,
  dosage text,
  onset_date date,
  narrative text not null,
  hospitalization boolean default false,
  life_threatening boolean default false,
  disability boolean default false,
  status text not null default 'intake'
    check (status in ('intake','processing','triaged','needs_review','reviewed','exported','rejected')),
  priority text check (priority in ('low','medium','high','critical')),
  source text default 'faers_seed' check (source in ('faers_seed','manual','api')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table case_events (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid references cases(id) on delete cascade not null,
  actor_type text not null check (actor_type in ('system','ai_pipeline','reporter','reviewer','admin')),
  actor_id uuid references app_users(id),
  action text not null,
  detail jsonb,
  created_at timestamptz default now()
);

-- Indexes
create index idx_cases_tenant_status on cases(tenant_id, status);
create index idx_cases_priority on cases(priority);
create index idx_case_events_case on case_events(case_id);

-- Auto-update updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_cases_updated_at
  before update on cases
  for each row
  execute function update_updated_at_column();

-- Row Level Security (RLS)
alter table tenants enable row level security;
alter table app_users enable row level security;
alter table drugs enable row level security;
alter table patients enable row level security;
alter table cases enable row level security;
alter table case_events enable row level security;

-- Tenants Policies
create policy tenants_authenticated_select on tenants
  for select
  using (auth.role() = 'authenticated');

-- App Users Policies
create policy app_users_authenticated_select on app_users
  for select
  using (auth.role() = 'authenticated');

-- Drugs Policies
create policy drugs_authenticated_select on drugs
  for select
  using (auth.role() = 'authenticated');

create policy drugs_authenticated_insert on drugs
  for insert
  with check (auth.role() = 'authenticated');

-- Patients Policies
create policy patients_reviewer_admin_select on patients
  for select
  using (
    (select role from app_users where id = auth.uid()) in ('reviewer','admin')
  );

create policy patients_reporter_select_own on patients
  for select
  using (
    id in (select patient_id from cases where reporter_id = auth.uid())
  );

create policy patients_reporter_insert on patients
  for insert
  with check (
    (select role from app_users where id = auth.uid()) = 'reporter'
  );

-- Cases Policies
-- Reporters: can insert cases, can only see their own submissions
create policy reporter_insert on cases
  for insert
  with check (auth.uid() = reporter_id);

create policy reporter_select_own on cases
  for select
  using (reporter_id = auth.uid());

-- Reviewers/Admins: can see all cases within their tenant
create policy reviewer_admin_select on cases
  for select
  using (
    tenant_id = (select tenant_id from app_users where id = auth.uid())
    and (select role from app_users where id = auth.uid()) in ('reviewer','admin')
  );

-- Only reviewers/admins may update case status/review fields
create policy reviewer_admin_update on cases
  for update
  using (
    (select role from app_users where id = auth.uid()) in ('reviewer','admin')
  );

-- Case Events Policies
create policy case_events_reviewer_admin_select on case_events
  for select
  using (
    (select role from app_users where id = auth.uid()) in ('reviewer','admin')
    and case_id in (select id from cases where tenant_id = (select tenant_id from app_users where id = auth.uid()))
  );

create policy case_events_reporter_select_own on case_events
  for select
  using (
    case_id in (select id from cases where reporter_id = auth.uid())
  );

create policy case_events_reporter_insert on case_events
  for insert
  with check (
    actor_id = auth.uid()
    and actor_type = 'reporter'
  );

-- Database Transaction RPC for Case Creation
create or replace function create_case_transaction(
  p_patient_age int,
  p_patient_sex text,
  p_drug_name text,
  p_dosage text,
  p_onset_date date,
  p_narrative text,
  p_hospitalization boolean,
  p_life_threatening boolean,
  p_disability boolean,
  p_reporter_type text,
  p_reporter_id uuid
) returns uuid as $$
declare
  v_tenant_id uuid;
  v_drug_id uuid;
  v_patient_id uuid;
  v_case_id uuid;
begin
  -- Resolve caller's tenant_id
  select tenant_id into v_tenant_id from app_users where id = auth.uid();
  if v_tenant_id is null then
    raise exception 'User profile not found or tenant not set';
  end if;

  -- Ensure reporter_id matches auth.uid()
  if p_reporter_id != auth.uid() then
    raise exception 'Reporter ID must match authenticated user';
  end if;

  -- 1. Resolve drug (case-insensitive find or create)
  select id into v_drug_id from drugs where upper(name) = upper(p_drug_name) limit 1;
  if v_drug_id is null then
    insert into drugs (tenant_id, name)
    values (v_tenant_id, upper(p_drug_name))
    returning id into v_drug_id;
  end if;

  -- 2. Insert patient
  insert into patients (tenant_id, age, sex)
  values (v_tenant_id, p_patient_age, p_patient_sex)
  returning id into v_patient_id;

  -- 3. Insert case
  insert into cases (
    tenant_id, patient_id, drug_id, reporter_id, reporter_type,
    dosage, onset_date, narrative, hospitalization, life_threatening,
    disability, status, priority, source
  ) values (
    v_tenant_id, v_patient_id, v_drug_id, p_reporter_id, p_reporter_type,
    p_dosage, p_onset_date, p_narrative, p_hospitalization, p_life_threatening,
    p_disability, 'intake', 'medium', 'manual'
  ) returning id into v_case_id;

  -- 4. Insert case event
  insert into case_events (case_id, actor_type, actor_id, action, detail)
  values (v_case_id, 'reporter', p_reporter_id, 'case_created', jsonb_build_object('source', 'manual'));

  return v_case_id;
end;
$$ language plpgsql security definer;

