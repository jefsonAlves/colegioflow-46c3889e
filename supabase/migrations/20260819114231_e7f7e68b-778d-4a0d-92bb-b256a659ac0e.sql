-- Add missing CASCADE delete to student_performance_logs
ALTER TABLE public.student_performance_logs
DROP CONSTRAINT IF EXISTS student_performance_logs_student_id_fkey,
ADD CONSTRAINT student_performance_logs_student_id_fkey 
FOREIGN KEY (student_id) 
REFERENCES public.students(id) 
ON DELETE CASCADE;

-- Ensure all other student references are CASCADE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'student_id') THEN
        ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;
        ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grades' AND column_name = 'student_id') THEN
        ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_student_id_fkey;
        ALTER TABLE public.grades ADD CONSTRAINT grades_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disciplinary' AND column_name = 'student_id') THEN
        ALTER TABLE public.disciplinary DROP CONSTRAINT IF EXISTS disciplinary_student_id_fkey;
        ALTER TABLE public.disciplinary ADD CONSTRAINT disciplinary_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
    END IF;
END $$;
