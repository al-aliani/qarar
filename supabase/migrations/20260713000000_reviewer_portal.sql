-- ═══════════════════════════════════════════════════════════════════════
-- بوابة مراجعين للخبراء (2026-07-13) — تسليم فئة "مراجَع بخبير" (990 ريال،
-- tier='reviewed' في orders) كان يدوياً بالكامل عبر واتساب بلا أي أثر داخل
-- النظام (انظر PaywallModal.js / _shared/pricing.ts). هذا الترحيل يضيف طبقة
-- مراجعين حقيقية: جدول reviewers + حالة مراجعة على orders + صلاحية قراءة
-- مقيّدة على studies للمراجع المكلّف — تمهيداً لثلاث Edge Functions
-- (reviewer-queue/claim/submit) تُجري الكتابة الفعلية بمفتاح service_role.
--
-- تجنيد المراجعين (v1 — تقليص نطاق متعمد): لا توجد واجهة دعوة/تسجيل مراجعين.
-- صاحب الموقع يُدرج صف المراجع يدوياً عبر Supabase Dashboard → SQL Editor:
--   insert into public.reviewers (id, display_name, credentials)
--   values ('<auth.users.id للمستخدم>', 'اسم المراجع', 'مؤهلاته');
-- بناء واجهة دعوة ذاتية مؤجَّل لإصدار لاحق عند الحاجة الفعلية لعدد مراجعين
-- أكبر من أن تُدار يدوياً.
-- ═══════════════════════════════════════════════════════════════════════

-- 1) جدول المراجعين — عضوية صريحة فقط (لا صلاحيات ضمنية من أي دور Supabase)
create table if not exists public.reviewers (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  credentials text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.reviewers enable row level security;

-- كل مراجع يرى صفّه فقط (يكفي لتحقق isReviewer() من الواجهة).
drop policy if exists "reviewers_select_own" on public.reviewers;
create policy "reviewers_select_own"
  on public.reviewers for select
  using (auth.uid() = id);

-- 2) أعمدة سير عمل المراجعة على orders (إضافية بحتة — لا تُغيّر أي عمود قائم)
-- يجب أن يسبق سياسة reviewers_select_via_certified_order أدناه، لأنها تشير
-- إلى orders.reviewer_id/review_status (اكتُشف الترتيب الخاطئ 2026-07-16 عند
-- أول تطبيق فعلي لهذا الملف على مشروع فارغ تماماً — "column o.reviewer_id
-- does not exist" — لم يظهر سابقاً لأن أي تطبيق حي وقع بعد أن كانت الأعمدة
-- موجودة أصلاً من محاولة يدوية سابقة).
alter table public.orders
  add column if not exists review_status text not null default 'none'
    check (review_status in ('none', 'queued', 'in_review', 'certified', 'rejected')),
  add column if not exists reviewer_id uuid references public.reviewers(id),
  add column if not exists reviewer_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists certificate_id text;

-- العميل صاحب دراسة مُعتمَدة يحتاج رؤية اسم المراجع الحقيقي (هذا هو صلب ميزة
-- التوثيق — بدونها لا يمكن لـ ReviewerService.getCertificationForStudy عرض
-- reviewers(display_name) عبر PostgREST embed، لأن RLS يُطبَّق أيضاً على
-- الجدول المُضمَّن لا فقط الجدول الأساسي في الاستعلام.
drop policy if exists "reviewers_select_via_certified_order" on public.reviewers;
create policy "reviewers_select_via_certified_order"
  on public.reviewers for select
  using (
    exists (
      select 1 from public.orders o
      where o.reviewer_id = reviewers.id
        and o.review_status = 'certified'
        and o.user_id = auth.uid()
    )
  );

-- عمود مولَّد (generated/stored): يحوّل study_id (text ليّن، بلا FK — انظر
-- تعليق 20260709120000_create_orders_payments.sql) إلى uuid فقط عند صحة
-- الصيغة، وإلا null. الغاية: مقارنة uuid-إلى-uuid مفهرسة في سياسة studies
-- أدناه بدل uuid-إلى-text في كل استعلام.
alter table public.orders
  add column if not exists study_uuid uuid
    generated always as (
      case
        when study_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then study_id::uuid
        else null
      end
    ) stored;

create index if not exists orders_study_uuid_idx on public.orders (study_uuid);
create index if not exists orders_review_status_reviewed_idx
  on public.orders (review_status)
  where tier = 'reviewed';

-- طلب "مراجَع بخبير" يدخل الطابور تلقائياً عند تمام الدفع (status='paid') —
-- webhook-moyasar/webhook-stripe يحدّثان review_status إلى 'queued' فور
-- نجاح الدفع (شرط tier='reviewed' AND review_status='none' لمنع إعادة
-- إدخال طلب سبق أن دخل السير عند استقبال حدث webhook مكرر).

create sequence if not exists public.cert_seq;

-- تُستدعى عبر adminClient.rpc('generate_certificate_id') من reviewer-submit —
-- supabase-js ليس فيه استدعاء مباشر لـ nextval() على تسلسل، فالأبسط دالة SQL
-- واحدة تُغلّفه وتُنسّق الصيغة (QR-CERT-<سنة>-<تسلسل مرقّم بستة خانات>).
create or replace function public.generate_certificate_id()
returns text
language sql
security definer
set search_path = public
as $$
  select 'QR-CERT-' || extract(year from now())::text || '-' || lpad(nextval('cert_seq')::text, 6, '0');
$$;

-- 3) سياسة SELECT جديدة على orders للمراجع النشط — إضافية، لا تمسّ
--    "orders_select_own" الحالية. عمداً: لا سياسة UPDATE/INSERT/DELETE هنا
--    (نفس مبدأ 20260709120000...sql: لا كتابة إلا عبر service_role من
--    Edge Functions بعد تحقق صريح من هوية المراجع وحالة الادّعاء).
drop policy if exists "orders_select_reviewer_queue" on public.orders;
create policy "orders_select_reviewer_queue"
  on public.orders for select
  using (
    exists (select 1 from public.reviewers r where r.id = auth.uid() and r.active)
    and tier = 'reviewed'
    and status = 'paid'
    and (review_status = 'queued' or reviewer_id = auth.uid())
  );

-- 4) قراءة studies للمراجع المكلّف فقط — دالة security definer لتفادي
--    مشاكل تخطيط السياسات المتداخلة (recursive policy) عبر subquery مباشر.
create or replace function public.is_reviewer_of_study(target_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.orders o
    join public.reviewers r on r.id = auth.uid() and r.active
    where o.study_uuid = target_study_id
      and o.reviewer_id = auth.uid()
      and o.review_status in ('in_review', 'certified')
  );
$$;

drop policy if exists "studies_select_reviewer" on public.studies;
create policy "studies_select_reviewer"
  on public.studies for select
  using (public.is_reviewer_of_study(id));

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (شغّله في SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════
--
-- أ) تأكيد وجود الأعمدة والجدول:
--   select column_name from information_schema.columns
--   where table_name = 'orders' and column_name in
--     ('review_status','reviewer_id','reviewer_notes','reviewed_at','certificate_id','study_uuid');
--   select relname, relrowsecurity from pg_class where relname in ('reviewers','orders','studies');
--
-- ب) محاكاة جلسة مراجع (استبدل <reviewer-auth-uid> بمعرّف مراجع مُدرَج فعلاً):
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<reviewer-auth-uid>"}';
--   -- يجب أن يُرجع فقط طلبات tier='reviewed' AND status='paid' غير مُدّعاة أو مُدّعاة لهذا المراجع:
--   select id, tier, status, review_status, reviewer_id from public.orders;
--   -- يجب أن يفشل (لا سياسة UPDATE على orders إطلاقاً):
--   update public.orders set review_status = 'certified' where id = (select id from public.orders limit 1);
--   reset role;
