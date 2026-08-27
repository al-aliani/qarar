-- ══════════════════════════════════════════════════════════════════════════
-- إشعار داخلي عند تأكيد التحويل البنكي (2026-08-27) — استكمال جدول
-- public.notifications الموجود أصلاً (20260716000002_dashboard_experience.sql)
-- ووسيلة الدفع الوحيدة المفعّلة حالياً (bank_transfer): العميل يدفع 1,999-4,999
-- ريال ولا يصله أي إشعار داخل الموقع عند تأكيد الأدمن لتحويله البنكي، رغم أن
-- webhook-moyasar/stripe/tamara ستُشعِر العميل عند الدفع الإلكتروني (تعديل منفصل
-- بنفس الحملة). لا نعدّل 20260721150000_bank_transfer.sql مباشرة (مُطبَّق فعلاً
-- على قاعدة حية) — create or replace بنفس الاسم، النمط القياسي المتّبع في هذا
-- المشروع لتحديث دوال SQL دون كسر ما طُبِّق (انظر 20260722094000 لمثال مطابق).
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_confirm_bank_transfer(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_study_id text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  update public.orders
    set status = 'paid', paid_at = now()
    where id = target_order_id
      and provider = 'bank_transfer'
      and status = 'pending'
    returning user_id, study_id into v_user_id, v_study_id;

  if not found then
    raise exception 'no matching pending bank_transfer order';
  end if;

  -- طلب «مراجَع بخبير» المدفوع حديثاً يدخل طابور المراجعين تلقائياً.
  update public.orders
    set review_status = 'queued'
    where id = target_order_id
      and tier = 'reviewed'
      and review_status = 'none';

  -- إعلام العميل بنجاح الدفع — نفس القناة الداخلية المستخدمة فعلياً من
  -- webhook-moyasar/stripe/tamara. مُغلَّفة بمعالج استثناء عمداً: فشل إدراج
  -- إشعار (مثلاً قيداً مستقبلياً على notifications) لا يجوز أن يُسقط تأكيد
  -- الدفع نفسه — تحديث status='paid' أعلاه هو الجزء الحرج وقد نجح فعلاً.
  begin
    insert into public.notifications (user_id, type, title, body, study_id)
    values (v_user_id, 'payment', 'تم تأكيد دفعتك', 'وصلتنا دفعتك بنجاح، ويمكنك الآن تنزيل دراستك.', v_study_id);
  exception when others then
    raise warning 'admin_confirm_bank_transfer: فشل إدراج إشعار الدفع لطلب %: %', target_order_id, sqlerrm;
  end;
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (SQL Editor):
--   -- أدمن يؤكّد طلب تحويل بنكي (يجب أن ينجح، ويُدرج إشعاراً):
--   select public.admin_confirm_bank_transfer('<order-uuid>');
--   select * from public.notifications where type = 'payment' order by created_at desc limit 5;
--   -- محاكاة فشل الإدراج (مثلاً بتعطيل الجدول مؤقتاً) يجب ألا يمنع نجاح
--   -- الدالة نفسها ولا تحديث status='paid' — فقط تحذير raise warning في السجلّ.
-- ══════════════════════════════════════════════════════════════════════════
