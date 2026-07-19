-- عمود provider_payment_intent لجدول orders.
-- يخزّن معرّف Stripe PaymentIntent وقت الدفع الناجح، ليُتيح ربط حدث الاسترداد
-- (charge.refunded يحمل كائن charge لا session، فلا يطابق provider_ref = session id)
-- بالطلب الأصلي، فتُحوَّل حالته إلى 'refunded' ويُسحب الوصول (hasActivePayment يشترط
-- status='paid'). Moyasar وTamara يربطان الاسترداد بـ provider_ref مباشرةً فلا يحتاجانه.
alter table public.orders add column if not exists provider_payment_intent text;

create index if not exists orders_provider_payment_intent_idx
  on public.orders (provider_payment_intent)
  where provider_payment_intent is not null;
