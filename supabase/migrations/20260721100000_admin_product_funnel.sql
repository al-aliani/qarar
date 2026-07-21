-- Product funnel metrics for the admin operations dashboard.
create or replace function public.admin_product_funnel_stats(days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  with completion_pairs as (
    select s.session_id,
           min(s.created_at) filter (where s.event_name = 'study_start') as started_at,
           max(s.created_at) filter (where s.event_name = 'study_complete') as completed_at
    from public.events s
    where s.created_at > now() - (days || ' days')::interval
      and s.session_id is not null
      and s.event_name in ('study_start', 'study_complete')
    group by s.session_id
  )
  select jsonb_build_object(
    'new_studies', (select count(*) from public.studies where created_at > now() - (days || ' days')::interval),
    'study_created_events', (select count(*) from public.events where event_name = 'study_created' and created_at > now() - (days || ' days')::interval),
    'paid_users', (select count(*) from public.profiles where subscription_tier in ('pro', 'enterprise')),
    'free_users', (select count(*) from public.profiles where coalesce(subscription_tier, 'free') = 'free'),
    'paid_orders', (select count(*) from public.orders where status = 'paid' and paid_at > now() - (days || ' days')::interval),
    'payment_errors',
      (select count(*) from public.events where event_name = 'payment_error' and created_at > now() - (days || ' days')::interval)
      + (select count(*) from public.orders where status = 'failed' and created_at > now() - (days || ' days')::interval),
    'avg_completion_minutes', (
      select round(avg(extract(epoch from (completed_at - started_at)) / 60)::numeric, 1)
      from completion_pairs
      where started_at is not null and completed_at is not null and completed_at >= started_at
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_product_funnel_stats(int) to authenticated;
