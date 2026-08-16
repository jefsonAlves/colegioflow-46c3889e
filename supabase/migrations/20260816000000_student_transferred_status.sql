-- Add status column to students table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'status') THEN
    ALTER TABLE public.students ADD COLUMN status text DEFAULT 'active';
  END IF;
END
$$;

-- Grant access (already granted in bulk usually, but being explicit is safer for new columns in some setups)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
