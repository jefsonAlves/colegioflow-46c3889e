-- Fix privilege escalation in school_memberships
-- 1. Update the INSERT policy to prevent self-admin requests
DROP POLICY IF EXISTS "memberships insert" ON public.school_memberships;
CREATE POLICY "memberships insert"
ON public.school_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  is_master(auth.uid()) OR 
  is_school_admin(auth.uid(), school_id) OR 
  (
    user_id = auth.uid() AND 
    status = 'pending' AND 
    role_in_school IN ('teacher', 'coordinator') -- Prevent self-admin requests
  )
);

-- 2. Update the UPDATE policy to prevent self-approval and restrict school_admin updates to master users
DROP POLICY IF EXISTS "memberships update admin or master" ON public.school_memberships;
CREATE POLICY "memberships update admin or master"
ON public.school_memberships
FOR UPDATE
TO authenticated
USING (
  CASE
    WHEN role_in_school = 'school_admin' THEN is_master(auth.uid()) -- Only master can edit school_admin rows
    ELSE (is_school_admin(auth.uid(), school_id) OR is_master(auth.uid()))
  END
)
WITH CHECK (
  CASE
    WHEN role_in_school = 'school_admin' THEN is_master(auth.uid()) -- Only master can edit school_admin rows
    ELSE (is_school_admin(auth.uid(), school_id) OR is_master(auth.uid()))
  END
);

-- 3. Update the DELETE policy for consistency
DROP POLICY IF EXISTS "memberships delete admin or master" ON public.school_memberships;
CREATE POLICY "memberships delete admin or master"
ON public.school_memberships
FOR DELETE
TO authenticated
USING (
  CASE
    WHEN role_in_school = 'school_admin' THEN is_master(auth.uid())
    ELSE (is_school_admin(auth.uid(), school_id) OR is_master(auth.uid()))
  END
);
