# 🛡️ PharmaSafe — Advanced Pharmacovigilence Case Management & AI Pipeline

[![React](https://img.shields.io/badge/React-2025-blue?style=for-the-badge&logo=react)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20DB-red?style=for-the-badge)](https://qdrant.tech)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-teal?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/Google-Gemini%203.5-orange?style=for-the-badge&logo=google)](https://ai.google.dev)

PharmaSafe is a secure, multi-tenant enterprise Case Safety Report (ICSR) management system designed for clinical pharmacovigilance teams. It features a responsive dashboard, a BullMQ background processing queue, a Qdrant Cloud Vector Database, a Supabase PostgreSQL instance, and a **5-stage Guarded AI pipeline** for case validity, PII scrubbing, duplicate check, causality evaluation, and SNOMED CT coding.

---

## 🏗️ System Architecture

PharmaSafe is built as a workspace-based monorepo separating React client code, Express API routes, background workers, and migration databases.

```mermaid
graph TB
    subgraph Frontend [React Application]
        UI[Case Intake & Review Dashboard]
        Router[React Router & Auth]
        Query[TanStack Query State]
    end

    subgraph Backend [Express API Monolith]
        API[Express App Servers]
        Queue[BullMQ Processing Queue]
        Worker[Case Processing Pipeline]
        Guard[Guarded AI Engine]
    end

    subgraph VectorDB [Qdrant Cloud]
        CollCases[(cases collection - 1024d)]
        CollSnomed[(snomed_findings - 1024d)]
    end

    subgraph RelationalDB [Supabase Postgres]
        Tables[(cases, tenants, app_users, audit_logs)]
    end

    subgraph AI [AI Services]
        Gemini[Google Gemini API - gemini-3.5-flash]
        HF[HuggingFace API - BAAI/bge-m3]
        Ollama[Local Ollama - bge-m3]
    end

    UI -->|JSON API / Auth| API
    API -->|Enqueue Job| Queue
    Queue -->|Process| Worker
    Worker -->|Validity & Naranjo| Guard
    Guard -->|generateContent| Gemini
    Guard -->|featureExtraction| HF
    Worker -->|checkDuplicates| CollCases
    Worker -->|matchFindings| CollSnomed
    Worker -->|SQL Transact| Tables
    Worker -->|Batch Seeding| Ollama
```

---

## 🚀 Core Features

### 💻 Enterprise Case Dashboard
- **Glassmorphism UI**: Beautiful, dark-themed responsive dashboard utilizing curated color palettes, smooth hover micro-animations, and Inter/IBM Plex font family typography.
- **Unified Analytics**: Charts tracking cases by severity, status distribution, and most common suspect drugs using **Recharts**.
- **Case Audit Trail**: Full chronological transparency with audit tables tracking case status overrides, reviews, and edits.

### ⚡ The Guarded AI Pipeline (5-Stage Validation)
Every submitted adverse drug reaction (ADR) narrative undergoes automated validation:
- **Stage 1: Validity Check (Zone 2)**: Automatically parses and validates that a patient, suspect drug, and narrative description are present.
- **Stage 2: PII Redactor & Date Offsetting**: Scrubs names, emails, and phone numbers. Replaces exact calendar dates with relative days relative to treatment initiation (e.g., `day 3 post-onset`) to guarantee patient privacy.
- **Stage 3: Semantic Deduplication (Zone 3)**: Converts narrative text into 1024-dimensional query vectors via HuggingFace's BAAI/bge-m3 model. Compares them with existing cases in Qdrant Cloud. Matches with similarity score `> 0.85` are flagged as duplicates.
- **Stage 4: Causality Assessment (Zone 5)**: Scores ADRs using the clinical **Naranjo Probability Algorithm** (-4 to +13), classifying them as Definite, Probable, Possible, or Doubtful.
- **Stage 5: SNOMED CT Hybrid Coding (Zone 5B)**: Performs a hybrid search against **93,888 SNOMED CT findings** in Qdrant, merging semantic cosine vector matching (60%) and lexical overlap (40%) to code the exact reactions.
- **Stage 6: Clinical Narrative Generator (Zone 6)**: Generates a brief clinical safety report grounded strictly in the source text, prefixed with `AI draft, unreviewed: `.

---

## 🗄️ Database Schemas (Supabase Postgres)

The Postgres instance manages tenants, authentication metadata, case records, and audit events:

### 1. `tenants`
- `id` (uuid, PK): Unique tenant organization ID.
- `name` (text): Tenant name.
- `created_at` (timestamptz): Creation timestamp.

### 2. `app_users`
- `id` (uuid, PK): References auth user.
- `tenant_id` (uuid, FK): Association to tenant.
- `role` (text): Role constraint (`reporter`, `reviewer`, `admin`).
- `full_name` (text): Full name.

### 3. `cases`
- `id` (uuid, PK): Case identifier.
- `tenant_id` (uuid, FK): Association to tenant.
- `patient_id` (uuid, FK): Patient demographics association.
- `drug_id` (uuid, FK): Suspect drug catalog association.
- `reporter_type` (text): Reporter type (`healthcare_professional`, `patient`, `caregiver`).
- `dosage` (text): Suspect drug dosage.
- `onset_date` (date): Reaction onset date.
- `narrative` (text): Raw case narrative.
- `hospitalization` / `life_threatening` / `disability` (boolean): Seriousness metrics.
- `status` (text): Workflow state (`intake`, `processing`, `triaged`, `reviewed`, `exported`).
- `priority` (text): Severity priority (`low`, `medium`, `high`, `critical`).
- `naranjo_score` (int): Calculated Naranjo causality score.
- `naranjo_category` (text): Causality category.
- `snomed_candidates` (jsonb): Array of coded SNOMED CT candidates.

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| **POST** | `/auth/session` | Public | Expose local session token exchange for mocks. |
| **GET** | `/auth/me` | User Token | Returns the current authenticated user's profile and scope. |
| **GET** | `/cases` | Reviewer / Admin | List all cases belonging to the user's tenant organization. |
| **POST** | `/cases` | Reporter / Admin | Submit a new adverse event report (triggers pipeline). |
| **GET** | `/cases/:id` | Tenant Owner | Fetch details for a specific adverse event report. |
| **PATCH** | `/cases/:id/status` | Admin | Manually override the workflow status of a case. |
| **POST** | `/cases/:id/review/confirm` | Reviewer | Confirm case coding/causality, locking values for export. |
| **GET** | `/cases/:id/export/e2b` | Reviewer | Export case details as a compliant E2B XML document. |
| **GET** | `/cases/:id/export/pvpi` | Reviewer | Export case details as a PvPI XML document. |
| **GET** | `/cases/audit` | Reviewer / Admin | List system-wide audit events (history tracking). |
| **GET** | `/dashboard/stats` | Reviewer / Admin | Fetch stats, category scores, and top suspect drug metrics. |

---

## 🚀 Setup & Installation

### Prerequisites
1. Install [Node.js](https://nodejs.org/) (v20+).
2. Install [Ollama](https://ollama.com/) locally and pull the BGE-M3 model:
   ```bash
   ollama pull bge-m3
   ```
3. Make sure local/remote Redis and Supabase Postgres instances are running.

### 1. Configure Environment Variables
Create a `.env` file in the `backend/` directory:
```env
# Relational DB
DATABASE_URL=postgresql://postgres:N%2F%2Bd.%2BF%2Fuv6mR4x@db.vyfcgwgkairooqxplovo.supabase.co:5432/postgres

# Redis Queue
REDIS_URL=redis://default:oh8feFs9tNczbWdI8j8XdkhveK5ZKi1J@card-thread-sofa-45880.db.redis.io:17015

# Vector DB
QDRANT_URL=https://your-qdrant-cluster-url.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key

# AI Pipeline Tokens
GEMINI_API_KEY=your-gemini-key
HF_TOKEN=your-huggingface-token

# Seeding Limit (50% dataset)
SEED_LIMIT=93870
```

### 2. Install Dependencies
Run from the root directory:
```bash
npm install
```

### 3. Run Database Migrations
Deploy the relational tables to Supabase:
```bash
npm run migrate:local --workspace=backend/packages/db
```

### 4. Run SNOMED CT Seeding (Background)
Seed the vector space with 50% of the SNOMED findings dictionary:
```bash
npx ts-node backend/packages/db/scripts/seed-snomed.ts
```

### 5. Launch the Application
Start the backend and frontend dev servers:
```bash
# Start backend API (Port 4000)
cd backend && npm run dev:api

# Start frontend (Port 5173)
# Run from root directory
npm run dev:frontend
```

---

## 🧪 Running Tests
The test suite runs automatically in offline-mock mode to guarantee speed and zero key quota usage.
```bash
npm test --workspace=backend
```