ALTER TABLE public.class_teachers ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
GRANT ALL ON public.class_teachers TO authenticated;
GRANT ALL ON public.class_teachers TO service_role;