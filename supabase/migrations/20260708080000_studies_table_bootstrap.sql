-- ═══════════════════════════════════════════════════════════════════════
-- دفعة 7 (2026-08-27، نظافة قاعدة البيانات): جدول public.studies نفسه —
-- المخطط الكنسي الموثَّق في docs/supabase_setup.sql (المصدر الوحيد المعتمد
-- لعمود user_id/data JSONB الموحّد، يطابق PersistenceService.js._saveCloud
-- حرفياً) — لم يكن له إطلاقاً أي CREATE TABLE مقابل في supabase/migrations.
-- كان الجدول موجوداً حياً فقط لأنه أُنشئ يدوياً مرة واحدة (لصق
-- docs/supabase_setup.sql في Supabase Dashboard) قبل أي ترحيل مُتتبَّع —
-- تماماً نفس فجوة triggers.projects_count المُصلَحة سابقاً في
-- 20260721170000_projects_count_triggers.sql. لو أُعيد بناء القاعدة من
-- supabase/migrations فقط (بيئة جديدة/CI مستقبلية)، كان أول سطر ينفَّذ فعلياً
-- ضد الجدول (20260708090000_enable_rls_studies.sql: alter table
-- public.studies enable row level security) سيفشل فوراً بخطأ "relation
-- public.studies does not exist" — إذ لا شيء قبله يُنشئ الجدول أصلاً.
--
-- التاريخ متعمَّد بالعودة إلى ساعة قبل 20260708090000_enable_rls_studies.sql
-- (أول ترحيل مُتتبَّع في هذا المستودع بأكمله) لا تاريخ اليوم — كي يُنفَّذ هذا
-- الملف أولاً على أي بيئة جديدة، قبل أي ترحيل لاحق يفترض وجود الجدول ضمناً.
-- على الإنتاج الحي: بلا أي أثر — الجدول موجود فعلاً بنفس هذا المخطط بالضبط
-- (IF NOT EXISTS يتخطى إنشاءه)، والفهارس/الـtrigger أدناه idempotent بنفس
-- الأسلوب (IF NOT EXISTS / DROP...IF EXISTS ثم CREATE).
--
-- عمداً هنا: لا تفعيل RLS ولا سياسات وصول — 20260708090000_enable_rls_studies.sql
-- (اللاحق مباشرة في الترتيب الزمني) هو المصدر الوحيد المسؤول عن ذلك فعلياً على
-- الإنتاج الحي (بأسماء سياسات studies_select_own/إلخ)؛ تكرارها هنا بأسماء
-- مختلفة (كما في docs/supabase_setup.sql: "Users can view own studies") كان
-- سيُنشئ سياسات مكرِّرة زائدة على الإنتاج الحي بدل no-op حقيقي — إذ CREATE
-- POLICY بلا drop if exists مسبق ليس idempotent، وباسم مختلف عن السياسة
-- الحية لا يفشل بـ"already exists" بل يُضيف نسخة ثانية زائدة بصمت.
-- ═══════════════════════════════════════════════════════════════════════

-- gen_random_uuid() لا uuid_generate_v4() (الأخيرة في docs/supabase_setup.sql
-- الأصلي، تتطلب تفعيل امتداد uuid-ossp غير مُتتبَّع في أي ترحيل هنا) — كل
-- ترحيل آخر في هذا المستودع (orders/share_tokens/إلخ) يستخدم gen_random_uuid()
-- المتوفرة افتراضياً بلا أي CREATE EXTENSION إضافي. لا أثر على الإنتاج الحي
-- (IF NOT EXISTS يتخطى هذا البند بالكامل هناك، فالعمود الحي كما هو دون تغيير)؛
-- يهم فقط بيئة جديدة تُنشئ الجدول فعلياً من هذا الملف.
create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'مشروع جديد',
  description text,
  sector text,
  status text default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  data jsonb not null default '{}',
  thumbnail_url text,
  is_template boolean default false,
  last_calculated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_studies_user_id on public.studies(user_id);
create index if not exists idx_studies_status on public.studies(status);
create index if not exists idx_studies_updated_at on public.studies(updated_at desc);

-- public.update_updated_at() تُعرَّف أيضاً (بنفس الجسم حرفياً) في
-- 20260717000000_profiles_and_phone.sql — لكن ذلك الملف مؤرَّخ بعد هذا الملف
-- زمنياً، فالاعتماد عليه فقط كان سيكسر بيئة جديدة تُنفِّذ الترحيلات بترتيبها
-- الزمني (الدالة غير موجودة بعد حين ينفَّذ هذا الملف). create or replace
-- آمنة للتكرار تماماً — إعادة تعريفها هنا بنفس الجسم لاحقاً في 07-17 لا أثر له.
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_studies_updated_at on public.studies;
create trigger update_studies_updated_at
  before update on public.studies
  for each row
  execute function public.update_updated_at();
