-- Trigger-only functions: revoke all direct EXECUTE
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_max_campaign_sender_domains() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_max_sender_domains() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bootstrap_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_last_admin_removal() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies; signed-in users must execute it, anon must not
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;