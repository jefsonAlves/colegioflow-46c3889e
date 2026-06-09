
-- 1. Add grade_level (série) to classes for "same grade" sharing
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS grade_level text;

-- 2. Add external_id for idempotent imports
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS students_school_external_uidx ON public.students(school_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_school_external_uidx ON public.attendance(school_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS grades_school_external_uidx ON public.grades(school_id, external_id) WHERE external_id IS NOT NULL;

-- 3. class_teachers join table (teachers who actually teach a class)
CREATE TABLE IF NOT EXISTS public.class_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_teachers TO authenticated;
GRANT ALL ON public.class_teachers TO service_role;
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_teachers select members" ON public.class_teachers
  FOR SELECT TO authenticated
  USING (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE POLICY "class_teachers insert self or admin" ON public.class_teachers
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND public.is_school_member(auth.uid(), school_id))
    OR public.is_school_admin(auth.uid(), school_id)
    OR public.is_master(auth.uid())
  );

CREATE POLICY "class_teachers delete self or admin" ON public.class_teachers
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_school_admin(auth.uid(), school_id)
    OR public.is_master(auth.uid())
  );

-- 4. Helper: is the user a teacher of a given class?
CREATE OR REPLACE FUNCTION public.is_class_teacher(_user_id uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_teachers WHERE user_id = _user_id AND class_id = _class_id)
$$;

-- 5. Extend students SELECT to include class teachers (members already covered)
-- Drop & recreate the select policy to add the OR
DROP POLICY IF EXISTS "students select members" ON public.students;
CREATE POLICY "students select members or class teachers" ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_school_member(auth.uid(), school_id)
    OR public.is_master(auth.uid())
    OR (class_id IS NOT NULL AND public.is_class_teacher(auth.uid(), class_id))
  );

-- 6. Lock down school_admin demotion/removal: only master or the user themself can change a school_admin membership
DROP POLICY IF EXISTS "memberships update admin or master" ON public.school_memberships;
CREATE POLICY "memberships update admin or master" ON public.school_memberships
  FOR UPDATE TO authenticated
  USING (
    CASE
      WHEN role_in_school = 'school_admin' THEN public.is_master(auth.uid()) OR user_id = auth.uid()
      ELSE public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid())
    END
  )
  WITH CHECK (
    CASE
      WHEN role_in_school = 'school_admin' THEN public.is_master(auth.uid()) OR user_id = auth.uid()
      ELSE public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid())
    END
  );

DROP POLICY IF EXISTS "memberships delete master" ON public.school_memberships;
CREATE POLICY "memberships delete admin or master" ON public.school_memberships
  FOR DELETE TO authenticated
  USING (
    CASE
      WHEN role_in_school = 'school_admin' THEN public.is_master(auth.uid())
      ELSE public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid())
    END
  );

-- 7. Allow any member to insert a school_admin membership for THEMSELVES with status=approved
-- ONLY when there are no school_admins yet for that school (creator becomes initial admin).
-- For subsequent admin requests, fall back to current rules (pending) — admins/master approve.
DROP POLICY IF EXISTS "memberships insert self pending" ON public.school_memberships;
CREATE POLICY "memberships insert" ON public.school_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Master can insert anything
    public.is_master(auth.uid())
    -- School admins can insert anything for their school
    OR public.is_school_admin(auth.uid(), school_id)
    -- Self-pending teacher/coordinator request
    OR (user_id = auth.uid() AND status = 'pending' AND role_in_school IN ('teacher','coordinator'))
    -- Self-pending school_admin request (will be approved by existing admin or master)
    OR (user_id = auth.uid() AND status = 'pending' AND role_in_school = 'school_admin')
    -- Self-approved school_admin if no admin exists yet (bootstrap on school creation)
    OR (
      user_id = auth.uid()
      AND role_in_school = 'school_admin'
      AND status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM public.school_memberships m
        WHERE m.school_id = school_memberships.school_id
          AND m.role_in_school = 'school_admin'
          AND m.status = 'approved'
      )
    )
  );

-- 8. Schools: createdBy default. (RLS already exists.) Make sure non-master can create as active.
-- The status is set by app code; no extra policy change needed since insert policy already permits members.
