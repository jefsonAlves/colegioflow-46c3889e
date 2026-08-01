-- Função para consultar o papel efetivo do usuário em uma escola
CREATE OR REPLACE FUNCTION public.my_school_role(_school_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_master(auth.uid()) THEN 'master'
    ELSE (
      SELECT m.role_in_school::text
        FROM public.school_memberships m
       WHERE m.user_id = auth.uid()
         AND m.school_id = _school_id
         AND m.status = 'approved'
       LIMIT 1
    )
  END
$$;

REVOKE ALL ON FUNCTION public.my_school_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_school_role(uuid) TO authenticated;

-- Alteração de papel por administradores da escola (ou master)
CREATE OR REPLACE FUNCTION public.set_membership_role(_membership_id uuid, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _school uuid;
  _current public.role_in_school;
  _admins int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _role NOT IN ('school_admin','coordinator','teacher') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  SELECT school_id, role_in_school INTO _school, _current
    FROM public.school_memberships WHERE id = _membership_id;
  IF _school IS NULL THEN RAISE EXCEPTION 'membership not found'; END IF;

  IF NOT (public.is_school_admin(auth.uid(), _school) OR public.is_master(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _current = 'school_admin' AND _role <> 'school_admin' THEN
    SELECT count(*) INTO _admins
      FROM public.school_memberships
     WHERE school_id = _school AND status = 'approved' AND role_in_school = 'school_admin';
    IF _admins <= 1 THEN
      RAISE EXCEPTION 'a escola precisa de ao menos um administrador';
    END IF;
  END IF;

  UPDATE public.school_memberships
     SET role_in_school = _role::public.role_in_school
   WHERE id = _membership_id;
END $$;

REVOKE ALL ON FUNCTION public.set_membership_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_membership_role(uuid, text) TO authenticated;