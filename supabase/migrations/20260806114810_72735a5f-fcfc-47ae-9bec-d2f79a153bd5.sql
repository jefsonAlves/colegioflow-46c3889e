ALTER TABLE public.attendance ADD COLUMN schedule_id uuid REFERENCES public.class_schedules(id) ON DELETE SET NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;