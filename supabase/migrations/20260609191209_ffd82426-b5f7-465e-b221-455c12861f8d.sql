
-- 1. class_schedules: add teacher_id + subject
ALTER TABLE public.class_schedules ADD COLUMN IF NOT EXISTS teacher_id uuid;
ALTER TABLE public.class_schedules ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT '';

UPDATE public.class_schedules SET teacher_id = created_by WHERE teacher_id IS NULL;
ALTER TABLE public.class_schedules ALTER COLUMN teacher_id SET NOT NULL;

-- Replace write policies so only the schedule owner (or admin/master) can write
DROP POLICY IF EXISTS "class_schedules insert admin or teacher" ON public.class_schedules;
DROP POLICY IF EXISTS "class_schedules update admin or teacher" ON public.class_schedules;
DROP POLICY IF EXISTS "class_schedules delete admin or teacher" ON public.class_schedules;

CREATE POLICY "class_schedules insert owner"
  ON public.class_schedules FOR INSERT
  WITH CHECK (
    (teacher_id = auth.uid() AND created_by = auth.uid()
      AND (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid())))
    OR public.is_school_admin(auth.uid(), school_id)
    OR public.is_master(auth.uid())
  );

CREATE POLICY "class_schedules update owner or admin"
  ON public.class_schedules FOR UPDATE
  USING (teacher_id = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()))
  WITH CHECK (teacher_id = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE POLICY "class_schedules delete owner or admin"
  ON public.class_schedules FOR DELETE
  USING (teacher_id = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));

-- 2. attendance: per-teacher visibility
DROP POLICY IF EXISTS "attendance rw members" ON public.attendance;

CREATE POLICY "attendance select own or admin"
  ON public.attendance FOR SELECT
  USING (
    recorded_by = auth.uid()
    OR public.is_school_admin(auth.uid(), school_id)
    OR public.is_master(auth.uid())
  );

CREATE POLICY "attendance insert own"
  ON public.attendance FOR INSERT
  WITH CHECK (
    recorded_by = auth.uid()
    AND (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()))
  );

CREATE POLICY "attendance update own or admin"
  ON public.attendance FOR UPDATE
  USING (recorded_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()))
  WITH CHECK (recorded_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE POLICY "attendance delete own or admin"
  ON public.attendance FOR DELETE
  USING (recorded_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));

-- 3. grades: per-teacher SELECT
DROP POLICY IF EXISTS "grades select members" ON public.grades;
CREATE POLICY "grades select own or admin"
  ON public.grades FOR SELECT
  USING (recorded_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));

-- 4. disciplinary: per-teacher SELECT
DROP POLICY IF EXISTS "disciplinary select members" ON public.disciplinary;
CREATE POLICY "disciplinary select own or admin"
  ON public.disciplinary FOR SELECT
  USING (recorded_by = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));
