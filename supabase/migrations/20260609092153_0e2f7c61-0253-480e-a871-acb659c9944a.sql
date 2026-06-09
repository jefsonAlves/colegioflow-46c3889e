
DROP POLICY IF EXISTS "memberships insert self" ON public.school_memberships;
CREATE POLICY "memberships insert self pending"
ON public.school_memberships FOR INSERT TO authenticated
WITH CHECK (
  (
    user_id = auth.uid()
    AND status = 'pending'::membership_status
    AND role_in_school IN ('teacher'::role_in_school, 'coordinator'::role_in_school)
  )
  OR public.is_school_admin(auth.uid(), school_id)
  OR public.is_master(auth.uid())
);

DROP POLICY IF EXISTS "students rw members" ON public.students;
CREATE POLICY "students select members" ON public.students FOR SELECT TO authenticated
USING (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()));
CREATE POLICY "students insert members" ON public.students FOR INSERT TO authenticated
WITH CHECK ((public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid())) AND created_by = auth.uid());
CREATE POLICY "students update creator or admin" ON public.students FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()))
WITH CHECK (created_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));
CREATE POLICY "students delete admin or master" ON public.students FOR DELETE TO authenticated
USING (public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));

DROP POLICY IF EXISTS "grades rw members" ON public.grades;
CREATE POLICY "grades select members" ON public.grades FOR SELECT TO authenticated
USING (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()));
CREATE POLICY "grades insert members" ON public.grades FOR INSERT TO authenticated
WITH CHECK ((public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid())) AND recorded_by = auth.uid());
CREATE POLICY "grades update creator or admin" ON public.grades FOR UPDATE TO authenticated
USING (recorded_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()))
WITH CHECK (recorded_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));
CREATE POLICY "grades delete creator or admin" ON public.grades FOR DELETE TO authenticated
USING (recorded_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));

DROP POLICY IF EXISTS "disciplinary rw members" ON public.disciplinary;
CREATE POLICY "disciplinary select members" ON public.disciplinary FOR SELECT TO authenticated
USING (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()));
CREATE POLICY "disciplinary insert members" ON public.disciplinary FOR INSERT TO authenticated
WITH CHECK ((public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid())) AND recorded_by = auth.uid());
CREATE POLICY "disciplinary update creator or admin" ON public.disciplinary FOR UPDATE TO authenticated
USING (recorded_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()))
WITH CHECK (recorded_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));
CREATE POLICY "disciplinary delete creator or admin" ON public.disciplinary FOR DELETE TO authenticated
USING (recorded_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE POLICY "profiles delete self or master" ON public.profiles FOR DELETE TO authenticated
USING (id = auth.uid() OR public.is_master(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
