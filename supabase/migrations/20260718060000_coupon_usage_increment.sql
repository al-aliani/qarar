-- زيادة عدّاد استخدام الكوبون عند نجاح الدفع (تدقيق 2026-07-17).
--
-- الخلل المُصلَح: create-checkout/index.ts:74 يفحص `used_count < max_uses` قبل
-- تطبيق الخصم، لكن لا شيء في المستودع كله كان يزيد used_count — الأعمدة الثلاثة
-- (تعريفها، قراءتها، فحصها) كانت المواضع الوحيدة. النتيجة: max_uses بلا أي أثر،
-- وأي كوبون محدود بعدد استخدامات يعمل بلا نهاية.
--
-- التوقيت: الزيادة عند الانتقال إلى paid وليس عند إنشاء الطلب — الطلب المهجور
-- (pending إلى الأبد) أو الفاشل يجب ألا يستهلك حصة الكوبون.
--
-- حدّ معروف ومقبول عمداً: الفحص يقع وقت إنشاء الطلب والزيادة وقت الدفع، فبين
-- اللحظتين يمكن إنشاء عدة طلبات تتجاوز max_uses مجتمعةً. فرض الحصة بدقة يتطلب
-- حجزاً ذرياً وقت الإنشاء وإطلاقه عند الفشل — تعقيد غير مبرَّر لكوبونات تسويقية.
-- الغرض هنا سدّ التجاوز غير المحدود، لا الدقة المحاسبية.

create or replace function public.increment_coupon_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid'
     and old.status is distinct from 'paid'
     and new.coupon_code is not null then
    update public.coupons
       set used_count = used_count + 1
     where code = new.coupon_code;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_increment_coupon_usage on public.orders;
create trigger trg_increment_coupon_usage
  after update of status on public.orders
  for each row execute function public.increment_coupon_usage();
