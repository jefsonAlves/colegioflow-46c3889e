
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS stages TEXT[] NOT NULL DEFAULT ARRAY['fund1']::text[];
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'fund1';
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS modality TEXT NOT NULL DEFAULT 'regular';
ALTER TABLE public.class_teachers ADD COLUMN IF NOT EXISTS subject TEXT;

CREATE TABLE IF NOT EXISTS public.student_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  attachment_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_cert_student ON public.student_certificates(student_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_cert_school ON public.student_certificates(school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_certificates TO authenticated;
GRANT ALL ON public.student_certificates TO service_role;
ALTER TABLE public.student_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY cert_admin_all ON public.student_certificates FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));
CREATE POLICY cert_teacher_read ON public.student_certificates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.class_teachers ct ON ct.class_id = s.class_id
    WHERE s.id = student_id AND ct.user_id = auth.uid()
  ));
CREATE POLICY cert_parent_read ON public.student_certificates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.parent_links pl
    WHERE pl.student_id = student_certificates.student_id AND pl.parent_user_id = auth.uid()
  ));

CREATE TRIGGER trg_touch_cert BEFORE UPDATE ON public.student_certificates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.student_class_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_class_id UUID,
  to_class_id UUID,
  moved_by UUID NOT NULL,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_sch_student ON public.student_class_history(student_id, moved_at DESC);

GRANT SELECT, INSERT ON public.student_class_history TO authenticated;
GRANT ALL ON public.student_class_history TO service_role;
ALTER TABLE public.student_class_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY sch_read ON public.student_class_history FOR SELECT
  USING (
    public.is_school_admin(auth.uid(), school_id)
    OR public.is_master(auth.uid())
    OR public.is_class_teacher(auth.uid(), from_class_id)
    OR public.is_class_teacher(auth.uid(), to_class_id)
  );
CREATE POLICY sch_admin_insert ON public.student_class_history FOR INSERT
  WITH CHECK (public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_certificate_to_attendance(_cert_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cert record;
  _updated INTEGER := 0;
BEGIN
  SELECT * INTO _cert FROM public.student_certificates WHERE id = _cert_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  UPDATE public.attendance
     SET status = 'J'
   WHERE student_id = _cert.student_id
     AND date BETWEEN _cert.start_date AND _cert.end_date
     AND status = 'F';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_apply_cert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_certificate_to_attendance(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cert_apply AFTER INSERT OR UPDATE OF start_date, end_date ON public.student_certificates
  FOR EACH ROW EXECUTE FUNCTION public.trg_apply_cert();

CREATE OR REPLACE FUNCTION public.trg_att_check_cert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'F' AND EXISTS (
    SELECT 1 FROM public.student_certificates c
    WHERE c.student_id = NEW.student_id
      AND NEW.date BETWEEN c.start_date AND c.end_date
  ) THEN
    NEW.status := 'J';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_att_cert BEFORE INSERT OR UPDATE OF status, date ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.trg_att_check_cert();

CREATE OR REPLACE FUNCTION public.move_students_to_class(_student_ids UUID[], _to_class_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _school UUID;
  _sid UUID;
  _from UUID;
  _count INTEGER := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT school_id INTO _school FROM public.classes WHERE id = _to_class_id;
  IF _school IS NULL THEN RAISE EXCEPTION 'class not found'; END IF;
  IF NOT (public.is_school_admin(_uid, _school) OR public.is_master(_uid)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  FOREACH _sid IN ARRAY _student_ids LOOP
    SELECT class_id INTO _from FROM public.students WHERE id = _sid AND school_id = _school;
    IF NOT EXISTS(SELECT 1 FROM public.students WHERE id=_sid AND school_id=_school) THEN
      CONTINUE;
    END IF;
    UPDATE public.students SET class_id = _to_class_id WHERE id = _sid AND school_id = _school;
    INSERT INTO public.student_class_history (school_id, student_id, from_class_id, to_class_id, moved_by)
      VALUES (_school, _sid, _from, _to_class_id, _uid);
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END;
$$;
