-- ═══════════════════════════════════════════════════════════════════════
-- ترحيل قابل لإعادة التشغيل بأمان (idempotent): يُنشئ bucket التخزين
-- 'attachments' ويفرض سياسات RLS عليه برمجياً عبر migration مُتتبَّعة، بنفس
-- نمط 20260829040000_enable_rls_study_shares.sql (وقبله
-- 20260708090000_enable_rls_studies.sql).
--
-- الفجوة (اكتُشفت 2026-08-29 أثناء إعادة تقييم أمنية عدائية): لا يوجد أي
-- ترحيل مُتتبَّع في supabase/migrations ينشئ bucket 'attachments' أو يضبط
-- سياساته — الحماية الحيّة موجودة فقط لأنها طُبِّقت يدوياً مرة واحدة من
-- docs/supabase_setup.sql (القسم 8) عبر Supabase Dashboard، تماماً كما كان
-- حال study_shares قبل إصلاحه بالترحيل السابق بالأعلى. إعادة بناء المشروع من
-- supabase/migrations فقط (بيئة CI/مشروع جديد) تترك bucket 'attachments' إما
-- غير موجود إطلاقاً (يفشل رفع/سرد المرفقات بصمت نسبي، انظر رسائل الخطأ
-- "bucket not found" في web/js/services/AttachmentsService.js) أو — إذا أُنشئ
-- يدوياً بلا سياساته المرافقة — بلا أي عزل بين المستخدمين على storage.objects.
--
-- المصدر الكنسي (canonical source) لهذا الترحيل: docs/supabase_setup.sql
-- القسم 8 "Storage Bucket for Attachments" — السطور التي تُنشئ bucket بنفس
-- الاسم والخصائص (public=false) وتُعرّف نفس السياسات الثلاث أدناه بنفس
-- الاسم والمنطق حرفياً. هذا الملف نسخ مطابق لذلك القسم، لا سياسات جديدة
-- مُخترَعة — لا اختلاف وظيفي عن الإنتاج الحي عند تشغيل هذا الملف عليه (كل
-- سياسة تُحذَف إن وُجدت أولاً فيُتفادى خطأ "policy already exists")، وعلى
-- بيئة جديدة يُنشئها لأول مرة مطابقة تماماً لما كان مُطبَّقاً يدوياً أصلاً.
--
-- منطق العزل: كل ملف يُرفَع تحت مسار {auth.uid()}/{studyId}/{file} (انظر
-- folderPrefix في AttachmentsService.js) — أول جزء من المسار عبر
-- storage.foldername(name))[1] هو معرّف المستخدم المالك، فتقصر كل سياسة
-- الوصول على مجلد المستخدم نفسه فقط. لا سياسة UPDATE عمداً (السلوك الفعلي في
-- AttachmentsService.js هو upload بـupsert:false ثم remove — لا استبدال ملف
-- قائم في مكانه أبداً)، مطابقةً تماماً لغياب سياسة UPDATE في المصدر الكنسي
-- نفسه.
-- ═══════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- RLS على storage.objects مُفعّلة افتراضياً من Supabase لكل الجداول تحتها —
-- لا حاجة لـalter table صريح هنا (نفس ملاحظة docs/supabase_setup.sql القسم 8
-- ونفس نمط bucket 'exports' في 20260716000002_dashboard_experience.sql).

drop policy if exists "Users can view own attachments" on storage.objects;
create policy "Users can view own attachments"
    on storage.objects for select
    using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload own attachments" on storage.objects;
create policy "Users can upload own attachments"
    on storage.objects for insert
    with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own attachments" on storage.objects;
create policy "Users can delete own attachments"
    on storage.objects for delete
    using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- تحقق يدوي بعد التطبيق (SQL Editor):
--   select id, public from storage.buckets where id = 'attachments';
--   select policyname, cmd from pg_policies
--     where schemaname = 'storage' and tablename = 'objects'
--     and policyname like '%own attachments%';
