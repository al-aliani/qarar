-- ═══════════════════════════════════════════════════════════════════════
-- إصلاح ثغرة (تدقيق حي 2026-07-22): track_event() في 20260721190000_rate_limits.sql
-- كان حدّ المعدّل (500/10 دقائق) مشروطاً بالكامل بـ`if p_session_id is not null`
-- — وp_session_id معامل اختياري افتراضه null. استدعاء `select public.track_event('x')`
-- مباشرة عبر REST RPC بمفتاح anon (بلا تسجيل دخول، وبلا p_session_id) يتجاوز الشرط
-- بالكامل فينتقل مباشرة لإدراج غير محدود — بالضبط الإغراق الذي صُمم هذا الملف لمنعه.
--
-- العميل الشرعي (web/js/utils/analytics.js) يُرسل دائماً session_id حقيقياً
-- (sessionStorage عشوائي) فلا يتأثر بجعل المعامل إلزامياً فعلياً.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.track_event(
  p_event_name text,
  p_props jsonb default '{}'::jsonb,
  p_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count int;
begin
  if p_session_id is null or trim(p_session_id) = '' then
    return; -- بلا session_id لا يمكن تطبيق حدّ المعدّل — تجاهل صامت بدل قبول غير محدود
  end if;

  select count(*) into v_recent_count
  from public.events
  where session_id = p_session_id
    and created_at > now() - interval '10 minutes';
  if v_recent_count >= 500 then
    return; -- تجاهل صامت (لا نكسر تجربة المستخدم لحدث تحليلي غير حرج)
  end if;

  insert into public.events (user_id, session_id, event_name, props)
  values (auth.uid(), p_session_id, p_event_name, coalesce(p_props, '{}'::jsonb));
end;
$$;
