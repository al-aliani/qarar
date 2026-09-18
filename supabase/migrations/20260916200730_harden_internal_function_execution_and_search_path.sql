-- Trigger functions are invoked by their triggers, never through PostgREST.
-- Keep their EXECUTE privilege away from public API roles.
revoke execute on function public.decrement_projects_count() from public, anon, authenticated;
revoke execute on function public.handle_new_ticket_message() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.increment_coupon_usage() from public, anon, authenticated;
revoke execute on function public.increment_projects_count() from public, anon, authenticated;
revoke execute on function public.protect_phone_verified() from public, anon, authenticated;
revoke execute on function public.protect_profile_privileged_columns() from public, anon, authenticated;

-- Internal maintenance and certificate allocation run through pg_cron or a
-- trusted service-role Edge Function.
revoke execute on function public.check_stale_studies() from public, anon, authenticated;
grant execute on function public.check_stale_studies() to service_role;

revoke execute on function public.generate_certificate_id() from public, anon, authenticated;
grant execute on function public.generate_certificate_id() to service_role;

-- The application calls this maintenance helper after sign-in.  Anonymous
-- callers do not need it, while authenticated and service-role callers do.
revoke execute on function public.expire_stale_pending_orders() from public, anon;
grant execute on function public.expire_stale_pending_orders() to authenticated, service_role;

-- Pin the lookup path for trigger helpers flagged by the database advisor.
alter function public.update_updated_at() set search_path = pg_catalog, public;
alter function public.set_consultation_price() set search_path = pg_catalog, public;
alter function public.sync_order_paid_amounts() set search_path = pg_catalog, public;
alter function public.notifications_restrict_update_columns() set search_path = pg_catalog, public;

-- New functions created by postgres start private. Public RPCs must opt in with
-- an explicit GRANT, which makes their exposure reviewable in migrations.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
