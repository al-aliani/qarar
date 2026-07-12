-- ═══════════════════════════════════════════════════════════════════════
-- إضافة تمارا (BNPL سعودي) كمزوّد دفع ثالث بجانب Moyasar/Stripe (2026-07-14)
-- — مرونة تقسيط تسدّ فجوة مقارنة مقابل منافسين يوفرونها بالفعل ("جدوى تك").
-- ═══════════════════════════════════════════════════════════════════════

alter table public.orders drop constraint if exists orders_provider_check;
alter table public.orders add constraint orders_provider_check
  check (provider in ('moyasar', 'stripe', 'tamara'));

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (شغّله في SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.orders'::regclass and conname = 'orders_provider_check';
--   -- يجب أن يظهر 'tamara' ضمن قائمة القيم المسموحة.
