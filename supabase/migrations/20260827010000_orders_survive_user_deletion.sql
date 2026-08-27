-- ══════════════════════════════════════════════════════════════════════════
-- عزل orders وaccount_deletion_requests عن CASCADE حذف المستخدم (2026-08-27)
--
-- اكتُشف أثناء استشارة لجنة حول نطاق حذف الحساب: orders.user_id مُعرَّف
-- `references auth.users(id) on delete cascade` (20260709120000_create_
-- orders_payments.sql:12) — بينما التعليق في نفس الملف بجوار study_id ينص
-- صراحة: «الطلب يجب أن يبقى للتدقيق المالي حتى لو حُذفت الدراسة لاحقاً».
-- التناقض: لو حُذف المستخدم (auth.admin.deleteUser، يدوياً من لوحة Supabase
-- اليوم أو آلياً مستقبلاً)، تُنفَّذ Postgres الـCASCADE فوراً وتمحو صفوف
-- orders نفسها بالكامل — تدمير صامت لسجلات مالية (مبلغ/مزوّد دفع/تاريخ)
-- يُفترض الاحتفاظ بها لأغراض محاسبية/ضريبية، بصرف النظر عن أي ترتيب حذف
-- يُكتب لاحقاً في أي كود تطبيقي؛ القيد نفسه هو الفخ لا تسلسل الاستدعاءات.
-- نفس العلة موجودة حرفياً في account_deletion_requests.user_id — حتى دليل
-- طلب/موافقة المستخدم على الحذف كان سيُمحى مع حسابه، فيضيع أي أثر يثبت أنه
-- طلب الحذف فعلاً عند أي نزاع لاحق.
--
-- لا حذف حساب فعلي مبني على هذا بعد (قرار منتج/قانوني منفصل ينتظر تفويضاً
-- صريحاً — راجع output/2026-08-27/DECISIONS.md) — هذا إصلاح مخطط ضيق ومستقل:
-- SET NULL بدل CASCADE، بنفس فلسفة study_id اللَّيّنة أصلاً في نفس الجدول.
-- صفر طلبات مدفوعة حقيقية اليوم (get_public_usage_stats: paid_studies=0)،
-- فلا بيانات حية تتأثر بهذا التغيير.
-- ══════════════════════════════════════════════════════════════════════════

-- إعادة إنشاء قيد FK بسلوك on delete مختلف بدون افتراض اسم القيد الحالي:
-- القيد أُنشئ ضمنياً داخل create table بلا اسم صريح، وPostgres يختار اسماً
-- تلقائياً (عادة <table>_<column>_fkey) قد يختلف حسب نسخة/سجل قاعدة البيانات
-- الفعلية. البحث عن الاسم الحقيقي عبر information_schema أضمن من افتراضه —
-- لو أُخطئ الاسم المفترَض هنا فستبقى القاعدة القديمة (CASCADE) سارية بصمت
-- بجوار قيد جديد لا يُنفَّذ فعلياً، وهذا بالضبط ما يمنعه هذا الأسلوب.
do $$
declare
  v_constraint_name text;
begin
  select tc.constraint_name into v_constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'orders'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'user_id';

  if v_constraint_name is not null then
    execute format('alter table public.orders drop constraint %I', v_constraint_name);
  end if;

  execute 'alter table public.orders alter column user_id drop not null';
  execute 'alter table public.orders add constraint orders_user_id_fkey '
    || 'foreign key (user_id) references auth.users(id) on delete set null';
end $$;

do $$
declare
  v_constraint_name text;
begin
  select tc.constraint_name into v_constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'account_deletion_requests'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'user_id';

  if v_constraint_name is not null then
    execute format('alter table public.account_deletion_requests drop constraint %I', v_constraint_name);
  end if;

  execute 'alter table public.account_deletion_requests alter column user_id drop not null';
  execute 'alter table public.account_deletion_requests add constraint account_deletion_requests_user_id_fkey '
    || 'foreign key (user_id) references auth.users(id) on delete set null';
end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (SQL Editor، على حساب اختباري فقط — لا تُنفَّذ على
-- مستخدم حقيقي):
--   -- أنشئ مستخدماً وطلباً وهمياً مرتبطاً به، ثم:
--   select auth.admin.delete_user('<test-user-id>'); -- أو من لوحة Supabase
--   select id, user_id, amount_sar from public.orders where id = '<order-id>';
--   -- متوقَّع: الصف باقٍ، user_id = null، amount_sar وبقية الحقول المالية سليمة.
-- ══════════════════════════════════════════════════════════════════════════
