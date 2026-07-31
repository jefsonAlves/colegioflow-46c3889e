REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_apply_cert() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_att_check_cert() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_apply_cert() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_att_check_cert() FROM authenticated;