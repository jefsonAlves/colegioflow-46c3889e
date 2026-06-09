
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'P';
ALTER TABLE public.attendance ALTER COLUMN present DROP NOT NULL;
