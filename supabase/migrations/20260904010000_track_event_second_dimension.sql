-- إصلاح أمني (تدقيق 2026-09-04): حدّ معدّل track_event كان محسوباً **لكل
-- session_id فقط** — وsession_id يرسله العميل بنفسه.
--
-- الاستغلال: مهاجم بلا حساب، بمفتاح anon المستخرج من حزمة الواجهة (عمومي بحكم
-- التصميم)، يرسل session_id عشوائياً جديداً مع كل نداء ⟶ العدّ دائماً صفر ⟶
-- إدراج غير محدود في public.events، حتى 4KB لكل صف (events_props_size_limit).
-- عند 100 طلب/ثانية ≈ 34 GB يومياً في جدول مفهرس — فاتورة تخزين وتدهور أداء على
-- نفس القاعدة التي تخدم العملاء الدافعين.
--
-- الإصلاح السابق (20260722091000) عالج حالة session_id = null فقط، لا التدوير.
--
-- ── العلاج: بُعد ثانٍ لا يتحكم فيه العميل ───────────────────────────────────
--
--   • المستخدم المسجَّل ⟶ auth.uid()، يشتقّه الخادم من JWT ولا يُرسله العميل.
--     تدوير session_id لا يفيده إطلاقاً.
--
--   • الزائر المجهول ⟶ سقف عام لكل الأحداث المجهولة في النافذة (قاطع تيار).
--
-- ── لماذا سقف عام لا تقييد بعنوان IP ───────────────────────────────────────
--
-- التقييد بـIP يتطلّب تخزين معرّف للزائر. وجدول public.events **بلا عمود IP
-- عمداً**، وهي خاصية خصوصية حقيقية أثبتها التدقيق الأمني اليوم. إدخال IP (أو
-- حتى بصمته) داخل props يعكس هذه الخاصية لأجل حدّ معدّل — ثمن غير متناسب،
-- خصوصاً مع نظام حماية البيانات الشخصية السعودي.
--
-- والبديل الثاني — تمرير كل حدث عبر public.anon_endpoint_hits (البنية القائمة
-- لحدّ المعدّل المجهول) — يُسجّل صفاً إضافياً لكل حدث تحليلي، فيضاعف حجم
-- الكتابة على مسار عالي التردد بطبيعته لحماية من إغراق.
--
-- المقايضة المقبولة صراحةً: أثناء إغراق فعلي قد تُهمَل أحداث تحليلية لزوّار
-- شرعيين حتى نهاية النافذة. هذه خسارة غير حرجة — الدالة أصلاً تتجاهل بصمت عند
-- بلوغ الحد (لا تكسر تجربة المستخدم) — مقابل حماية القاعدة نفسها، وهي الأصل
-- الحقيقي. السقف مختار بهامش واسع جداً فوق الاستخدام الشرعي: 20,000 حدث مجهول
-- كل 10 دقائق ≈ 33 حدثاً/ثانية متواصلة، أضعاف حركة المنصة الفعلية اليوم، وأقل
-- بكثير من معدّل الإغراق الموصوف أعلاه.

-- عدّ لكل مستخدم في نافذة زمنية بلا فهرس = مسح كامل للجدول عند كل حدث.
create index if not exists events_user_id_created_idx
  on public.events (user_id, created_at)
  where user_id is not null;

-- السقف العام للزوّار المجهولين يقرأ (user_id is null, created_at).
create index if not exists events_anon_created_idx
  on public.events (created_at)
  where user_id is null;

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
  v_uid uuid := auth.uid();
begin
  if p_session_id is null or trim(p_session_id) = '' then
    return; -- بلا session_id لا يمكن تطبيق حدّ المعدّل — تجاهل صامت بدل قبول غير محدود
  end if;

  -- البُعد الأول: لكل جلسة (كما كان) — يحمي من جلسة واحدة جامحة.
  select count(*) into v_recent_count
  from public.events
  where session_id = p_session_id
    and created_at > now() - interval '10 minutes';
  if v_recent_count >= 500 then
    return; -- تجاهل صامت (لا نكسر تجربة المستخدم لحدث تحليلي غير حرج)
  end if;

  -- البُعد الثاني: لا يتحكم فيه العميل — يحمي من تدوير session_id.
  if v_uid is not null then
    select count(*) into v_recent_count
    from public.events
    where user_id = v_uid
      and created_at > now() - interval '10 minutes';
    if v_recent_count >= 1500 then
      return;
    end if;
  else
    select count(*) into v_recent_count
    from public.events
    where user_id is null
      and created_at > now() - interval '10 minutes';
    if v_recent_count >= 20000 then
      return;
    end if;
  end if;

  insert into public.events (user_id, session_id, event_name, props)
  values (v_uid, p_session_id, p_event_name, coalesce(p_props, '{}'::jsonb));
end;
$$;

grant execute on function public.track_event(text, jsonb, text) to anon, authenticated;
