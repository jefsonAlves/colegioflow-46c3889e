ALTER TABLE public.students ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;