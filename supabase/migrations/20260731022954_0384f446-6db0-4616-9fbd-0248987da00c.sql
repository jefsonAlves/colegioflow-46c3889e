ALTER TABLE public.assessment_types
  ADD COLUMN IF NOT EXISTS subject_key text NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_value numeric NOT NULL DEFAULT 10;

CREATE UNIQUE INDEX IF NOT EXISTS assessment_types_unique_key
  ON public.assessment_types (teacher_id, class_id, bimester, subject_key);