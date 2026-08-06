ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS pedagogical_intervention text;
ALTER TABLE public.class_content_logs ADD COLUMN IF NOT EXISTS pedagogical_intervention text;
