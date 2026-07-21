-- إضافة عمود hide_sensitive لخيارات المشاركة
alter table public.study_shares
  add column if not exists hide_sensitive boolean not null default false;

-- تحديث دالة get_study_by_share_token لإرجاع هذا العمود
drop function if exists public.get_study_by_share_token(uuid);

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
  -- أمني: عند hide_sensitive نجرّد الأقسام المالية الحساسة (الرواتب، التكاليف
  -- التفصيلية، هيكل التمويل، المصاريف) من data داخل الدالة نفسها قبل الإرجاع — لا
  -- نعتمد على إخفاء المتصفح وحده. كان إرسال data كاملاً يجعل الإخفاء تجميلياً: يفتح
  -- المستلم تبويب الشبكة فيرى JSON كامل الدراسة. عامل jsonb '-' يحذف مفاتيح المستوى
  -- الأعلى؛ نبقي projectInfo/revenue/marketSizing/assumptions لعرض النتائج العليا.
  select
    s.title,
    s.sector,
    case when ss.hide_sensitive
      then (s.data - 'hr' - 'technical' - 'financing' - 'administrative' - 'marketing' - 'opex' - 'capex')
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
