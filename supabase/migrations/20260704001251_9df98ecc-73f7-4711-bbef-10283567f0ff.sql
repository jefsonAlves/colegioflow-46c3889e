
-- 1. class_overrides
CREATE TABLE public.class_overrides (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  custom_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, class_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_overrides TO authenticated;
GRANT ALL ON public.class_overrides TO service_role;
ALTER TABLE public.class_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own class overrides" ON public.class_overrides FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_class_overrides_updated BEFORE UPDATE ON public.class_overrides FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. student_overrides
CREATE TABLE public.student_overrides (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  custom_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_overrides TO authenticated;
GRANT ALL ON public.student_overrides TO service_role;
ALTER TABLE public.student_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own student overrides" ON public.student_overrides FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_student_overrides_updated BEFORE UPDATE ON public.student_overrides FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. rename_class_smart / rename_student_smart
CREATE OR REPLACE FUNCTION public.rename_class_smart(_class_id uuid, _new_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _school uuid;
  _is_admin boolean;
  _override_count int;
  _shared boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT school_id INTO _school FROM public.classes WHERE id = _class_id;
  IF _school IS NULL THEN RAISE EXCEPTION 'class not found'; END IF;
  _is_admin := public.is_school_admin(_uid, _school);
  SELECT count(*) INTO _override_count FROM public.class_overrides WHERE class_id = _class_id;
  -- Shared rename: admin, OR nobody has personalized and no other user has renamed
  IF _is_admin OR _override_count = 0 THEN
    UPDATE public.classes SET name = _new_name WHERE id = _class_id;
    _shared := true;
  ELSE
    INSERT INTO public.class_overrides (user_id, class_id, custom_name)
    VALUES (_uid, _class_id, _new_name)
    ON CONFLICT (user_id, class_id) DO UPDATE SET custom_name = EXCLUDED.custom_name, updated_at = now();
    _shared := false;
  END IF;
  RETURN CASE WHEN _shared THEN 'shared' ELSE 'personal' END;
END $$;

CREATE OR REPLACE FUNCTION public.rename_student_smart(_student_id uuid, _new_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _school uuid;
  _is_admin boolean;
  _override_count int;
  _shared boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT school_id INTO _school FROM public.students WHERE id = _student_id;
  IF _school IS NULL THEN RAISE EXCEPTION 'student not found'; END IF;
  _is_admin := public.is_school_admin(_uid, _school);
  SELECT count(*) INTO _override_count FROM public.student_overrides WHERE student_id = _student_id;
  IF _is_admin OR _override_count = 0 THEN
    UPDATE public.students SET name = _new_name WHERE id = _student_id;
    _shared := true;
  ELSE
    INSERT INTO public.student_overrides (user_id, student_id, custom_name)
    VALUES (_uid, _student_id, _new_name)
    ON CONFLICT (user_id, student_id) DO UPDATE SET custom_name = EXCLUDED.custom_name, updated_at = now();
    _shared := false;
  END IF;
  RETURN CASE WHEN _shared THEN 'shared' ELSE 'personal' END;
END $$;

-- 4. class_attendance_alerts
CREATE TABLE public.class_attendance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_absences int NOT NULL CHECK (max_absences > 0),
  period text NOT NULL DEFAULT 'month' CHECK (period IN ('month','bimester','year')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, teacher_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_attendance_alerts TO authenticated;
GRANT ALL ON public.class_attendance_alerts TO service_role;
ALTER TABLE public.class_attendance_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attendance alerts" ON public.class_attendance_alerts FOR ALL TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE TRIGGER trg_att_alerts_updated BEFORE UPDATE ON public.class_attendance_alerts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. class_content_logs
CREATE TABLE public.class_content_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  title text NOT NULL,
  description text,
  objective text,
  reaction text,
  success text CHECK (success IN ('yes','partial','no')),
  attachment_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_content_logs TO authenticated;
GRANT ALL ON public.class_content_logs TO service_role;
ALTER TABLE public.class_content_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content logs teacher rw" ON public.class_content_logs FOR ALL TO authenticated
  USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "content logs admin read" ON public.class_content_logs FOR SELECT TO authenticated
  USING (public.is_school_admin(auth.uid(), school_id));
CREATE TRIGGER trg_content_logs_updated BEFORE UPDATE ON public.class_content_logs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. assessment_types
CREATE TABLE public.assessment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  bimester int NOT NULL CHECK (bimester BETWEEN 1 AND 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_types TO authenticated;
GRANT ALL ON public.assessment_types TO service_role;
ALTER TABLE public.assessment_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assessment types" ON public.assessment_types FOR ALL TO authenticated
  USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE TRIGGER trg_assessment_types_updated BEFORE UPDATE ON public.assessment_types FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
