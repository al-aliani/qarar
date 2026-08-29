-- ═══════════════════════════════════════════════════════════════════════
-- (2026-08-29، نفس فئة الفجوة المُصلَحة سابقاً في
-- 20260708080000_studies_table_bootstrap.sql): جدول public.study_shares
-- نفسه — المخطط الكنسي الموثَّق في docs/supabase_setup.sql — لم يكن له
-- إطلاقاً أي CREATE TABLE مقابل في supabase/migrations. كان الجدول موجوداً
-- حياً فقط لأنه أُنشئ يدوياً مرة واحدة (لصق docs/supabase_setup.sql في
-- Supabase Dashboard) قبل أي ترحيل مُتتبَّع يمسّه. كل ترحيل لاحق يمسّ هذا
-- الجدول (20260714020000_share_tokens.sql وما بعده) يفترض وجوده ضمناً عبر
-- "alter table public.study_shares ..." بلا أي "create table" سابق. لو
-- أُعيد بناء القاعدة من supabase/migrations فقط (بيئة جديدة/CI مستقبلية)،
-- كان أول سطر ينفَّذ فعلياً ضد هذا الجدول
-- (20260714020000_share_tokens.sql: alter table public.study_shares alter
-- column shared_with_email drop not null) سيفشل فوراً بخطأ "relation
-- public.study_shares does not exist".
--
-- التاريخ متعمَّد بالعودة إلى قبل 20260714020000_share_tokens.sql (أول
-- ترحيل مُتتبَّع يمسّ هذا الجدول) لا تاريخ اليوم (2026-08-29) — كي يُنفَّذ
-- هذا الملف أولاً على أي بيئة جديدة، قبل أي ترحيل لاحق يفترض وجود الجدول
-- ضمناً. يقع بعد 20260714010000_add_tamara_provider.sql وبعد
-- 20260708080000_studies_table_bootstrap.sql (يعتمد عليه فعلياً: study_id
-- يشير بمفتاح أجنبي إلى public.studies). هذا الترحيل مُدرَج على allowlist
-- الاستثناء الموثَّق في migrationIntroductionOrderMonotonicity.guard.test.js
-- بجانب سابقه (studies)، لنفس السبب بالضبط.
-- على الإنتاج الحي: بلا أي أثر — الجدول موجود فعلاً بنفس هذا المخطط بالضبط
-- (IF NOT EXISTS يتخطى إنشاءه)، والفهارس أدناه idempotent بنفس الأسلوب
-- (IF NOT EXISTS).
--
-- عمداً هنا: لا تفعيل RLS ولا سياسات وصول — docs/supabase_setup.sql يُعرِّف
-- بالفعل "Study owners can manage shares" و"Shared users can view their
-- shares" بأسماء محدَّدة، وهما مُفعَّلتان فعلياً على الإنتاج الحي (أُنشئتا
-- يدوياً مع الجدول نفسه). لا يوجد أي ترحيل مُتتبَّع لاحق يُعيد تعريفهما
-- (بخلاف studies، حيث 20260708090000_enable_rls_studies.sql مسؤول فعلياً
-- عن ذلك) — لكن تكرارهما هنا بنفس الاسمين كان سيفشل مباشرة على الإنتاج
-- الحي بخطأ "policy already exists" (هذا الترحيل سيُطبَّق هناك كملف جديد
-- معلَّق)، وبأسماء مختلفة كان سيُنشئ سياسات مكرِّرة زائدة بصمت. غياب أي
-- ترحيل يُثبّت RLS لهذا الجدول تحديداً فجوة منفصلة حقيقية (بيئة جديدة نظيفة
-- من الترحيلات فقط ستملك الجدول بلا RLS مفعَّلة إطلاقاً) — خارج نطاق هذا
-- الملف الذي يقتصر على إثبات وجود الجدول نفسه فقط.
-- ═══════════════════════════════════════════════════════════════════════

-- gen_random_uuid() لا uuid_generate_v4() (الأخيرة في docs/supabase_setup.sql
-- الأصلي، تتطلب تفعيل امتداد uuid-ossp غير مُتتبَّع في أي ترحيل هنا) — نفس
-- الأسلوب المتَّبع في 20260708080000_studies_table_bootstrap.sql وبقية
-- ترحيلات هذا المستودع. لا أثر على الإنتاج الحي (IF NOT EXISTS يتخطى هذا
-- البند بالكامل هناك)؛ يهم فقط بيئة جديدة تُنشئ الجدول فعلياً من هذا الملف.
create table if not exists public.study_shares (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  shared_with_email text not null,
  shared_with_user_id uuid references auth.users(id) on delete cascade,
  permission text default 'view' check (permission in ('view', 'edit', 'admin')),
  accepted boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_study_shares_study_id on public.study_shares(study_id);
create index if not exists idx_study_shares_email on public.study_shares(shared_with_email);
