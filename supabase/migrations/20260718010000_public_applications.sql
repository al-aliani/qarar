create table if not exists public.public_applications (
  id uuid primary key default gen_random_uuid(),
  application_type text not null check (application_type in ('expert','supplier')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (char_length(phone) between 9 and 20),
  email text,
  sector text not null check (char_length(sector) between 2 and 120),
  summary text not null check (char_length(summary) between 10 and 2000),
  status text not null default 'new' check (status in ('new','reviewing','accepted','rejected')),
  created_at timestamptz not null default now()
);
alter table public.public_applications enable row level security;
drop policy if exists "public_applications_insert" on public.public_applications;
create policy "public_applications_insert" on public.public_applications for insert to anon, authenticated with check (status = 'new');
drop policy if exists "public_applications_admin_select" on public.public_applications;
create policy "public_applications_admin_select" on public.public_applications for select to authenticated using (public.is_admin(auth.uid()));
drop policy if exists "public_applications_admin_update" on public.public_applications;
create policy "public_applications_admin_update" on public.public_applications for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
