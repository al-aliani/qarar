-- إصلاح أمني (تدقيق 2026-09-04): «إخفاء البيانات المالية الحساسة» كان يُخفي 5 أقسام
-- من 31، فتصل بقية الدراسة كاملةً إلى حامل رابط المشاركة.
--
-- الترحيل السابق (20260721110000) استخدم قائمة سوداء:
--     s.data - 'hr' - 'technical' - 'financing' - 'administrative' - 'marketing' - 'opex' - 'capex'
-- ومنها 'opex' و'capex' ليسا مفتاحَي قسم أصلاً في SECTIONS (web/js/core/schema.js)،
-- فحذفهما لا يفعل شيئاً. النتيجة أن 26 قسماً تُرسَل كما هي، وفيها تحديداً:
--   financialStatements (قائمة الدخل والمركز المالي والتدفقات النقدية كاملة)،
--   zakatTax، breakEven، valuation، monteCarlo، scenarios، actuals،
--   logistics (تكاليف المرافق والتوصيل الشهرية)، keyPeople (وعقود الشراكة)،
--   orgStructure، services، techResources، legal، operational.
--
-- والوعد المعروض للمستخدم أشدّ من ذلك: الخانة تقول «إخفاء البيانات المالية الحساسة
-- (الرواتب، التكاليف التفصيلية)» (web/js/ui/ShareStudyView.js:183)، وواجهة العرض
-- تُظهر «مخفي» مكان *كل* مبلغ ونسبة (ShareView.js formatMoney/formatPercent) — فيطمئن
-- المشارِك إلى أن لا رقم مالي يغادر، بينما تبويب الشبكة يعرض JSON كاملاً. الرابط
-- مجهول بلا مصادقة، فمن يُعاد توجيه الرابط إليه يقرأه أيضاً.
--
-- الإصلاح: قلب المنطق إلى قائمة بيضاء. القائمة السوداء تنكسر صامتاً كلما أُضيف قسم
-- جديد إلى المخطط (وهو ما حدث فعلاً)، بينما القائمة البيضاء تفشل في الاتجاه الآمن:
-- القسم الجديد لا يُشارَك حتى يُضاف صراحةً هنا.
--
-- الأقسام المسموح بها = ما تقرأه شاشة العرض فعلاً (ShareView.js: projectInfo,
-- marketSizing, revenue) + assumptions اللازمة للحساب + أقسام سردية/استراتيجية بلا
-- تفصيل مالي. لا تغيير على الحالة الافتراضية (hide_sensitive = false ⟶ data كاملة).

create or replace function public.get_study_by_share_token(p_token uuid)
returns table (
  title text,
  sector text,
  data jsonb,
  permission text,
  hide_sensitive boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.title,
    s.sector,
    case when ss.hide_sensitive
      then (
        select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
        from jsonb_each(s.data) as e(key, value)
        where e.key = any (array[
          'projectInfo',
          'marketSizing',
          'revenue',
          'assumptions',
          'strategic',
          'riskAnalysis',
          'smartGoals',
          'timeline',
          'businessModel',
          'executiveSummary',
          'appendices'
        ])
      )
      else s.data
    end as data,
    ss.permission,
    ss.hide_sensitive
  from public.study_shares ss
  join public.studies s on s.id = ss.study_id
  where ss.share_token = p_token
    and ss.revoked = false
    and (ss.expires_at is null or ss.expires_at > now())
  limit 1;
$$;

grant execute on function public.get_study_by_share_token(uuid) to anon, authenticated;
