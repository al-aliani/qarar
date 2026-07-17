create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','processing','completed','rejected')),
  created_at timestamptz not null default now(), unique(user_id,status)
);
alter table public.account_deletion_requests enable row level security;
create policy "deletion_select_own" on public.account_deletion_requests for select using (auth.uid()=user_id);
create policy "deletion_insert_own" on public.account_deletion_requests for insert with check (auth.uid()=user_id and status='requested');
create policy "deletion_admin_update" on public.account_deletion_requests for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
