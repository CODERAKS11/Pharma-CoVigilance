# 🛡️ PharmaSafe — Advanced Pharmacovigilence Case Management & AI Pipeline

PharmaSafe is a state-of-the-art Case Safety Report (ICSR) management system designed for clinical pharmacovigilance teams. It features a secure, multi-tenant React dashboard, an Express backend, and a robust **five-stage AI processing pipeline** leveraging local/cloud embedding models and Google Gemini LLMs for case triage, semantic deduplication, and automated medical coding.

---

## 🏗️ Architecture Overview

PharmaSafe is structured as a monorepo containing a modern **React Frontend** and a multi-workspace **Express Backend**.

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

## ⚡ The Guarded AI Pipeline (5-Stage Validation)

Every submitted adverse drug reaction (ADR) narrative undergoes automated processing:

1. **Validity Check (Zone 2)**: Standard checks verify if the case contains a patient, a suspect drug, and a description.
2. **PII Redaction & Temporal Offsets**: Strips emails, phone numbers, and names. Converts exact calendar dates into relative onset offsets (e.g., `"day 2 post-dose"`) for absolute patient privacy.
3. **Semantic Deduplication (Zone 3)**: Generates a query vector via HuggingFace's BAAI/bge-m3 API and searches Qdrant Cloud. Flags near-duplicate cases of the same drug within the tenant with a similarity threshold of `> 0.85`.
4. **Causality Assessment (Zone 5)**: Tallies a clinical Naranjo score (from -4 to +13) and assigns a causality probability category (Definite, Probable, Possible, Doubtful).
5. **Medical Coding (Zone 5B)**: Performs a hybrid search over **93,888 SNOMED CT findings** in Qdrant Cloud, merging semantic vector similarity (60% weight) and lexical matching (40% weight) to return coding suggestions.
6. **Clinical Narrative Generation (Zone 6)**: Generates a concise medical summary paragraph grounded strictly in the source narrative, prefixed with `"AI draft, unreviewed: "`.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
|---|---|---|
| **Frontend** | React, Vite, TanStack Query, Tailwind CSS, Recharts, Lucide | Responsive case listing, structured intake form, and data visualization. |
| **Backend** | Node.js, Express, BullMQ (Redis), pg | Monolith backend orchestrating the API and queue system. |
| **LLM Engine** | Google Gemini API (`gemini-flash-latest`) | High-quality causality evaluation and clinical summaries. |
| **Embeddings** | HuggingFace Inference API (`BAAI/bge-m3`) | 1024-dimensional query embeddings for real-time duplicates check and search. |
| **Local Seeding** | Local Ollama (`bge-m3` model) | Batch seeds 93,888 records locally with zero network costs or quota restrictions. |
| **Relational DB** | Supabase (PostgreSQL 17.6) | Multi-tenant schema with structured patient, audit trail, and user tables. |
| **Vector DB** | Qdrant Cloud | High-speed semantic similarity matching using Cosine distance. |

---

## 🚀 Setup & Installation

### Prerequisites
1. Install [Node.js](https://nodejs.org/) (v20+ recommended).
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