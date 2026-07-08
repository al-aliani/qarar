-- ═══════════════════════════════════════════════════════════════════════
-- ترحيل (migration) قابل لإعادة التشغيل بأمان (idempotent): يفرض RLS على
-- جدول studies برمجياً بدل الاعتماد على تنفيذ يدوي عبر Supabase Dashboard.
-- كان هذا الفرض غائباً تماماً عن أي CI/نشر آلي (تدقيق 2026-07-08):
-- خطأ تشغيلي واحد (نسيان لصق policies.sql يدوياً) = كل الدراسات المالية
-- لكل المستخدمين مكشوفة للقراءة والكتابة عبر مفتاح anon العمومي.
--
-- طريقة التطبيق (يتطلب صلاحية لم تُتوفَّر لهذه الجلسة — خطوة يدوية متبقية):
--   1) supabase link --project-ref <project-ref>
--   2) supabase db push
--   أو: الصق محتوى هذا الملف كاملاً في Supabase Dashboard → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════

-- 1) تفعيل RLS (آمن للتكرار — لا يفشل إن كان مفعّلاً أصلاً)
alter table public.studies enable row level security;

-- 2) إعادة إنشاء السياسات بأمان (drop إن وُجدت، ثم create) — يمنع خطأ
--    "policy already exists" عند إعادة تشغيل هذا الملف على مشروع مُهيَّأ سابقاً.
drop policy if exists "studies_select_own" on public.studies;
create policy "studies_select_own"
  on public.studies for select
  using (auth.uid() = user_id);

drop policy if exists "studies_insert_own" on public.studies;
create policy "studies_insert_own"
  on public.studies for insert
  with check (auth.uid() = user_id);

drop policy if exists "studies_update_own" on public.studies;
create policy "studies_update_own"
  on public.studies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "studies_delete_own" on public.studies;
create policy "studies_delete_own"
  on public.studies for delete
  using (auth.uid() = user_id);

-- 3) اختبار تحقق يمكن تشغيله بعد التطبيق للتأكد أن RLS فعلاً مفعّل
--    (شغّله في SQL Editor؛ rowsecurity يجب أن يكون true):
--
--   select relname, relrowsecurity
--   from pg_class
--   where relname = 'studies';

-- ═══════════════════════════════════════════════════════════════════════
-- بوابة الدفع (pay-to-unlock-edit) — قالب معطَّل، غير مبني بعد لا عميلاً ولا خادماً
-- ═══════════════════════════════════════════════════════════════════════
-- تحقّق 2026-07-08: «الدفع لفتح التعديل» ليس ثغرة أمنية قائمة بل ميزة غير
-- مبنية إطلاقاً بعد — لا يوجد أي حارس عميلي (isPaid/editLocked/requiresPayment)
-- ولا AuthGuard.hasPermission/getSubscriptionTier مستدعاة من أي واجهة حية
-- (grep شامل: صفر نتائج خارج ملف الاختبار الخاص بها). كما يتعايش في الكود
-- نموذجا تسييل متعارضان دون حسم: pricing.js (شراء لكل دراسة 249/990/2900
-- ريال، معروض في landing.html فقط) مقابل AuthGuard (اشتراكات free/pro/
-- enterprise، مبنية لكن غير موصولة). سياسات الملكية أعلاه (studies_*_own)
-- هي الوضع الصحيح والكامل للتطبيق كما هو الآن — لا قيد إضافي مفقود هنا.
--
-- عند بناء نظام دفع فعلي مستقبلاً (checkout + webhook + استدعاء خادمي
-- لـ supabaseAdmin.auth.admin.updateUserById يكتب app_metadata)، فالنمط
-- الصحيح لإضافة القيد — قرار منتج يحدد الشرط أولاً، ثم الكود:
--
-- إن قرر فريق المنتج أن «studies_update_own» يجب أن تفشل للطبقة المجانية
-- بعد أول حفظ (مثال)، فالنمط الصحيح — تفعيله يتطلب تعديل الشرط أدناه فعلياً
-- ثم تشغيل هذا الملف مجدداً — هو:
--
--   drop policy if exists "studies_update_own" on public.studies;
--   create policy "studies_update_own"
--     on public.studies for update
--     using (
--       auth.uid() = user_id
--       and (
--         coalesce((auth.jwt() -> 'app_metadata' ->> 'subscription_tier'), 'free') <> 'free'
--         or created_at > now() - interval '10 minutes'  -- مثال: نافذة تعديل مجانية محدودة
--       )
--     )
--     with check (auth.uid() = user_id);
--
-- ملاحظة: app_metadata لا يُكتب إلا من الخادم بمفتاح service_role بعد نجاح
-- الدفع فعلياً (عبر webhook من مزوّد الدفع). هذا الجزء (استقبال Webhook +
-- استدعاء supabaseAdmin.auth.admin.updateUserById) غير موجود في الكود بعد
-- ويحتاج بناءً كاملاً منفصلاً — خارج نطاق هذا الترحيل.
