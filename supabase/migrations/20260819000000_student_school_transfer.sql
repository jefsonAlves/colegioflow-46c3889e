ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS transfer_reason text,
ADD COLUMN IF NOT EXISTS transfer_date timestamp with time zone;

COMMENT ON COLUMN public.students.transfer_reason IS 'Reason for school transfer';
COMMENT ON COLUMN public.students.transfer_date IS 'Date of school transfer';
