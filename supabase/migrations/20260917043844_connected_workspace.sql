-- طبقة الربط بين الدراسة والجهات والطلبات وعروض الأسعار والمراجعات وخطة التنفيذ.

create table if not exists public.external_parties (
  id uuid primary key default gen_random_uuid(),
  party_type text not null check (party_type in ('supplier','expert','partner','financier')),
  name text not null,
  description text,
  sectors text[] not null default '{}',
  cities text[] not null default '{}',
  website_url text,
  logo_url text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  active boolean not null default true,
  average_response_hours numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_id uuid references public.studies(id) on delete cascade,
  party_id uuid references public.external_parties(id) on delete set null,
  request_type text not null check (request_type in ('supplier_quote','expert_review','partnership','financing')),
  title text not null,
  details text,
  status text not null default 'new' check (status in ('new','received','processing','waiting_customer','offered','accepted','rejected','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.work_requests(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  party_id uuid references public.external_parties(id) on delete set null,
  section_key text not null,
  item_key text,
  item_label text not null,
  amount_sar numeric(14,2) not null check (amount_sar >= 0),
  vat_included boolean not null default false,
  valid_until date,
  attachment_url text,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.review_suggestions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  field_path text not null,
  old_value jsonb,
  proposed_value jsonb not null,
  rationale text not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null default 'manual' check (source_type in ('manual','decision','review','quote')),
  source_key text,
  title text not null,
  details text,
  status text not null default 'todo' check (status in ('todo','doing','blocked','done','dismissed')),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_id, source_type, source_key)
);

create index if not exists external_parties_type_active_idx on public.external_parties (party_type, active);
create index if not exists work_requests_user_created_idx on public.work_requests (user_id, created_at desc);
create index if not exists supplier_quotes_study_idx on public.supplier_quotes (study_id, created_at desc);
create index if not exists review_suggestions_study_idx on public.review_suggestions (study_id, status);
create index if not exists project_tasks_study_status_idx on public.project_tasks (study_id, status);

drop trigger if exists external_parties_updated_at on public.external_parties;
create trigger external_parties_updated_at before update on public.external_parties for each row execute function public.update_updated_at();
drop trigger if exists work_requests_updated_at on public.work_requests;
create trigger work_requests_updated_at before update on public.work_requests for each row execute function public.update_updated_at();
drop trigger if exists project_tasks_updated_at on public.project_tasks;
create trigger project_tasks_updated_at before update on public.project_tasks for each row execute function public.update_updated_at();

alter table public.external_parties enable row level security;
alter table public.work_requests enable row level security;
alter table public.supplier_quotes enable row level security;
alter table public.review_suggestions enable row level security;
alter table public.project_tasks enable row level security;

create policy "public_read_verified_parties" on public.external_parties for select to anon, authenticated
  using (active and verification_status = 'verified');
create policy "admins_manage_parties" on public.external_parties for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

create policy "users_read_own_requests" on public.work_requests for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "users_create_own_requests" on public.work_requests for insert to authenticated
  with check ((select auth.uid()) = user_id and (study_id is null or exists (select 1 from public.studies s where s.id = study_id and s.user_id = (select auth.uid()))));
create policy "admins_update_requests" on public.work_requests for update to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

create policy "users_read_own_quotes" on public.supplier_quotes for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "admins_manage_quotes" on public.supplier_quotes for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

create policy "owners_read_review_suggestions" on public.review_suggestions for select to authenticated
  using (exists (select 1 from public.studies s where s.id = study_id and s.user_id = (select auth.uid())) or public.is_reviewer_of_study(study_id) or public.is_admin((select auth.uid())));
create policy "reviewers_create_suggestions" on public.review_suggestions for insert to authenticated
  with check ((reviewer_id = (select auth.uid()) and public.is_reviewer_of_study(study_id)) or public.is_admin((select auth.uid())));
create policy "owners_manage_project_tasks" on public.project_tasks for all to authenticated
  using ((select auth.uid()) = user_id and exists (select 1 from public.studies s where s.id = study_id and s.user_id = (select auth.uid())))
  with check ((select auth.uid()) = user_id and exists (select 1 from public.studies s where s.id = study_id and s.user_id = (select auth.uid())));

grant select on public.external_parties to anon, authenticated;
grant insert, select on public.work_requests to authenticated;
grant update on public.work_requests to authenticated;
grant select on public.supplier_quotes to authenticated;
grant select, insert on public.review_suggestions to authenticated;
grant select, insert, update, delete on public.project_tasks to authenticated;

create or replace function public.decide_review_suggestion(target_id uuid, next_status text)
returns public.review_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  changed public.review_suggestions;
begin
  if next_status not in ('accepted','rejected') then raise exception 'invalid suggestion status'; end if;
  update public.review_suggestions rs
  set status = next_status, decided_at = now()
  where rs.id = target_id
    and rs.status = 'pending'
    and exists (select 1 from public.studies s where s.id = rs.study_id and s.user_id = (select auth.uid()))
  returning rs.* into changed;
  if changed.id is null then raise exception 'suggestion not found or forbidden'; end if;
  return changed;
end;
$$;
revoke all on function public.decide_review_suggestion(uuid, text) from public, anon;
grant execute on function public.decide_review_suggestion(uuid, text) to authenticated;

create or replace function public.accept_supplier_quote(target_id uuid)
returns public.supplier_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  changed public.supplier_quotes;
begin
  update public.supplier_quotes q
  set accepted_at = now()
  where q.id = target_id and q.user_id = (select auth.uid()) and q.accepted_at is null
  returning q.* into changed;
  if changed.id is null then raise exception 'quote not found or forbidden'; end if;
  update public.work_requests set status = 'accepted' where id = changed.request_id and user_id = (select auth.uid());
  return changed;
end;
$$;
revoke all on function public.accept_supplier_quote(uuid) from public, anon;
grant execute on function public.accept_supplier_quote(uuid) to authenticated;
