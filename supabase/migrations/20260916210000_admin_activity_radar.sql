-- Privacy-preserving operational radar for the admin dashboard.
-- It exposes aggregates and pseudonymous session labels only. It never returns
-- user ids, full session ids, free-text error messages, study contents, or PII.

create or replace function public.admin_activity_radar_stats(window_minutes int default 60)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  result jsonb;
  v_minutes int := greatest(15, least(coalesce(window_minutes, 60), 1440));
  v_from timestamptz := now() - make_interval(mins => greatest(15, least(coalesce(window_minutes, 60), 1440)));
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  with scoped as materialized (
    select
      event_name,
      created_at,
      user_id is not null as authenticated,
      substr(md5(coalesce(session_id, id::text)), 1, 8) as session_label,
      jsonb_build_object(
        'page', left(coalesce(props ->> 'page', props ->> 'surface', ''), 120),
        'step', left(coalesce(props ->> 'stepId', props ->> 'step', ''), 80),
        'source', left(coalesce(props ->> 'utm_source', props ->> 'source', ''), 80),
        'provider', left(coalesce(props ->> 'provider', ''), 40),
        'status', left(coalesce(props ->> 'status', props ->> 'outcome', ''), 40),
        'device', left(coalesce(props ->> 'device_type', ''), 20),
        'browser', left(coalesce(props ->> 'browser', ''), 20),
        'format', left(coalesce(props ->> 'format', ''), 20),
        'duration_ms', case when (props ->> 'duration_ms') ~ '^\d{1,9}$' then (props ->> 'duration_ms')::int end
      ) as safe_props
    from public.events
    where created_at >= v_from
  ), session_rollup as materialized (
    select session_label, bool_or(authenticated) authenticated,
           min(created_at) started_at, max(created_at) last_seen_at,
           count(*) event_count, count(*) filter (where event_name in ('error', 'payment_error', 'login_failed', 'signup_error')) error_count,
           (array_agg(event_name order by created_at desc))[1:6] recent_events
    from scoped group by session_label
  ), current_period as (
    select count(*) event_count,
           count(distinct session_label) session_count,
           count(*) filter (where event_name in ('error', 'payment_error', 'login_failed', 'signup_error')) error_count
    from scoped where created_at >= now() - make_interval(mins => least(v_minutes, 60))
  ), previous_period as (
    select count(*) event_count,
           count(distinct substr(md5(coalesce(session_id, id::text)), 1, 8)) session_count,
           count(*) filter (where event_name in ('error', 'payment_error', 'login_failed', 'signup_error')) error_count
    from public.events
    where created_at >= now() - make_interval(mins => least(v_minutes, 60) * 2)
      and created_at < now() - make_interval(mins => least(v_minutes, 60))
  )
  select jsonb_build_object(
    'generated_at', now(),
    'window_minutes', v_minutes,
    'active_now', (select count(*) from session_rollup where last_seen_at >= now() - interval '5 minutes'),
    'sessions', (select count(*) from session_rollup),
    'authenticated_sessions', (select count(*) from session_rollup where authenticated),
    'events', (select count(*) from scoped),
    'errors', (select count(*) from scoped where event_name in ('error', 'payment_error', 'login_failed', 'signup_error')),
    'current_period', (select to_jsonb(current_period) from current_period),
    'previous_period', (select to_jsonb(previous_period) from previous_period),
    'top_events', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.count desc), '[]'::jsonb)
      from (select event_name, count(*) count, count(distinct session_label) sessions from scoped group by event_name order by 2 desc limit 12) x
    ),
    'top_pages', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.count desc), '[]'::jsonb)
      from (select safe_props ->> 'page' page, count(*) count, count(distinct session_label) sessions
            from scoped where safe_props ->> 'page' <> '' group by 1 order by 2 desc limit 10) x
    ),
    'devices', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.count desc), '[]'::jsonb)
      from (select coalesce(nullif(safe_props ->> 'device', ''), 'unknown') device, count(*) count
            from scoped group by 1 order by 2 desc) x
    ),
    'funnel', jsonb_build_array(
      jsonb_build_object('stage', 'زيارة عامة', 'sessions', (select count(distinct session_label) from scoped where event_name = 'public_page_view')),
      jsonb_build_object('stage', 'بدء دراسة', 'sessions', (select count(distinct session_label) from scoped where event_name = 'study_start')),
      jsonb_build_object('stage', 'إكمال دراسة', 'sessions', (select count(distinct session_label) from scoped where event_name = 'study_complete')),
      jsonb_build_object('stage', 'بدء الدفع', 'sessions', (select count(distinct session_label) from scoped where event_name = 'checkout_start')),
      jsonb_build_object('stage', 'نجاح الدفع', 'sessions', (select count(distinct session_label) from scoped where event_name = 'payment_success'))
    ),
    'recent_activity', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
      from (select created_at, event_name, session_label, authenticated, safe_props from scoped order by created_at desc limit 50) x
    ),
    'active_journeys', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.last_seen_at desc), '[]'::jsonb)
      from (select session_label, authenticated, started_at, last_seen_at, event_count, error_count, recent_events
            from session_rollup order by last_seen_at desc limit 20) x
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.admin_activity_radar_stats(int) from public, anon;
grant execute on function public.admin_activity_radar_stats(int) to authenticated, service_role;

-- Admin RPCs are reachable by signed-in admins only. Each function still keeps
-- its internal is_admin(auth.uid()) check as the second authorization layer.
do $$
declare
  fn record;
begin
  for fn in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin\_%' escape '\'
  loop
    execute format('revoke execute on function %I.%I(%s) from public, anon', fn.nspname, fn.proname, fn.args);
  end loop;
end;
$$;
