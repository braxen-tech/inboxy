-- The handle_new_auth_user() function (defined in 00023/00029) was never
-- actually wired to auth.users — the trigger itself did not exist, so no
-- signup (org_owner or end_user) ever populated public.users automatically.
-- Existing org_owners had to be backfilled manually.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
