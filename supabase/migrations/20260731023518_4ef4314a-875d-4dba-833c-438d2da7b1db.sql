
-- 1) Prevent self-granted approved school_admin
DROP POLICY IF EXISTS "memberships insert" ON public.school_memberships;
CREATE POLICY "memberships insert" ON public.school_memberships
FOR INSERT TO authenticated
WITH CHECK (
  public.is_master(auth.uid())
  OR public.is_school_admin(auth.uid(), school_id)
  OR (user_id = auth.uid() AND status = 'pending'::membership_status)
);

-- Creator of a school is bootstrapped as approved admin by trigger
CREATE OR REPLACE FUNCTION public.trg_school_bootstrap_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.school_memberships (school_id, user_id, role_in_school, status, approved_by)
  VALUES (NEW.id, NEW.created_by, 'school_admin', 'approved', NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.trg_school_bootstrap_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_school_bootstrap_admin ON public.schools;
CREATE TRIGGER trg_school_bootstrap_admin
AFTER INSERT ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.trg_school_bootstrap_admin();

-- 2) Scope class-content admin read to the school that owns the log entry
DROP POLICY IF EXISTS "class-content admin read" ON storage.objects;
CREATE POLICY "class-content admin read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'class-content'
  AND EXISTS (
    SELECT 1 FROM public.class_content_logs l
    WHERE l.attachment_path = storage.objects.name
      AND public.is_school_admin(auth.uid(), l.school_id)
  )
);
