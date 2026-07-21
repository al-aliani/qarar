-- ══════════════════════════════════════════════════════════════════════════
-- وسيلة دفع «تحويل بنكي» (قناة يدوية) — تدقيق 2026-07-21.
-- الطلب يُنشأ pending عبر create-checkout (بلا مزوّد خارجي)، ثم يؤكّده الأدمن يدوياً
-- بعد وصول الحوالة إلى حساب الشركة فتصبح الحالة paid ويُفتح التصدير للعميل.
-- ══════════════════════════════════════════════════════════════════════════

-- 1) توسيع قيد provider ليقبل 'bank_transfer' (كان: moyasar/stripe/tamara).
alter table public.orders drop constraint if exists orders_provider_check;
alter table public.orders add constraint orders_provider_check
  check (provider in ('moyasar', 'stripe', 'tamara', 'bank_transfer'));

-- 2) تأكيد تحويل بنكي يدوياً — أدمن فقط. يحوّل الطلب من pending إلى paid، ويضبط
--    paid_at، ويُدخل طلبات «مراجَع بخبير» إلى طابور المراجعين (نفس منطق الـwebhooks).
create or replace function public.admin_confirm_bank_transfer(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  update public.orders
    set status = 'paid', paid_at = now()
    where id = target_order_id
      and provider = 'bank_transfer'
      and status = 'pending';

  if not found then
    raise exception 'no matching pending bank_transfer order';
  end if;

  -- طلب «مراجَع بخبير» المدفوع حديثاً يدخل طابور المراجعين تلقائياً.
  update public.orders
    set review_status = 'queued'
    where id = target_order_id
      and tier = 'reviewed'
      and review_status = 'none';
end;
$$;

grant execute on function public.admin_confirm_bank_transfer(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (SQL Editor):
--   -- أدمن يؤكّد طلب تحويل بنكي (يجب أن ينجح):
--   select public.admin_confirm_bank_transfer('<order-uuid>');
--   -- غير أدمن (يجب أن يفشل بـ not authorized).
-- تأكيد الطلب يجعل PaymentService.hasActivePayment('<study_id>') = true فيُفتح التصدير.
-- ══════════════════════════════════════════════════════════════════════════
