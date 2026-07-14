-- Lock down the user_profiles trigger function introduced in 00017.
--
-- handle_new_auth_user() runs as SECURITY DEFINER because it needs to bypass RLS
-- to insert into user_profiles when a new auth.users row is created. It is only
-- ever invoked by the AFTER INSERT trigger — never by API clients — so we should
-- revoke EXECUTE from the exposed roles to avoid it being callable via
-- POST /rest/v1/rpc/handle_new_auth_user.

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM authenticated;

-- Pin search_path so a role's search_path can't shadow the function's
-- internal references (handles the function_search_path_mutable advisor warning).
ALTER FUNCTION public.handle_new_auth_user() SET search_path = public, pg_temp;
