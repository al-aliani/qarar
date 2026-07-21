-- ══════════════════════════════════════════════════════════════════════════
-- تدقيق 2026-07-21 (بندان #46/#47): دالتان بلا أي حدّ لمعدّل الاستدعاء يمكن
-- استدعاؤهما مباشرة من anon بلا تسجيل دخول — إغراق محتمل (تكلفة تخزين + تعطيل).
-- ══════════════════════════════════════════════════════════════════════════

-- 1) add_share_feedback: حدّ 10 ملاحظات لكل رابط مشاركة خلال ساعة — كافٍ لأي
--    تفاعل بشري طبيعي (زائر واحد لن يرسل أكثر من بضع ملاحظات)، ويمنع إغراق آلي.
create or replace function public.add_share_feedback(
  p_token uuid,
  p_kind text,
  p_author_name text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share_id uuid;
  v_feedback_id uuid;
  v_recent_count int;
begin
  select id into v_share_id
  from public.study_shares
  where share_token = p_token
    and revoked = false
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_share_id is null then
    raise exception 'رابط المشاركة غير صالح أو منتهي';
  end if;
  if p_kind not in ('comment', 'revision_request') then
    raise exception 'نوع الملاحظة غير صالح';
  end if;

  select count(*) into v_recent_count
  from public.study_share_feedback
  where share_id = v_share_id
    and created_at > now() - interval '1 hour';
  if v_recent_count >= 10 then
    raise exception 'عدد كبير من الملاحظات على هذا الرابط خلال ساعة — حاول لاحقاً';
  end if;

  insert into public.study_share_feedback (share_id, kind, author_name, body)
  values (v_share_id, p_kind, nullif(trim(p_author_name), ''), trim(p_body))
  returning id into v_feedback_id;
  return v_feedback_id;
end;
$$;

-- 2) events: يستبدل سياسة الإدراج المفتوحة بدالة SECURITY DEFINER تفرض حدّاً
--    (500 حدث لكل session_id خلال 10 دقائق — سخي لاستخدام تحليلات طبيعي حتى في
--    معالج طويل، لكنه يمنع إغراقاً آلياً). trackEvent() في web/js/utils/analytics.js
--    يستدعي insert مباشرة عبر supabase-js؛ الدالة تحلّ محله بنفس التوقيع منطقياً.
drop policy if exists "events_insert_any" on public.events;

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
  if p_session_id is not null then
    select count(*) into v_recent_count
    from public.events
    where session_id = p_session_id
      and created_at > now() - interval '10 minutes';
    if v_recent_count >= 500 then
      return; -- تجاهل صامت (لا نكسر تجربة المستخدم لحدث تحليلي غير حرج)
    end if;
  end if;

  insert into public.events (user_id, session_id, event_name, props)
  values (auth.uid(), p_session_id, p_event_name, coalesce(p_props, '{}'::jsonb));
end;
$$;

grant execute on function public.track_event(text, jsonb, text) to anon, authenticated;

-- web/js/utils/analytics.js حُوِّل بنفس الالتزام إلى supabase.rpc('track_event', ...)
-- بدل .insert() المباشر — الحدّ فعّال من الطرفين معاً.
