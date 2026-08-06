-- Update the unique constraint on the attendance table to include schedule_id
-- First, drop the old constraint
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_class_id_student_id_date_key;

-- Create the new constraint that includes schedule_id
-- We use COALESCE or similar to handle NULL schedule_id if needed,
-- but standard UNIQUE treats NULL as distinct.
-- For multi-schedule classes, we definitely want schedule_id in the key.
ALTER TABLE public.attendance ADD CONSTRAINT attendance_class_id_student_id_date_schedule_key 
UNIQUE (class_id, student_id, "date", schedule_id);

-- Ensure RLS and grants are correct (though they should be already)
GRANT ALL ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
