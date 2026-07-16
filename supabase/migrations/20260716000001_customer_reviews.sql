-- ═══════════════════════════════════════════════════════════════════════
-- تقييمات العملاء (2026-07-16) — قسم "آراء العملاء" في صفحة الهبوط يعرض فقط
-- تقييمات حقيقية أدخلها صاحب الموقع يدوياً؛ لا توجد واجهة عامة لإرسال تقييم.
-- يتّسق مع مبدأ "لا رقم/بيانات مصطنعة" الموثّق في 20260714000000_public_
-- usage_stats.sql — القسم يبقى مخفياً بصمت إن لم توجد أي تقييمات منشورة.
--
-- تعتمد على جدول public.admins ودالة public.is_admin(uid) المُنشأتين في
-- 20260716000000_admin_dashboard.sql — **يجب تطبيق ذلك الترحيل أولاً**، وإلا
-- فشلت سياسة reviews_admin_all أدناه بخطأ "relation public.admins does not
-- exist". لا تُعاد هنا تعريف admins إطلاقاً (كانت نسخة أولى من هذا الترحيل
-- تُنشئ admins بعمود إضافي active غير موجود في نسخة admin_dashboard —
-- تعارض تخطيط حقيقي بين ترحيلين متزامنين، صُحِّح بحذف التكرار والاعتماد على
-- الجدول/الدالة الموجودين فعلاً بدل تكرارهما بتخطيط مختلف).
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  review_text text not null,
  rating smallint not null check (rating between 1 and 5),
  -- وسم قطاع اختياري (نص حر، مثال: "مطاعم ومقاهي") لعرضه كشارة على البطاقة.
  -- لا يوجد enum ثابت للقطاعات في المشروع (sectorBenchmarks.js كشف نصي حر لا
  -- قائمة مغلقة) فلا داعٍ لاختراع تصنيف جديد؛ نص حر يكفي.
  sector_label text,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_published_sort_idx
  on public.reviews (published, sort_order)
  where published = true;

alter table public.reviews enable row level security;

-- القراءة العامة: فقط الصفوف المنشورة، بلا أي مصادقة. عكس get_public_usage_stats
-- (احتاجت دالة security definer لأنها تجميع عبر جداول studies/orders المقيَّدة
-- بسياسة "لصاحبها فقط") — هنا published=true سياسة مباشرة على reviews نفسه،
-- بلا مالك للصف، فـ anon يقرأ عبرها مباشرة دون أي طبقة وسيطة.
drop policy if exists "reviews_select_published" on public.reviews;
create policy "reviews_select_published"
  on public.reviews for select
  using (published = true);

-- المشرف: كل شيء (بما فيها المسودات غير المنشورة) — عبر public.is_admin(uid)
-- الموجودة فعلاً (20260716000000_admin_dashboard.sql)، لا فحص EXISTS مباشر
-- خاص بهذا الترحيل، كي يبقى تعريف "من هو أدمن" في مكان واحد فقط.
drop policy if exists "reviews_admin_all" on public.reviews;
create policy "reviews_admin_all"
  on public.reviews for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (شغّله في SQL Editor، بعد admin_dashboard وبعد إدراج
-- نفسك في admins حسب تعليماته)
-- ═══════════════════════════════════════════════════════════════════════
--
-- أ) محاكاة جلسة anon — يجب أن تُرجع فقط الصفوف المنشورة (أو صفراً إن لم
--    تُنشر أي مراجعة بعد؛ هذا سلوك متوقّع وصحيح، لا خطأ):
--   set local role anon;
--   select id, customer_name, rating, published from public.reviews;
--   -- يجب ألا تظهر أي صفوف published=false
--   reset role;
--
-- ب) محاكاة جلسة مشرف (استبدل <admin-auth-uid> بمعرّف أدرجته في admins):
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<admin-auth-uid>"}';
--   select count(*) from public.reviews; -- يجب أن يشمل المسودات أيضاً
--   insert into public.reviews (customer_name, review_text, rating, published)
--     values ('اختبار', 'نص تجريبي', 5, false);
--   reset role;
--
-- ج) محاكاة مستخدم عادي (غير مشرف) — يجب أن يفشل أي إدراج/تعديل:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<any-non-admin-auth-uid>"}';
--   insert into public.reviews (customer_name, review_text, rating)
--     values ('محاولة', 'نص', 5); -- يجب أن يفشل (RLS violation)
--   reset role;
