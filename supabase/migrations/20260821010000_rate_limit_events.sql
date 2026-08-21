-- ═══════════════════════════════════════════════════════════════════════
-- تدقيق أمني 2026-08-21: create-checkout/places-nearby/check-name-availability
-- بلا أي حد لمعدل الاستدعاء رغم أنها تستدعي API خارجية حقيقية مدفوعة
-- (Moyasar/Stripe/Tamara، Google Places) أو تكتب صفوف orders بلا سقف —
-- يفتح استنزاف حساب الدفع الحي/ميزانية API وDoS فعلي على مسار الإيراد
-- (أي مستخدم مسجَّل بجلسة عادية يقدر يستدعي بحلقة سريعة).
--
-- جدول عام مشترك بنفس مبدأ phone_otp_challenges (20260717010000): رفض RLS
-- تام لكل الأدوار، service_role فقط يلمسه من داخل Edge Functions — قابل
-- لإعادة الاستخدام لأي دالة مستقبلية عبر _shared/rateLimit.ts.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_user_endpoint_created_idx
  on public.rate_limit_events (user_id, endpoint, created_at desc);

alter table public.rate_limit_events enable row level security;
-- عمداً: لا سياسة select/insert/update/delete لأي دور (anon/authenticated) —
-- رفض تام. القراءة/الكتابة الوحيدة عبر service_role داخل Edge Functions.

-- تنظيف دوري بسيط: صفوف أقدم من 7 أيام لا قيمة لها لأي نافذة حد معدّل واقعية
-- بهذا المشروع — تُحذف عند كل استدعاء لدالة تنظيف اختيارية (لا trigger تلقائي
-- لتفادي تعقيد غير ضروري؛ الجدول خفيف جداً وinsert-only بمعدل منخفض أصلاً).
create or replace function public.cleanup_old_rate_limit_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limit_events where created_at < now() - interval '7 days';
$$;
