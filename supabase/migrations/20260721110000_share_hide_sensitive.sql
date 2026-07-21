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
  select s.title, s.sector, s.data, ss.permission, ss.hide_sensitive
  from public.study_shares ss
  join public.studies s on s.id = ss.study_id
  where ss.share_token = p_token
    and ss.revoked = false
    and (ss.expires_at is null or ss.expires_at > now())
  limit 1;
$$;

grant execute on function public.get_study_by_share_token(uuid) to anon, authenticated;
