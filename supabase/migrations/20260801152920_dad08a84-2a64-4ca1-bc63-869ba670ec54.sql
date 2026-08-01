-- 1. Plan columns on schools
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan_expires_at date,
  ADD COLUMN IF NOT EXISTS max_staff integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_students integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS master_notes text;

-- Validate plan values via trigger-friendly simple checks (immutable)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_plan_check') THEN
    ALTER TABLE public.schools ADD CONSTRAINT schools_plan_check
      CHECK (plan IN ('free','essential','complete'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_plan_status_check') THEN
    ALTER TABLE public.schools ADD CONSTRAINT schools_plan_status_check
      CHECK (plan_status IN ('active','trial','suspended'));
  END IF;
END $$;

-- 2. Master-only plan updates
CREATE OR REPLACE FUNCTION public.master_set_school_plan(
  _school_id uuid,
  _plan text,
  _plan_status text,
  _plan_expires_at date,
  _max_staff integer,
  _max_students integer,
  _master_notes text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.schools
     SET plan = _plan,
         plan_status = _plan_status,
         plan_expires_at = _plan_expires_at,
         max_staff = greatest(coalesce(_max_staff, 5), 1),
         max_students = greatest(coalesce(_max_students, 50), 1),
         master_notes = _master_notes,
         updated_at = now()
   WHERE id = _school_id;
END $$;

GRANT EXECUTE ON FUNCTION public.master_set_school_plan(uuid, text, text, date, integer, integer, text) TO authenticated;

-- 3. Master overview of all schools
CREATE OR REPLACE FUNCTION public.master_schools_overview()
RETURNS TABLE (
  school_id uuid,
  name text,
  city text,
  state text,
  status text,
  plan text,
  plan_status text,
  plan_expires_at date,
  max_staff integer,
  max_students integer,
  master_notes text,
  staff_count integer,
  admin_count integer,
  teacher_count integer,
  pending_count integer,
  class_count integer,
  student_count integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id,
         s.name,
         s.city,
         s.state,
         s.status::text,
         s.plan,
         s.plan_status,
         s.plan_expires_at,
         s.max_staff,
         s.max_students,
         s.master_notes,
         (SELECT count(*)::int FROM public.school_memberships m WHERE m.school_id = s.id AND m.status = 'approved'),
         (SELECT count(*)::int FROM public.school_memberships m WHERE m.school_id = s.id AND m.status = 'approved' AND m.role_in_school = 'school_admin'),
         (SELECT count(*)::int FROM public.school_memberships m WHERE m.school_id = s.id AND m.status = 'approved' AND m.role_in_school <> 'school_admin'),
         (SELECT count(*)::int FROM public.school_memberships m WHERE m.school_id = s.id AND m.status = 'pending'),
         (SELECT count(*)::int FROM public.classes c WHERE c.school_id = s.id),
         (SELECT count(*)::int FROM public.students st WHERE st.school_id = s.id),
         s.created_at
    FROM public.schools s
   WHERE public.is_master(auth.uid())
   ORDER BY s.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.master_schools_overview() TO authenticated;

-- 4. Usage summary for a single school (school members / master)
CREATE OR REPLACE FUNCTION public.school_usage(_school_id uuid)
RETURNS TABLE (
  staff_count integer,
  admin_count integer,
  teacher_count integer,
  pending_count integer,
  class_count integer,
  student_count integer,
  plan text,
  plan_status text,
  plan_expires_at date,
  max_staff integer,
  max_students integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT count(*)::int FROM public.school_memberships m WHERE m.school_id = s.id AND m.status = 'approved'),
         (SELECT count(*)::int FROM public.school_memberships m WHERE m.school_id = s.id AND m.status = 'approved' AND m.role_in_school = 'school_admin'),
         (SELECT count(*)::int FROM public.school_memberships m WHERE m.school_id = s.id AND m.status = 'approved' AND m.role_in_school <> 'school_admin'),
         (SELECT count(*)::int FROM public.school_memberships m WHERE m.school_id = s.id AND m.status = 'pending'),
         (SELECT count(*)::int FROM public.classes c WHERE c.school_id = s.id),
         (SELECT count(*)::int FROM public.students st WHERE st.school_id = s.id),
         s.plan, s.plan_status, s.plan_expires_at, s.max_staff, s.max_students
    FROM public.schools s
   WHERE s.id = _school_id
     AND (public.is_school_member(auth.uid(), s.id) OR public.is_master(auth.uid()))
$$;

GRANT EXECUTE ON FUNCTION public.school_usage(uuid) TO authenticated;

-- 5. Staff list for a school (admins of that school, or master)
CREATE OR REPLACE FUNCTION public.school_staff(_school_id uuid)
RETURNS TABLE (
  membership_id uuid,
  user_id uuid,
  name text,
  email text,
  role_in_school text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.user_id, coalesce(p.name, ''), coalesce(p.email, ''),
         m.role_in_school::text, m.status::text, m.created_at
    FROM public.school_memberships m
    LEFT JOIN public.profiles p ON p.id = m.user_id
   WHERE m.school_id = _school_id
     AND (public.is_school_admin(auth.uid(), _school_id) OR public.is_master(auth.uid()))
   ORDER BY m.status, m.role_in_school, coalesce(p.name, '')
$$;

GRANT EXECUTE ON FUNCTION public.school_staff(uuid) TO authenticated;