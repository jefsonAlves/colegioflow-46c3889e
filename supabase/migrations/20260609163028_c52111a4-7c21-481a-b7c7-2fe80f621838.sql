CREATE TABLE public.import_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  base_url text NOT NULL,
  api_key_encrypted text NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  last_run_at timestamptz,
  last_status text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_sources TO authenticated;
GRANT ALL ON public.import_sources TO service_role;

ALTER TABLE public.import_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master can read import sources"
  ON public.import_sources FOR SELECT
  TO authenticated
  USING (public.is_master(auth.uid()));

CREATE POLICY "Master can insert import sources"
  ON public.import_sources FOR INSERT
  TO authenticated
  WITH CHECK (public.is_master(auth.uid()));

CREATE POLICY "Master can update import sources"
  ON public.import_sources FOR UPDATE
  TO authenticated
  USING (public.is_master(auth.uid()))
  WITH CHECK (public.is_master(auth.uid()));

CREATE POLICY "Master can delete import sources"
  ON public.import_sources FOR DELETE
  TO authenticated
  USING (public.is_master(auth.uid()));

CREATE TRIGGER touch_import_sources_updated_at
  BEFORE UPDATE ON public.import_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();