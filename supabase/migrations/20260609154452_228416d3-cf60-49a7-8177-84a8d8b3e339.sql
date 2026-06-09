
-- Upgrade existing membership (any role/status) to approved school_admin when user is the school creator
UPDATE public.school_memberships m
SET role_in_school = 'school_admin', status = 'approved', approved_by = m.user_id
FROM public.schools s
WHERE m.school_id = s.id AND m.user_id = s.created_by
  AND (m.role_in_school <> 'school_admin' OR m.status <> 'approved');

-- Insert missing memberships for creators with no row at all
INSERT INTO public.school_memberships (school_id, user_id, role_in_school, status, approved_by)
SELECT s.id, s.created_by, 'school_admin'::role_in_school, 'approved'::membership_status, s.created_by
FROM public.schools s
WHERE NOT EXISTS (
  SELECT 1 FROM public.school_memberships m
  WHERE m.school_id = s.id AND m.user_id = s.created_by
);
