-- ═══════════════════════════════════════════════════════════════════════
-- أتمتة الدفع (2026-07-09) — جدول الطلبات (orders): يربط حالة الدفع الفعلية
-- بهوية المستخدم عبر RLS دقيقة، بدل نموذج "الدفع اليدوي عبر واتساب" وحده
-- (PaywallModal.js السابق). كل كتابة على هذا الجدول تمر حصراً عبر Edge
-- Functions موثوقة (مفتاح service_role يتجاوز RLS) بعد تحقق فعلي من مزوّد
-- الدفع (Moyasar/Stripe) — لا يوجد أي مسار يسمح للعميل بكتابة/تعديل حالة
-- "مدفوع" بنفسه مهما كان، وهذا هو صلب الحماية ضد التلاعب.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- مرجع "لَيّن" (لا قيد FK) لمعرّف الدراسة (studies.id هو projectInfo.id الذي
  -- يولّده العميل) — الطلب يجب أن يبقى للتدقيق المالي حتى لو حُذفت الدراسة لاحقاً.
  study_id text,
  tier text not null check (tier in ('self', 'reviewed', 'full')),
  amount_sar numeric(10, 2) not null,
  currency text not null default 'SAR',
  provider text not null check (provider in ('moyasar', 'stripe')),
  -- معرّف الجلسة/الفاتورة/عملية الدفع لدى المزوّد الخارجي — فريد لكل مزوّد،
  -- يُستخدم للبحث عند وصول الـwebhook ولمنع معالجة نفس الحدث مرتين.
  provider_ref text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- منع معالجة نفس حدث الدفع مرتين (استقبال webhook مكرر من المزوّد — سيناريو
-- شائع فعلياً، كل مزوّدي الدفع يُعيدون إرسال الحدث عند عدم استلام رد 200 سريع).
create unique index if not exists orders_provider_ref_unique
  on public.orders (provider, provider_ref)
  where provider_ref is not null;

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_study_id_idx on public.orders (study_id);

alter table public.orders enable row level security;

-- القراءة فقط لصاحب الطلب — يحتاجها العميل ليتحقق "هل دفعت هذه الدراسة؟"
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders for select
  using (auth.uid() = user_id);

-- عمداً: لا توجد سياسة insert/update/delete لأي دور (authenticated/anon).
-- الكتابة الوحيدة الممكنة هي عبر مفتاح service_role (تستخدمه Edge Functions
-- فقط، ويتجاوز RLS بالكامل) — أي أن "حالة الدفع" لا يمكن انتحالها من المتصفح
-- مهما فعل المستخدم بأدوات المطوّر أو طلبات مباشرة لواجهة Supabase REST.

-- اختبار تحقق يمكن تشغيله بعد التطبيق (rowsecurity يجب أن يكون true):
--
--   select relname, relrowsecurity from pg_class where relname = 'orders';
