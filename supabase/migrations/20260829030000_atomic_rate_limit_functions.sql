-- ══════════════════════════════════════════════════════════════════════════
-- تدقيق 2026-08-29: rateLimit.ts وanonRateLimit.ts ينفّذان الحدّ كـ"تحقق-ثم-
-- تسجيل" (check-then-increment): SELECT count(*) للتحقق من الحد، ثم — فقط إن
-- كان دون الحد — INSERT منفصل (استدعاء شبكي ثانٍ مستقل) لتسجيل الطلب. طلبان
-- متزامنان فعلياً من نفس المستخدم/الـIP قد ينفّذان كلاهما SELECT قبل أن
-- يلتزم (commit) أيّ منهما INSERT — فيرى كلاهما "دون الحد" ويكملان معاً،
-- فيتجاوز عدد الطلبات الفعلي الحدَّ المفروض بمقدار عدد الطلبات المتزامنة
-- تقريباً. هذا يُبطل الغرض الأمني للحدّ تحديداً في سيناريو "إغراق دفعة
-- واحدة" (burst abuse) الذي صُمِّم أصلاً لمنعه.
--
-- الإصلاح: دالة SECURITY DEFINER واحدة لكل جدول تُنفِّذ التحقق والتسجيل معاً
-- داخل جسم دالة واحدة، يستدعيها العميل عبر استدعاء RPC واحد فقط (نفس اصطلاح
-- generate_certificate_id/track_event القائم أصلاً في هذا المشروع). لكن مجرّد
-- تجميع الخطوتين داخل دالة واحدة *لا يكفي وحده*: بلا قفل صريح، معاملتان
-- متزامنتان (كل استدعاء RPC هو معاملته الضمنية المنفصلة) تستطيعان كلتاهما
-- تنفيذ SELECT الخاص بها قبل أن تلتزم INSERT الأخرى — نفس السباق تماماً،
-- فقط مُنقولاً إلى داخل الدالة بدل عبر الشبكة. الحل الفعلي: pg_advisory_xact_
-- lock بمفتاح مُشتقّ من (المعرّف، اسم الدالة) في أول سطر تنفيذي بجسم الدالة —
-- يُسلسِل الاستدعاءات المتزامنة لنفس المفتاح تحديداً فقط (لا يحجب مستخدمين/
-- دوال أخرى غير متعلّقة عن بعضها)، ويُحرَّر تلقائياً عند التزام أو تراجع
-- المعاملة (لاحقة _xact لا _session). بذلك يُنفَّذ "تحقق ثم سجّل" بأكمله كوحدة
-- ذرّية فعلية لكل مفتاح: الاستدعاء الثاني المتزامن ينتظر التزام الأول، ثم
-- يقرأ العدّ *بعد* أن أصبح صف الأول مرئياً فعلاً — لا يمكنه رؤية حالة قديمة.
--
-- لماذا ليس قيداً فريداً (نمط orders_provider_ref_unique المستخدم لمنع تكرار
-- webhook): ذاك القيد يمنع *تكرار قيمة معيّنة بعينها*، بينما الحاجة هنا عدّ
-- ضمن نافذة زمنية متحركة (sliding window) بعدد صفوف — لا يوجد عمود واحد
-- يصلح مفتاحاً فريداً لهذا الغرض بلا تغيير جوهري لنموذج البيانات بأكمله (من
-- سجل أحداث زمني إلى عدّاد بمخزن ثابت لكل نافذة)، وهو تغيير أكبر من اللازم
-- لإصلاح سباق تزامن فقط.
--
-- لا grant execute هنا عمداً (نفس اصطلاح generate_certificate_id تماماً):
-- الاستدعاء الوحيد المخطَّط له عبر adminClient بمفتاح service_role داخل Edge
-- Functions، والذي يملك صلاحية التنفيذ ضمنياً أصلاً. لا نمنح anon/authenticated
-- تنفيذ هذه الدالة — معاملاتها (p_user_id/p_identifier_hash) تصل كوسيطة خام
-- بلا أي ربط بـauth.uid()، فمنح تنفيذها لعميل غير موثوق كان يسمح بتسميم عدّاد
-- حدّ أي مستخدم آخر (حجب خدمة مستهدف) — على عكس add_share_feedback/track_event
-- المصمَّمتين للاستدعاء المباشر من العميل بمعاملات لا تسمح بانتحال هوية الغير.
--
-- تنبيه صريح لأي تعديل مستقبلي: هذا الغياب المتعمَّد لـGRANT EXECUTE يخالف
-- ظاهرياً نمط 19 دالة RPC أخرى بهذا المشروع (get_study_by_share_token،
-- track_event، add_share_feedback، admin_*_stats...) والتي تملك جميعها
-- GRANT EXECUTE صريحاً لـanon/authenticated — هذا التفاوت مقصود لا سهو، لأن
-- تلك الدوال جميعها تُقيَّد معاملاتها بـauth.uid()/رمز مشاركة عشوائي، بخلاف
-- دالتَي حدّ المعدّل هنا اللتين تقبلان معرّف هوية خام كوسيطة صريحة. لا تُضِف
-- GRANT EXECUTE هنا لـ"توحيد النمط" — ذلك يُعيد فتح ثغرة حجب الخدمة الموصوفة
-- أعلاه.
--
-- الطبقة الثانية (دفاع في العمق مستقل تماماً عن غياب GRANT EXECUTE أعلاه):
-- كلا الجدولين اللذين تقرأ/تكتب فيهما هاتان الدالتان — public.rate_limit_events
-- (migration 20260821010000) وpublic.anon_endpoint_hits (migration
-- 20260827030000) — لديهما RLS مُفعَّلة (enable row level security) بصفر
-- سياسات لأي دور إطلاقاً (لا select ولا insert ولا update ولا delete لـanon
-- أو authenticated)، كما توثِّق كلتا الترحيلتين صراحة في حينهما ("عمداً: لا
-- سياسة... رفض تام"). هذا ليس فجوة نسيان بل الوضع الافتراضي الصحيح المقصود:
-- حتى لو حاول عميل تجاوز الدالتين أعلاه تماماً والوصول لهذين الجدولين مباشرة
-- عبر PostgREST (bypassing الـRPC)، الرفض الافتراضي لـRLS بلا أي سياسة مطابقة
-- يمنعه بشكل مستقل — طبقتا حماية منفصلتان (غياب GRANT + RLS رفض-افتراضي)، لا
-- طبقة واحدة يُغني وجودها عن الأخرى.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.check_and_record_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - (p_window_seconds || ' seconds')::interval;
  v_count integer;
  v_oldest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_endpoint, 0));

  select count(*), min(created_at) into v_count, v_oldest
    from public.rate_limit_events
    where user_id = p_user_id
      and endpoint = p_endpoint
      and created_at >= v_since;

  if v_count >= p_max_requests then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_oldest + (p_window_seconds || ' seconds')::interval - now()))))::integer;
    return;
  end if;

  insert into public.rate_limit_events (user_id, endpoint) values (p_user_id, p_endpoint);
  return query select true, null::integer;
end;
$$;

-- نظير anon_endpoint_hits (حدّ بمعرّف IP مُجزَّأ لا user_id) — نفس آلية القفل
-- الاستشاري بالضبط، جدول وعمود مفتاح مختلفان فقط (الفصل بين الجدولين مقصود،
-- انظر توثيق anonRateLimit.ts وmigration 20260827030000).
create or replace function public.check_and_record_anon_rate_limit(
  p_identifier_hash text,
  p_endpoint text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - (p_window_seconds || ' seconds')::interval;
  v_count integer;
  v_oldest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_identifier_hash || ':' || p_endpoint, 0));

  select count(*), min(created_at) into v_count, v_oldest
    from public.anon_endpoint_hits
    where identifier_hash = p_identifier_hash
      and endpoint = p_endpoint
      and created_at >= v_since;

  if v_count >= p_max_requests then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_oldest + (p_window_seconds || ' seconds')::interval - now()))))::integer;
    return;
  end if;

  insert into public.anon_endpoint_hits (endpoint, identifier_hash) values (p_endpoint, p_identifier_hash);
  return query select true, null::integer;
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (SQL Editor) — يثبت الذرّية فعلياً بمعاملتين متزامنتين
-- حقيقيتين (لا مجرد استدعاءين متتاليين، اللذين ينجحان دوماً حتى بالكود القديم):
--
--   -- جلسة 1: ابدأ معاملة وتوقّف *قبل* التزامها (تحاكي طلباً بطيء الإتمام)
--   begin;
--   select * from public.check_and_record_rate_limit(
--     '00000000-0000-0000-0000-000000000001'::uuid, 'demo-endpoint', 1, 60);
--   -- (لا commit بعد — اترك الجلسة مفتوحة)
--
--   -- جلسة 2 (نافذة SQL Editor أخرى، بينما جلسة 1 لا تزال مفتوحة): يجب أن
--   -- تنتظر (تتعلّق) حتى تُغلَق جلسة 1 — إثبات القفل يعمل فعلاً لا مجرد توثيق:
--   select * from public.check_and_record_rate_limit(
--     '00000000-0000-0000-0000-000000000001'::uuid, 'demo-endpoint', 1, 60);
--
--   -- أنهِ جلسة 1: commit; — عندها فقط تكمل جلسة 2 وتُعيد allowed=false
--   -- (رأت صف جلسة 1 المُلتزَم فعلاً، لا حالة قديمة سابقة للقفل).
-- ══════════════════════════════════════════════════════════════════════════
