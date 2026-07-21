-- ══════════════════════════════════════════════════════════════════════════
-- بلوكر #9 (تدقيق 2026-07-21): طلب دفع مُلغى/مهجور (المستخدم رجع من صفحة
-- المزوّد بلا إتمام) يبقى status='pending' للأبد — لا يوجد أي منطق انتهاء
-- صلاحية، فيظهر بسجل فواتير العميل "قيد الانتظار" بلا نهاية ويسبّب لبساً/تذاكر
-- دعم. الحل: حالة 'expired' جديدة + دالة تنظيف يستدعيها العميل ضمنياً كل مرة
-- يفتح سجل فواتيره (listOrders في PaymentService.js) لا cron خارجي.
--
-- استثناء متعمَّد: provider='bank_transfer' يبقى pending لأيام بتصميمه (ينتظر
-- تأكيد الأدمن يدوياً بعد وصول الحوالة فعلياً، انظر admin_confirm_bank_transfer
-- في 20260721150000_bank_transfer.sql) — لا يجب انتهاء صلاحيته أبداً هنا.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'paid', 'failed', 'refunded', 'expired'));

-- تُنهي فقط طلبات المستخدم صاحب الجلسة نفسه (auth.uid()) الأقدم من 24 ساعة —
-- آمنة للاستدعاء من العميل مباشرة (grant إلى authenticated) لأنها لا تلمس
-- طلبات مستخدم آخر مهما كانت وسيطة الاستدعاء.
create or replace function public.expire_stale_pending_orders()
returns void
language sql
security definer
set search_path = public
as $$
  update public.orders
  set status = 'expired'
  where status = 'pending'
    and provider <> 'bank_transfer'
    and user_id = auth.uid()
    and created_at < now() - interval '24 hours';
$$;

grant execute on function public.expire_stale_pending_orders() to authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (SQL Editor):
--   -- كمستخدم مصادَق: طلب pending عمره > 24 ساعة (غير bank_transfer) يجب أن
--   -- يتحوّل إلى 'expired' بعد استدعاء الدالة، وطلب bank_transfer المماثل
--   -- يجب أن يبقى 'pending' بلا تغيير:
--   select public.expire_stale_pending_orders();
--   select id, provider, status, created_at from public.orders where user_id = auth.uid();
-- ══════════════════════════════════════════════════════════════════════════
