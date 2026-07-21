-- ملاحظات وطلبات تعديل على رابط مشاركة للقراءة فقط.
-- لا تمنح هذه القناة أي صلاحية تعديل للدراسة نفسها.

create table if not exists public.study_share_feedback (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.study_shares(id) on delete cascade,
  kind text not null check (kind in ('comment', 'revision_request')),
  author_name text,
  body text not null check (char_length(trim(body)) between 3 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists study_share_feedback_share_id_idx
  on public.study_share_feedback (share_id, created_at desc);

alter table public.study_share_feedback enable row level security;

-- يرسل حامل الرابط ملاحظة دون كشف الدراسة أو السماح بالتحرير.
create or replace function public.add_share_feedback(
  p_token uuid,
  p_kind text,
  p_author_name text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share_id uuid;
  v_feedback_id uuid;
begin
  select id into v_share_id
  from public.study_shares
  where share_token = p_token
    and revoked = false
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_share_id is null then
    raise exception 'رابط المشاركة غير صالح أو منتهي';
  end if;
  if p_kind not in ('comment', 'revision_request') then
    raise exception 'نوع الملاحظة غير صالح';
  end if;

  insert into public.study_share_feedback (share_id, kind, author_name, body)
  values (v_share_id, p_kind, nullif(trim(p_author_name), ''), trim(p_body))
  returning id into v_feedback_id;
  return v_feedback_id;
end;
$$;

grant execute on function public.add_share_feedback(uuid, text, text, text) to anon, authenticated;

-- يرى مالك الدراسة فقط كل الملاحظات في نافذة المشاركة.
create or replace function public.list_study_share_feedback(p_study_id uuid)
returns table (
  id uuid,
  kind text,
  author_name text,
  body text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select f.id, f.kind, f.author_name, f.body, f.created_at
  from public.study_share_feedback f
  join public.study_shares ss on ss.id = f.share_id
  join public.studies s on s.id = ss.study_id
  where ss.study_id = p_study_id
    and s.user_id = auth.uid()
  order by f.created_at desc;
$$;

grant execute on function public.list_study_share_feedback(uuid) to authenticated;
