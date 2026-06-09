
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS matricula text;
CREATE UNIQUE INDEX IF NOT EXISTS students_school_matricula_uidx
  ON public.students (school_id, matricula) WHERE matricula IS NOT NULL;
