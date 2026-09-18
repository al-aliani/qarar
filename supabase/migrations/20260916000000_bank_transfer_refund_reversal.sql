-- ══════════════════════════════════════════════════════════════════════════
-- عكس حالة تحويل بنكي مدفوع إلى «مسترَد» (تدقيق شامل 2026-09-16): لا وجود لأي
-- دالة تعكس status='paid'→'refunded' لطلب bank_transfer — وهي وسيلة الدفع
-- الوحيدة المفعّلة حالياً بالواجهة (Moyasar/Stripe/Tamara غير مفعّلة بعد).
-- أثر ذلك: عميل يُسترَد له المبلغ يدوياً خارج المنصة (نزاع/خطأ) يبقى
-- hasActivePayment=true إلى ما لا نهاية (تعتمد فقط على status='paid')، فيستمر
-- وصوله لتصدير تقرير مدفوع رغم استرجاعه كامل المبلغ — تسريب قيمة فعلي على
-- القناة الحيّة الوحيدة، بلا أي أداة مبرمجة للتصحيح سوى UPDATE يدوي مباشر على
-- قاعدة الإنتاج. نفس نمط admin_confirm_bank_transfer تماماً (20260827000000)
-- بالاتجاه المعاكس + دالة سرد مقابلة لـadmin_list_pending_bank_transforms
-- (20260722094000) بحالة paid بدل pending، لتفادي حاجة الأدمن لنسخ UUID يدوياً.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_refund_bank_transfer(target_order_id uuid)
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
    set status = 'refunded'
    where id = target_order_id
      and provider = 'bank_transfer'
      and status = 'paid'
    returning user_id, study_id into v_user_id, v_study_id;

  if not found then
    raise exception 'no matching paid bank_transfer order';
  end if;

  -- إعلام العميل بالاسترداد — مُغلَّفة بمعالج استثناء عمداً (نفس نمط
  -- admin_confirm_bank_transfer): فشل إدراج إشعار لا يجوز أن يُسقط عكس الحالة
  -- نفسه — تحديث status='refunded' أعلاه هو الجزء الحرج وقد نجح فعلاً.
  begin
    insert into public.notifications (user_id, type, title, body, study_id)
    values (v_user_id, 'payment', 'تم استرداد دفعتك', 'تم استرداد قيمة تحويلك البنكي، ولن يعود التصدير متاحاً لهذه الدراسة.', v_study_id);
  exception when others then
    raise warning 'admin_refund_bank_transfer: فشل إدراج إشعار الاسترداد لطلب %: %', target_order_id, sqlerrm;
  end;
end;
$$;

grant execute on function public.admin_refund_bank_transfer(uuid) to authenticated;

-- سرد التحويلات البنكية المدفوعة القابلة للاسترداد — نفس بنية
-- admin_list_pending_bank_transfers (20260722094000) بحالة paid بدل pending.
create or replace function public.admin_list_paid_bank_transfers()
returns table (
  order_id uuid,
  tier text,
  amount_sar numeric,
  study_id uuid,
  study_title text,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select o.id, o.tier, coalesce(o.total_sar, o.amount_sar), o.study_uuid, s.title, o.paid_at
    from public.orders o
    left join public.studies s on s.id = o.study_uuid
    where o.provider = 'bank_transfer' and o.status = 'paid'
    order by o.paid_at desc;
end;
$$;

grant execute on function public.admin_list_paid_bank_transfers() to authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (SQL Editor):
--   select public.admin_list_paid_bank_transfers();
--   select public.admin_refund_bank_transfer('<order-uuid>');
--   select status from public.orders where id = '<order-uuid>'; -- يجب 'refunded'
--   select * from public.notifications where type='payment' order by created_at desc limit 5;
--   -- محاولة ثانية على نفس الطلب يجب أن تفشل بـ'no matching paid bank_transfer order':
--   select public.admin_refund_bank_transfer('<order-uuid>');
-- ══════════════════════════════════════════════════════════════════════════
