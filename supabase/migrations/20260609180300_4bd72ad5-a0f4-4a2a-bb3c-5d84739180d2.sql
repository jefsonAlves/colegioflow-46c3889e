
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS special_needs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_needs_note text;

CREATE TABLE IF NOT EXISTS public.class_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS class_schedules_class_idx ON public.class_schedules(class_id);
CREATE INDEX IF NOT EXISTS class_schedules_school_weekday_idx ON public.class_schedules(school_id, weekday);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_schedules TO authenticated;
GRANT ALL ON public.class_schedules TO service_role;

ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_schedules select members"
  ON public.class_schedules FOR SELECT TO authenticated
  USING (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE POLICY "class_schedules insert admin or teacher"
  ON public.class_schedules FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_school_admin(auth.uid(), school_id)
      OR public.is_class_teacher(auth.uid(), class_id)
      OR public.is_master(auth.uid()))
    AND created_by = auth.uid()
  );

CREATE POLICY "class_schedules update admin or teacher"
  ON public.class_schedules FOR UPDATE TO authenticated
  USING (
    public.is_school_admin(auth.uid(), school_id)
    OR public.is_class_teacher(auth.uid(), class_id)
    OR public.is_master(auth.uid())
  )
  WITH CHECK (
    public.is_school_admin(auth.uid(), school_id)
    OR public.is_class_teacher(auth.uid(), class_id)
    OR public.is_master(auth.uid())
  );

CREATE POLICY "class_schedules delete admin or teacher"
  ON public.class_schedules FOR DELETE TO authenticated
  USING (
    public.is_school_admin(auth.uid(), school_id)
    OR public.is_class_teacher(auth.uid(), class_id)
    OR public.is_master(auth.uid())
  );
