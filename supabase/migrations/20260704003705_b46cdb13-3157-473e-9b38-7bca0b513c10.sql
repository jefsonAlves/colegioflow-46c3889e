
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS target_user_id uuid,
  ADD COLUMN IF NOT EXISTS target_role text,
  ADD COLUMN IF NOT EXISTS target_class_id uuid;

CREATE INDEX IF NOT EXISTS announcements_target_user_id_idx ON public.announcements(target_user_id);
CREATE INDEX IF NOT EXISTS announcements_target_class_id_idx ON public.announcements(target_class_id);

DROP POLICY IF EXISTS "announcements select members" ON public.announcements;
DROP POLICY IF EXISTS "announcements select targeted or general" ON public.announcements;
CREATE POLICY "announcements select targeted or general" ON public.announcements
FOR SELECT
USING (
  is_master(auth.uid())
  OR author_id = auth.uid()
  OR is_school_admin(auth.uid(), school_id)
  OR (
    is_school_member(auth.uid(), school_id)
    AND (
      (target_user_id IS NULL AND target_role IS NULL AND target_class_id IS NULL)
      OR target_user_id = auth.uid()
      OR (target_class_id IS NOT NULL AND is_class_teacher(auth.uid(), target_class_id))
      OR (
        target_role IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.school_memberships m
          WHERE m.user_id = auth.uid()
            AND m.school_id = announcements.school_id
            AND m.status = 'approved'
            AND m.role_in_school::text = target_role
        )
      )
    )
  )
);

CREATE TABLE IF NOT EXISTS public.student_performance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  date date NOT NULL DEFAULT (now()::date),
  content_ref uuid,
  performance text NOT NULL CHECK (performance IN ('excelente','bom','regular','dificuldade')),
  notes text,
  needs_adaptation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_performance_logs TO authenticated;
GRANT ALL ON public.student_performance_logs TO service_role;

ALTER TABLE public.student_performance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perf logs read (teacher or admin)" ON public.student_performance_logs;
CREATE POLICY "perf logs read (teacher or admin)" ON public.student_performance_logs
FOR SELECT USING (
  is_master(auth.uid())
  OR is_school_admin(auth.uid(), school_id)
  OR teacher_id = auth.uid()
  OR is_class_teacher(auth.uid(), class_id)
);

DROP POLICY IF EXISTS "perf logs insert (class teacher)" ON public.student_performance_logs;
CREATE POLICY "perf logs insert (class teacher)" ON public.student_performance_logs
FOR INSERT WITH CHECK (
  teacher_id = auth.uid()
  AND (is_class_teacher(auth.uid(), class_id) OR is_school_admin(auth.uid(), school_id))
);

DROP POLICY IF EXISTS "perf logs update own" ON public.student_performance_logs;
CREATE POLICY "perf logs update own" ON public.student_performance_logs
FOR UPDATE USING (teacher_id = auth.uid() OR is_school_admin(auth.uid(), school_id))
WITH CHECK (teacher_id = auth.uid() OR is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "perf logs delete own" ON public.student_performance_logs;
CREATE POLICY "perf logs delete own" ON public.student_performance_logs
FOR DELETE USING (teacher_id = auth.uid() OR is_school_admin(auth.uid(), school_id));

DROP TRIGGER IF EXISTS student_performance_logs_touch ON public.student_performance_logs;
CREATE TRIGGER student_performance_logs_touch
BEFORE UPDATE ON public.student_performance_logs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS spl_class_student_idx ON public.student_performance_logs(class_id, student_id, date DESC);

ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

DROP TRIGGER IF EXISTS grades_touch ON public.grades;
CREATE TRIGGER grades_touch
BEFORE UPDATE ON public.grades
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
