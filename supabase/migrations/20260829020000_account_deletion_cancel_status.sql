-- ══════════════════════════════════════════════════════════════════════════
-- السماح بحالة 'cancelled' لطلب حذف الحساب + سياسة تراجع صاحب الطلب (2026-08-29)
--
-- سياق: تنفيذ فعلي لحذف الحساب بعد فترة سماح 7 أيام — تفويض مالك صريح اليوم
-- (كان معلَّقاً في output/2026-08-27/DECISIONS.md §4: "القرار المؤجَّل: بناء
-- آلية حذف فعلي كاملة... فورية التنفيذ أم فترة سماح؟"، صار له تفويض صريح
-- بفترة سماح 7 أيام + احتفاظ 6 سنوات بالفواتير). طالما هناك فترة سماح، يجب أن
-- يستطيع المستخدم التراجع خلالها.
--
-- الوضع الحالي بلا هذا الترحيل: جدول account_deletion_requests (20260718050000)
-- يسمح فقط بـ('requested','processing','completed','rejected') عبر check
-- constraint، ولا توجد أي سياسة RLS تسمح لصاحب الطلب بتحديث صفه — فقط الأدمن
-- (deletion_admin_update). محاولة AccountService.cancelAccountDeletionRequest()
-- تحديث status إلى 'cancelled' كانت ستفشل مرتين: قيد check يرفض القيمة أصلاً،
-- وRLS ترفض التحديث حتى لو القيمة صالحة.
--
-- لماذا 'cancelled' لا حذف الصف فعلياً: يحافظ على أثر تدقيق (متى طلب المستخدم
-- الحذف ومتى تراجع) — نفس فلسفة orders في هذا المستودع (استرداد/تحديث حالة لا
-- حذف السجل نفسه).
-- ══════════════════════════════════════════════════════════════════════════

-- إعادة إنشاء قيد check بدون افتراض اسمه الحالي — نفس أسلوب البحث الديناميكي
-- المتّبع في 20260827010000_orders_survive_user_deletion.sql لقيود FK، مطبَّق
-- هنا على قيد check عبر pg_constraint (contype='c') بدل information_schema.
do $$
declare
  v_constraint_name text;
begin
  select con.conname into v_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'account_deletion_requests'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%status%';

  if v_constraint_name is not null then
    execute format('alter table public.account_deletion_requests drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_status_check
  check (status in ('requested', 'processing', 'completed', 'rejected', 'cancelled'));

-- صاحب الطلب يستطيع فقط الانتقال requested → cancelled على صفّه الخاص. لا يمكنه
-- الانتقال لأي حالة أخرى (مثلاً 'completed')، ولا لمس طلب لم يعد بحالة
-- 'requested' أصلاً (مثلاً صار 'processing' فعلاً من الأدمن) — شرط USING يمنع ذلك.
drop policy if exists "deletion_cancel_own" on public.account_deletion_requests;
create policy "deletion_cancel_own" on public.account_deletion_requests
  for update
  using (auth.uid() = user_id and status = 'requested')
  with check (auth.uid() = user_id and status = 'cancelled');

-- ══════════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (SQL Editor)
-- ══════════════════════════════════════════════════════════════════════════
--
-- أ) القيد الجديد يقبل 'cancelled' ويرفض قيمة عشوائية:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.account_deletion_requests'::regclass and contype = 'c';
--
-- ب) مستخدم يُلغي طلبه الخاص بنجاح (استبدل uid فعلياً مسجّل دخول له طلب requested):
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<user-auth-uid>"}';
--   update public.account_deletion_requests set status = 'cancelled'
--     where user_id = '<user-auth-uid>' and status = 'requested';
--   reset role;
--
-- ج) مستخدم آخر لا يستطيع لمس طلب ليس له:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<other-user-auth-uid>"}';
--   update public.account_deletion_requests set status = 'cancelled'
--     where user_id = '<user-auth-uid>'; -- يجب أن يؤثر على صفر صفوف
--   reset role;
