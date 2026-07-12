-- ═══════════════════════════════════════════════════════════════════════
-- عدّاد استخدام حقيقي لصفحة الهبوط (2026-07-14) — بديل صادق للأرقام المصطنعة
-- التي يعرضها بعض المنافسين (مثال: "5,058 عميل" بلا إثبات). لا رقم هنا إلا
-- معدود فعلياً من قاعدة البيانات، حتى لو كان صغيراً أو صفراً حالياً — قرار
-- المالك صريح بهذا (يتسق مع تنظيف الأرقام الوهمية السابق من landing.html).
--
-- RLS يقصر SELECT على studies/orders لصاحبها فقط، فاستعلام anon مباشر
-- يُرجع 0 دائماً لا الإجمالي الحقيقي — لذا دالة security definer واحدة
-- تُرجع فقط عدّاً مجمَّعاً (لا صفوف فردية، لا أي بيانات شخصية).
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.get_public_usage_stats()
returns table (
  total_studies bigint,
  paid_studies bigint,
  certified_studies bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.studies) as total_studies,
    (select count(*) from public.orders where status = 'paid') as paid_studies,
    (select count(*) from public.orders where review_status = 'certified') as certified_studies;
$$;

grant execute on function public.get_public_usage_stats() to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (شغّله في SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════
--
-- محاكاة جلسة anon (بلا أي مصادقة) — يجب أن ينجح ويُرجع عدداً حقيقياً واحداً:
--   set local role anon;
--   select * from public.get_public_usage_stats();
--   reset role;
