-- ═══════════════════════════════════════════════════════════════════════
-- فهارس ناقصة على مسارَي استعلام ساخنَين (2026-08-29):
--
-- 1) track_event() (20260722091000_track_event_ratelimit_fix.sql) يُنفِّذ عند
--    كل حدث تحليلي (يعني تقريباً كل تفاعل صفحة):
--      select count(*) from public.events
--      where session_id = p_session_id and created_at > now() - interval '10 minutes'
--    events لم يكن لديها أي فهرس يتضمّن session_id إطلاقاً — الفهرس الوحيد
--    القائم (events_name_created_idx، من 20260716000000_admin_dashboard.sql)
--    على (event_name, created_at) لا يخدم هذا الاستعلام. فحص تسلسلي كامل على
--    كل استدعاء لدالة تُستدعى من المتصفح بلا مصادقة.
--
-- 2) get_public_usage_stats() (20260714000000_public_usage_stats.sql) يُنفِّذ:
--      select count(*) from public.orders where status = 'paid'
--      select count(*) from public.orders where review_status = 'certified'
--    orders ليس لديها فهرس عادي على status إطلاقاً. وorders لديها فهرس على
--    review_status لكنه **جزئي** (orders_review_status_reviewed_idx، من
--    20260713000000_reviewer_portal.sql):
--      create index ... on public.orders (review_status) where tier = 'reviewed';
--    استعلام get_public_usage_stats لا يتضمّن أي شرط على tier في WHERE — ومخطِّط
--    Postgres لا يستخدم فهرساً جزئياً إلا إذا استطاع إثبات أن شرط WHERE في
--    الاستعلام يستلزم منطقياً محمول الفهرس (predicate implication عبر
--    predtest.c). بما أن `review_status = 'certified'` لا يستلزم `tier =
--    'reviewed'` (الأصل tier قد يكون أي قيمة أخرى)، هذا الفهرس الجزئي غير
--    قابل للاستخدام لهذا الاستعلام تحديداً — رغم وجوده. لذا فهرس عادي كامل
--    مطلوب على review_status أيضاً، لا تكراراً بل تغطية فعلية غير موجودة حالياً.
--
-- تنويه صريح: لا توجد بيئة Postgres/Supabase محلية في هذا المستودع (لا
-- supabase/config.toml، لا docker-compose، لا psql محلي) لتشغيل EXPLAIN فعلي
-- والتحقق التجريبي من خطة الاستعلام. القرارات أعلاه مبنية على قراءة تعريفات
-- الفهارس الفعلية + سلوك مخطِّط Postgres الموثَّق (شكل الفهرس المركّب يطابق
-- شكل الاستعلام: مساواة أولاً session_id ثم مدى created_at؛ واستحالة استخدام
-- فهرس جزئي بمحمول غير مُستلزَم من WHERE الاستعلام) لا على قياس تجريبي.
-- ═══════════════════════════════════════════════════════════════════════

create index if not exists events_session_id_idx
  on public.events (session_id, created_at);

create index if not exists orders_status_idx
  on public.orders (status);

create index if not exists orders_review_status_idx
  on public.orders (review_status);
