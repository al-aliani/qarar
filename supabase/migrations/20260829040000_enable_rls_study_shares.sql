-- ═══════════════════════════════════════════════════════════════════════
-- ترحيل قابل لإعادة التشغيل بأمان (idempotent): يفرض RLS على جدول
-- study_shares برمجياً، بنفس نمط 20260708090000_enable_rls_studies.sql.
--
-- الفجوة (اكتُشفت 2026-08-29 أثناء إصلاح 20260714015000_study_shares_
-- table_bootstrap.sql): لا يوجد أي ترحيل مُتتبَّع يُفعِّل RLS على هذا الجدول
-- إطلاقاً — الحماية الحيّة موجودة فقط لأنها طُبِّقت يدوياً مرة واحدة مع
-- docs/supabase_setup.sql عبر Supabase Dashboard. إعادة بناء القاعدة من
-- supabase/migrations فقط (بيئة CI/مشروع جديد) تترك الجدول بلا أي حماية —
-- أي مستخدم مصادَق (anon key) يقدر يقرأ/يكتب/يحذف كل صفوف المشاركة لكل
-- المستخدمين، بما فيها بريد المستخدم المُشارَك معه (shared_with_email).
--
-- السياستان أدناه مطابقتان حرفياً لِما في docs/supabase_setup.sql (نفس
-- الاسم، نفس المنطق) — لا اختلاف وظيفي على القاعدة الحيّة عند تشغيل هذا
-- الملف عليها (drop if exists يمنع "policy already exists")، وعلى بيئة
-- جديدة يُنشئهما لأول مرة.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.study_shares enable row level security;

drop policy if exists "Study owners can manage shares" on public.study_shares;
create policy "Study owners can manage shares" on public.study_shares
    for all using (
        exists (
            select 1 from public.studies
            where id = study_shares.study_id
            and user_id = auth.uid()
        )
    );

drop policy if exists "Shared users can view their shares" on public.study_shares;
create policy "Shared users can view their shares" on public.study_shares
    for select using (
        shared_with_user_id = auth.uid() or
        shared_with_email = (select email from auth.users where id = auth.uid())
    );

-- اختبار تحقق يدوي (SQL Editor؛ rowsecurity يجب أن يكون true):
--   select relname, relrowsecurity from pg_class where relname = 'study_shares';
