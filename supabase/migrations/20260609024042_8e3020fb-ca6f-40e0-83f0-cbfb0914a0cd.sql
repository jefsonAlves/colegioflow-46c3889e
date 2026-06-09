
-- ============ ENUMS ============
CREATE TYPE public.global_role AS ENUM ('master', 'user');
CREATE TYPE public.profile_type AS ENUM ('teacher', 'school_admin', 'parent');
CREATE TYPE public.school_status AS ENUM ('active', 'pending', 'blocked', 'merged_into');
CREATE TYPE public.membership_status AS ENUM ('pending', 'approved', 'rejected', 'blocked');
CREATE TYPE public.role_in_school AS ENUM ('school_admin', 'teacher', 'coordinator');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  photo_url text,
  profile_type public.profile_type,
  onboarding_complete boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES (master / user) ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.global_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.global_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'master') $$;

-- ============ SCHOOLS ============
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text NOT NULL,
  city text,
  state text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  status public.school_status NOT NULL DEFAULT 'pending',
  merged_into uuid REFERENCES public.schools(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX schools_normalized_name_idx ON public.schools (normalized_name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- ============ SCHOOL MEMBERSHIPS ============
CREATE TABLE public.school_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_school public.role_in_school NOT NULL,
  status public.membership_status NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, role_in_school)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_memberships TO authenticated;
GRANT ALL ON public.school_memberships TO service_role;
ALTER TABLE public.school_memberships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_school_admin(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE user_id = _user_id AND school_id = _school_id
      AND role_in_school = 'school_admin' AND status = 'approved'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_school_member(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE user_id = _user_id AND school_id = _school_id AND status = 'approved'
  )
$$;

-- ============ CLASSES ============
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  year int NOT NULL,
  teacher_uid uuid REFERENCES auth.users(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- ============ STUDENTS ============
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  name text NOT NULL,
  guardian_name text,
  guardian_phone text,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- ============ ATTENDANCE ============
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date date NOT NULL,
  present boolean NOT NULL,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ============ GRADES ============
CREATE TABLE public.grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  trimester int NOT NULL CHECK (trimester BETWEEN 1 AND 4),
  subject text NOT NULL DEFAULT 'Geral',
  value numeric(5,2) NOT NULL,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id, trimester, subject)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grades TO authenticated;
GRANT ALL ON public.grades TO service_role;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- ============ DISCIPLINARY ============
CREATE TABLE public.disciplinary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date date NOT NULL,
  severity text NOT NULL DEFAULT 'verbal',
  description text NOT NULL,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplinary TO authenticated;
GRANT ALL ON public.disciplinary TO service_role;
ALTER TABLE public.disciplinary ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
-- profiles
CREATE POLICY "profiles select self or master" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update self or master" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_master(auth.uid()));

-- user_roles: read self; only master writes
CREATE POLICY "roles read self or master" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "roles master write" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_master(auth.uid()))
  WITH CHECK (public.is_master(auth.uid()));

-- schools: any auth can read; create allowed; update by creator/master
CREATE POLICY "schools read all auth" ON public.schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "schools insert auth" ON public.schools FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "schools update creator or master" ON public.schools FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "schools delete master" ON public.schools FOR DELETE TO authenticated
  USING (public.is_master(auth.uid()));

-- school_memberships
CREATE POLICY "memberships read self or admin or master" ON public.school_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));
CREATE POLICY "memberships insert self" ON public.school_memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "memberships update admin or master" ON public.school_memberships FOR UPDATE TO authenticated
  USING (public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid(), school_id) OR public.is_master(auth.uid()));
CREATE POLICY "memberships delete master" ON public.school_memberships FOR DELETE TO authenticated
  USING (public.is_master(auth.uid()));

-- classes / students / attendance / grades / disciplinary: school members or master
CREATE POLICY "classes rw members" ON public.classes FOR ALL TO authenticated
  USING (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()))
  WITH CHECK (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE POLICY "students rw members" ON public.students FOR ALL TO authenticated
  USING (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()))
  WITH CHECK (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE POLICY "attendance rw members" ON public.attendance FOR ALL TO authenticated
  USING (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()))
  WITH CHECK (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE POLICY "grades rw members" ON public.grades FOR ALL TO authenticated
  USING (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()))
  WITH CHECK (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()));

CREATE POLICY "disciplinary rw members" ON public.disciplinary FOR ALL TO authenticated
  USING (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()))
  WITH CHECK (public.is_school_member(auth.uid(), school_id) OR public.is_master(auth.uid()));

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ handle_new_user: auto-create profile + assign role ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_master boolean;
BEGIN
  _is_master := lower(coalesce(NEW.email, '')) = 'jefson.ti@gmail.com';

  INSERT INTO public.profiles (id, name, email, photo_url, onboarding_complete)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    coalesce(NEW.email, ''),
    NEW.raw_user_meta_data->>'avatar_url',
    false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _is_master THEN 'master'::public.global_role ELSE 'user'::public.global_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
