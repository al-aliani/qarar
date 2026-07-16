-- ═══════════════════════════════════════════════════════════════════════
-- لوحة تحكم الأدمن (2026-07-16) — لا يوجد أي مفهوم "أدمن" في المشروع قبل هذا
-- الترحيل (تحقق: صفر جداول/أعمدة/دوال role في كل الكود). هذا الترحيل يضيف:
--   1) عضوية أدمن صريحة (جدول admins، بنفس نمط reviewers — لا صلاحيات ضمنية
--      من أي دور Supabase، ولا واجهة تسجيل ذاتي).
--   2) جدول events لتتبّع سلوك حقيقي (كان trackEvent() قبل هذا معطّلاً
--      تماماً — بلا وجهة، بلا قارئ، استخدامان فقط في كل المشروع).
--   3) دوال RPC مجمِّعة (security definer) تتجاوز RLS عمداً لعرض بيانات كل
--      المستخدمين للأدمن فقط — كل دالة تتحقق من admins داخلياً أولاً، بنفس
--      مبدأ get_public_usage_stats لكن بحماية إضافية بدل الفتح للعموم.
--
-- تجنيد الأدمن (v1 — نفس تقليص النطاق المتعمَّد المستخدم مع reviewers): لا
-- توجد واجهة تسجيل. صاحب الموقع يُدرج نفسه يدوياً عبر Supabase Dashboard →
-- SQL Editor:
--   insert into public.admins (id, email)
--   values ('<auth.users.id الخاص بالمالك>', '<بريد المالك>');
-- ═══════════════════════════════════════════════════════════════════════

-- 1) جدول الأدمن — عضوية صريحة فقط
create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- كل أدمن يرى صفّه فقط (يكفي لتحقق isAdmin() من الواجهة).
drop policy if exists "admins_select_own" on public.admins;
create policy "admins_select_own"
  on public.admins for select
  using (auth.uid() = id);

-- دالة تحقق قابلة لإعادة الاستخدام داخل كل دوال admin_*_stats أدناه — نفس
-- شكل is_reviewer_of_study في 20260713000000_reviewer_portal.sql حرفياً.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where id = uid);
$$;

-- 2) جدول أحداث السلوك — trackEvent() الحالي (web/js/utils/analytics.js)
-- سيكتب هنا مباشرة من المتصفح (مستخدم مسجَّل أو زائر مجهول على صفحة الهبوط).
create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  session_id text,
  event_name text not null check (char_length(event_name) <= 100),
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_name_created_idx on public.events (event_name, created_at);

alter table public.events enable row level security;

-- إدراج فقط لأي زائر (مسجَّل أو مجهول) — عمداً لا سياسة select/update/delete
-- لغير الأدمن؛ القراءة تمر حصراً عبر دوال admin_events_stats أدناه.
drop policy if exists "events_insert_any" on public.events;
create policy "events_insert_any"
  on public.events for insert
  to authenticated, anon
  with check (true);

-- 3) دوال RPC مجمِّعة للأدمن — plpgsql لا sql (بخلاف باقي دوال المشروع)
-- لأنها تحتاج شرط raise exception قبل التجميع، وهذا غير ممكن بلغة sql
-- الأحادية-الجملة المستخدمة في باقي الترحيلات.

create or replace function public.admin_overview_stats()
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

  select jsonb_build_object(
    'total_studies', (select count(*) from public.studies),
    'total_users', (select count(*) from public.profiles),
    'total_revenue_sar', (select coalesce(sum(amount_sar), 0) from public.orders where status = 'paid'),
    'pending_reviews', (select count(*) from public.orders where review_status in ('queued', 'in_review')),
    'active_shares', (select count(*) from public.study_shares where not revoked and (expires_at is null or expires_at > now()))
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_overview_stats() to authenticated;

create or replace function public.admin_studies_stats()
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

  select jsonb_build_object(
    'total', (select count(*) from public.studies),
    'templates', (select count(*) from public.studies where is_template),
    'by_status', (
      select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (select status, count(*) cnt from public.studies group by status) s
    ),
    'by_sector', (
      select coalesce(jsonb_agg(jsonb_build_object('sector', sector, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (select coalesce(sector, 'غير محدد') sector, count(*) cnt from public.studies group by 1) s
    ),
    'daily_created', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) order by day), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date day, count(*) cnt
        from public.studies
        where created_at > now() - interval '90 days'
        group by 1
      ) s
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_studies_stats() to authenticated;

create or replace function public.admin_users_stats()
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

  select jsonb_build_object(
    'total', (select count(*) from public.profiles),
    'by_tier', (
      select coalesce(jsonb_agg(jsonb_build_object('tier', tier, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (select coalesce(subscription_tier, 'free') tier, count(*) cnt from public.profiles group by 1) s
    ),
    'daily_signups', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) order by day), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date day, count(*) cnt
        from public.profiles
        where created_at > now() - interval '90 days'
        group by 1
      ) s
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_users_stats() to authenticated;

create or replace function public.admin_revenue_stats()
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

  select jsonb_build_object(
    'total_revenue_sar', (select coalesce(sum(amount_sar), 0) from public.orders where status = 'paid'),
    'avg_order_value_sar', (select coalesce(round(avg(amount_sar), 2), 0) from public.orders where status = 'paid'),
    'by_tier', (
      select coalesce(jsonb_agg(jsonb_build_object('tier', tier, 'count', cnt, 'revenue_sar', revenue)), '[]'::jsonb)
      from (
        select tier, count(*) cnt, coalesce(sum(amount_sar) filter (where status = 'paid'), 0) revenue
        from public.orders group by tier
      ) s
    ),
    'by_provider', (
      select coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'count', cnt, 'revenue_sar', revenue)), '[]'::jsonb)
      from (
        select provider, count(*) cnt, coalesce(sum(amount_sar) filter (where status = 'paid'), 0) revenue
        from public.orders group by provider
      ) s
    ),
    'by_status', (
      select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (select status, count(*) cnt from public.orders group by status) s
    ),
    'daily_revenue', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'revenue_sar', revenue) order by day), '[]'::jsonb)
      from (
        select date_trunc('day', paid_at)::date day, sum(amount_sar) revenue
        from public.orders
        where status = 'paid' and paid_at > now() - interval '90 days'
        group by 1
      ) s
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_revenue_stats() to authenticated;

create or replace function public.admin_reviewer_stats()
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

  select jsonb_build_object(
    'queued', (select count(*) from public.orders where review_status = 'queued'),
    'in_review', (select count(*) from public.orders where review_status = 'in_review'),
    'certified_total', (select count(*) from public.orders where review_status = 'certified'),
    'rejected_total', (select count(*) from public.orders where review_status = 'rejected'),
    'avg_turnaround_hours', (
      select round(coalesce(avg(extract(epoch from (reviewed_at - paid_at)) / 3600), 0)::numeric, 1)
      from public.orders
      where reviewed_at is not null and paid_at is not null
    ),
    'active_reviewers', (select count(*) from public.reviewers where active)
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_reviewer_stats() to authenticated;

create or replace function public.admin_sharing_stats()
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

  select jsonb_build_object(
    'total', (select count(*) from public.study_shares),
    'active', (select count(*) from public.study_shares where not revoked and (expires_at is null or expires_at > now())),
    'revoked', (select count(*) from public.study_shares where revoked),
    'expired', (select count(*) from public.study_shares where not revoked and expires_at is not null and expires_at <= now())
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_sharing_stats() to authenticated;

-- دالة عامة واحدة لكل تجميعات السلوك (بدل دالة منفصلة لكل نوع حدث) —
-- group_by_prop_key يستخرج مفتاحاً من props (مثال: 'stepId'، 'format'، 'type')
-- عبر عامل ->> الآمن (لا SQL ديناميكي، لا خطر حقن).
create or replace function public.admin_events_stats(
  event_name_filter text default null,
  days int default 30,
  group_by_prop_key text default null
)
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

  select jsonb_build_object(
    'totals_by_event', (
      select coalesce(jsonb_agg(jsonb_build_object('event_name', event_name, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (
        select event_name, count(*) cnt
        from public.events
        where created_at > now() - (days || ' days')::interval
        group by event_name
      ) e
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) order by day), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date day, count(*) cnt
        from public.events
        where created_at > now() - (days || ' days')::interval
          and (event_name_filter is null or event_name = event_name_filter)
        group by 1
      ) e
    ),
    'by_prop', (
      select coalesce(jsonb_agg(jsonb_build_object('value', val, 'count', cnt) order by cnt desc), '[]'::jsonb)
      from (
        select coalesce(props ->> group_by_prop_key, 'غير محدد') val, count(*) cnt
        from public.events
        where created_at > now() - (days || ' days')::interval
          and (event_name_filter is null or event_name = event_name_filter)
          and group_by_prop_key is not null
        group by 1
      ) e
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_events_stats(text, int, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (شغّله في SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════
--
-- أ) تأكيد وجود الجداول والدوال:
--   select relname, relrowsecurity from pg_class where relname in ('admins','events');
--   select proname from pg_proc where proname like 'admin_%' or proname = 'is_admin';
--
-- ب) إضافة أول أدمن (استبدل بمعرّف/بريد المالك فعلياً):
--   insert into public.admins (id, email)
--   values ('<auth.users.id للمالك>', '<بريد المالك>');
--
-- ج) محاكاة جلسة غير أدمن — يجب أن يفشل بـ "not authorized":
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000"}';
--   select public.admin_overview_stats();
--   reset role;
--
-- د) محاكاة جلسة الأدمن المُدرَج في (ب) — يجب أن يُرجع بيانات حقيقية:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<auth.users.id للمالك>"}';
--   select public.admin_overview_stats();
--   select public.admin_studies_stats();
--   reset role;
--
-- هـ) إدراج حدث تجريبي والتحقق من تجميعه:
--   set local role anon;
--   insert into public.events (event_name, props, session_id) values ('wizard_step_view', '{"stepId":"test"}', 'sess-1');
--   reset role;
--   -- ثم كأدمن: select public.admin_events_stats(null, 30, 'stepId');
