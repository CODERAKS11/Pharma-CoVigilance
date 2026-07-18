-- 002_causality_coding.sql
-- Migration adding causality assessments, SNOMED coding candidates, and AI summary column to cases

ALTER TABLE cases ADD COLUMN IF NOT EXISTS naranjo_score int;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS naranjo_category text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS naranjo_answers jsonb;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS snomed_candidates jsonb;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ai_summary text;
