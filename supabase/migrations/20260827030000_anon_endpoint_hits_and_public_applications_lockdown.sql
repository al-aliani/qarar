-- دفعة 3 من خطة إغلاق فجوات الطبقات الـ16 (لوحة تقييم 2026-08-27، طبقة Rate
-- limiting). فحص مستقل وجد أن public_applications (نموذج طلب انضمام خبير/
-- مورّد) يُدرَج مباشرة من المتصفح بمفتاح anon عبر PostgREST، بلا أي Edge
-- Function وسيطة وبلا أي حدّ معدّل خادمي — دفاعه الوحيد حقل honeypot أمامي
-- (web/js/public-applications.js) يتجاوزه أي طلب API مباشر بالكامل.
--
-- القرار (هذا الصباح: "قِس أولاً"؛ بتاريخه نفسه أُعيد فتحه بطلب صريح: ابنِ
-- الآن): Edge Function جديدة (submit-application) تتوسّط كل إدراج، مع حدّ
-- معدّل بمعرّف IP مُجزَّأ (anonRateLimit.ts) وفحص honeypot خادمي حقيقي.
--
-- 1) جدول معزول تماماً لحدّ المعدّل المجهول الهوية — لا نمدّد rate_limit_events
--    الموجود (عمود user_id فيه not null references auth.users، وتوثيقه الخاص
--    يمنع تمرير أي معرّف غير مستخرَج من JWT صراحة).
create table if not exists public.anon_endpoint_hits (
  id bigint generated always as identity primary key,
  endpoint text not null,
  identifier_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists anon_endpoint_hits_lookup_idx
  on public.anon_endpoint_hits (endpoint, identifier_hash, created_at desc);

alter table public.anon_endpoint_hits enable row level security;
-- عمداً: صفر سياسات لأي دور غير service_role — لا قراءة ولا كتابة من anon/
-- authenticated (نفس فلسفة rate_limit_events تماماً).

-- 2) إغلاق ثغرة الإدراج المباشر: بدون هذا، الـEdge Function الجديدة عديمة
--    الجدوى — أي طلب مباشر لجدول public_applications عبر PostgREST يتجاوزها
--    كلياً. الإدراج الآن حصراً عبر service_role داخل submit-application.
drop policy if exists "public_applications_insert" on public.public_applications;
