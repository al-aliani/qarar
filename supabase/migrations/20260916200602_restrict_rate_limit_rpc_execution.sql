-- These SECURITY DEFINER helpers are called only by trusted Edge Functions
-- through a service-role client.  PostgreSQL grants EXECUTE to PUBLIC on new
-- functions unless it is explicitly revoked, which made the caller-supplied
-- identity and rate-limit parameters reachable through the public RPC API.

revoke execute on function public.check_and_record_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_and_record_rate_limit(uuid, text, integer, integer)
  to service_role;

revoke execute on function public.check_and_record_anon_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_and_record_anon_rate_limit(text, text, integer, integer)
  to service_role;

-- Cleanup is maintenance-only and must not be exposed as a public RPC.
revoke execute on function public.cleanup_old_rate_limit_events()
  from public, anon, authenticated;
grant execute on function public.cleanup_old_rate_limit_events()
  to service_role;
