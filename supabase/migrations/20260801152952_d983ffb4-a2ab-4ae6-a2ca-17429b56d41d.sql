REVOKE ALL ON FUNCTION public.master_set_school_plan(uuid, text, text, date, integer, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.master_schools_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_usage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_set_school_plan(uuid, text, text, date, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_schools_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_staff(uuid) TO authenticated;