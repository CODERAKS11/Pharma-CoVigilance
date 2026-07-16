# PharmaSafe — Pharmacovigilance Case Management Console

A production-quality frontend for pharmacovigilance case processing — built for reviewers who use it for hours a day, not a marketing showcase.

## What it does

- **Case Queue** — Dense, sortable, filterable table of adverse event reports with live status indicators
- **Case Detail** — Slide-in panel with the Causality Dial (Naranjo score gauge), Naranjo question breakdown with AI provenance tags, SNOMED CT candidate coding, and a full audit trail
- **Intake Form** — Two-column reporter form with Zod validation and AI processing consent notice
- **Dashboard** — Aggregate analytics: top drugs, severity distribution, volume trends, AI agreement rate
- **Exports** — Batch E2B(R3) and PvPI export with per-case download actions
- **Admin Audit Log** — System-wide timeline with actor type, date range, and case ID filters

## Design principles

1. Every AI-derived value carries a visible **source tag** (`AI Inferred` / `Structured` / `Confirmed`)
2. The **Causality Dial** is the signature element — a segmented arc gauge making the Naranjo score instantly legible
3. **Indigo (#5B57D6)** is reserved exclusively for AI/unreviewed states, so color itself signals provenance
4. Role-based routing: Reporters → Intake, Reviewers → Queue, Admins → everything

## Tech stack

- React 18 + TypeScript (strict)
- Tailwind CSS + CSS custom properties for design tokens
- React Router v6 with nested route guards
- React Hook Form + Zod for form validation
- Recharts for dashboard visualizations
- lucide-react icons
- IBM Plex Sans + IBM Plex Mono typography

## Getting started

```bash
npm install
npm run dev
```

### Demo credentials

| Role     | Email                    | Password     |
|----------|--------------------------|--------------|
| Reviewer | reviewer@pharmasafe.io   | reviewer123  |
| Admin    | admin@pharmasafe.io      | admin123     |
| Reporter | reporter@pharmasafe.io   | reporter123  |

## Project structure

```
src/
  api/              # Auth context, mock data, TypeScript types
  components/
    ui/             # Badge, DataTable, StatCard, FilterBar, SourceTag, ErrorBoundary
    domain/         # CausalityDial, NaranjoBreakdown, SnomedCandidateList, AuditTimeline, ConsentNotice
  pages/            # Login, Intake, Queue, CaseDetail, Dashboard, Exports, Admin
  routes/           # Route config + RequireRole guard
  styles/           # Design tokens, module-specific CSS
  lib/              # Zod schemas, date/color formatters
```
