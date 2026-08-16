ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;
UPDATE public.profiles SET gender = NULL WHERE gender IS NULL;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.profiles TO anon;