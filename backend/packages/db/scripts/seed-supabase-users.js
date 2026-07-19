const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const ws = require('ws');

global.WebSocket = ws;

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

// Create Supabase Admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const TENANT_ID = 'de000000-0000-0000-0000-000000000001';

const MOCK_USERS = [
  {
    id: '55555555-5555-5555-5555-555555555555',
    email: 'reporter@pharmasafe.io',
    password: 'reporter123',
    name: 'Dr. Emily Richards',
    role: 'reporter'
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    email: 'reviewer@pharmasafe.io',
    password: 'reviewer123',
    name: 'Dr. Sarah Chen',
    role: 'reviewer'
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    email: 'admin@pharmasafe.io',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin'
  }
];

async function seed() {
  try {
    console.log('Seeding Supabase on URL:', supabaseUrl);

    // 1. Ensure Tenant exists
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', TENANT_ID);
      
    if (tenantErr) throw tenantErr;

    if (tenant.length === 0) {
      console.log('Inserting tenant...');
      const { error: insertTenantErr } = await supabase
        .from('tenants')
        .insert({ id: TENANT_ID, name: 'PharmaSafe Organization' });
      if (insertTenantErr) throw insertTenantErr;
      console.log('Tenant inserted successfully.');
    } else {
      console.log('Tenant already exists.');
    }

    // 2. Insert Users into Auth and app_users
    for (const u of MOCK_USERS) {
      console.log(`Processing user: ${u.email}`);
      
      // Delete user if already exists in auth to ensure clean start
      const { data: authList, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) throw listErr;
      
      const existingAuth = authList.users.find(x => x.email === u.email);
      let userId = u.id;
      
      if (existingAuth) {
        console.log(`User ${u.email} already exists in auth, deleting for clean seed...`);
        const { error: delErr } = await supabase.auth.admin.deleteUser(existingAuth.id);
        if (delErr) throw delErr;
      }
      
      // Create user in Supabase Auth
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        id: userId,
        email: u.email,
        password: u.password,
        email_confirm: true
      });

      if (createErr) {
        console.error(`Error creating auth user ${u.email}:`, createErr.message);
        throw createErr;
      }

      console.log(`Auth user created: ${newUser.user.id}`);

      // Delete from public.app_users if exists
      await supabase.from('app_users').delete().eq('id', userId);

      // Insert into public.app_users
      const { error: appUserErr } = await supabase
        .from('app_users')
        .insert({
          id: userId,
          tenant_id: TENANT_ID,
          role: u.role,
          full_name: u.name
        });

      if (appUserErr) {
        console.error(`Error creating app_user profile ${u.email}:`, appUserErr.message);
        throw appUserErr;
      }
      console.log(`app_user profile created successfully for ${u.email}.`);
    }

    console.log('All users seeded successfully!');
  } catch (err) {
    console.error('Seeding encountered an error:', err.message);
  }
}

seed();
