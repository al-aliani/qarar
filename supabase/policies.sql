-- ═══════════════════════════════════════════════════════════════════════
-- سياسات RLS (Row Level Security) لمنصة «قرار»
-- الفرض الحقيقي لملكية البيانات وقفل الطبقات — الفحوص في العميل (AuthGuard)
-- للعرض/تجربة المستخدم فقط ويمكن تخطّيها؛ هذه السياسات هي الحاجز الفعلي.
--
-- طريقة التطبيق: Supabase Dashboard → SQL Editor → الصق ونفّذ.
-- (لا يمكن تطبيقها من كود العميل — تتطلب صلاحية المالك/الخدمة.)
-- ═══════════════════════════════════════════════════════════════════════

-- 1) تفعيل RLS على جدول الدراسات (بدونه أي مستخدم يقرأ/يكتب صفوف الآخرين)
alter table public.studies enable row level security;

-- 2) كل مستخدم يرى صفوفه فقط
create policy "studies_select_own"
  on public.studies for select
  using (auth.uid() = user_id);

-- 3) الإدراج فقط باسم المستخدم نفسه (منع انتحال user_id)
create policy "studies_insert_own"
  on public.studies for insert
  with check (auth.uid() = user_id);

-- 4) التعديل فقط لصفوفه (قفل «تعديل مدفوع» يُفرض هنا لا في العميل)
create policy "studies_update_own"
  on public.studies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5) الحذف فقط لصفوفه
create policy "studies_delete_own"
  on public.studies for delete
  using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- طبقة الاشتراك (subscription_tier) — أمان ضد الترقية الذاتية
-- ═══════════════════════════════════════════════════════════════════════
-- ❌ لا تضع subscription_tier في user_metadata: المستخدم يعدّلها بنفسه عبر
--    supabase.auth.updateUser({ data: { subscription_tier: 'enterprise' } }).
-- ✅ ضعها في app_metadata: لا تُكتب إلا بمفتاح service_role من الخادم.
--    العميل (AuthGuard.getSubscriptionTier) يقرأها من app_metadata فقط.
--
-- مثال ضبط الطبقة من الخادم (Edge Function / خادم بمفتاح service_role) بعد الدفع:
--   await supabaseAdmin.auth.admin.updateUserById(userId, {
--     app_metadata: { subscription_tier: 'pro' }
--   });
--
-- حدّ عدد المشاريع (canCreateProject) للطبقة المجانية يجب فرضه أيضاً على الخادم
-- (Edge Function تتحقق من count قبل الإدراج)؛ فحص العميل قابل للتخطّي.
-- ═══════════════════════════════════════════════════════════════════════
