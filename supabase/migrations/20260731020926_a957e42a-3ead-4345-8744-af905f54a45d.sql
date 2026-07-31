-- 1) Fix privilege escalation on school_memberships self-insert
DROP POLICY IF EXISTS "memberships insert" ON public.school_memberships;
CREATE POLICY "memberships insert" ON public.school_memberships
FOR INSERT TO authenticated
WITH CHECK (
  public.is_master(auth.uid())
  OR public.is_school_admin(auth.uid(), school_id)
  OR (user_id = auth.uid() AND status = 'pending'::membership_status)
  OR (
    user_id = auth.uid()
    AND role_in_school = 'school_admin'::role_in_school
    AND status = 'approved'::membership_status
    AND EXISTS (
      SELECT 1 FROM public.schools s
      WHERE s.id = school_memberships.school_id AND s.created_by = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.school_memberships m
      WHERE m.school_id = school_memberships.school_id
        AND m.role_in_school = 'school_admin'::role_in_school
        AND m.status = 'approved'::membership_status
    )
  )
);

-- 2) Scope class-content admin reads to the admin's own school
DROP POLICY IF EXISTS "class-content admin read" ON storage.objects;
CREATE POLICY "class-content admin read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'class-content'
  AND EXISTS (
    SELECT 1
    FROM public.school_memberships adm
    JOIN public.school_memberships owner
      ON owner.school_id = adm.school_id
     AND owner.status = 'approved'::membership_status
    WHERE adm.user_id = auth.uid()
      AND adm.role_in_school = 'school_admin'::role_in_school
      AND adm.status = 'approved'::membership_status
      AND owner.user_id::text = (storage.foldername(name))[1]
  )
);

-- 3) Internal DB functions must not be callable by anonymous visitors
REVOKE EXECUTE ON FUNCTION public.is_school_admin(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_school_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_master(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.global_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_class_teacher(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rename_class_smart(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rename_student_smart(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.move_students_to_class(uuid[], uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.apply_certificate_to_attendance(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.global_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_teacher(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_class_smart(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_student_smart(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_students_to_class(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_certificate_to_attendance(uuid) TO authenticated;