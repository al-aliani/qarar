-- study_inputs table + access policies (Postgres / Supabase-style RLS)
-- الهدف:
-- - تخزين JSON المدخلات لكل Study (Source of Truth)
-- - القراءة/التعديل لصاحب الدراسة فقط
-- - Admin صلاحيات كاملة

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- create extension if not exists pgcrypto;

create table if not exists public.study_inputs (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  -- Backwards-compatible JSON payload column.
  inputs jsonb not null default '{}'::jsonb,
  -- Preferred name (requested by app layer). Kept in sync with `inputs`.
  inputs_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_id)
);

create index if not exists idx_study_inputs_study_id on public.study_inputs(study_id);

-- Migration helper (idempotent): add inputs_json if missing and backfill
alter table public.study_inputs
  add column if not exists inputs_json jsonb;

update public.study_inputs
set inputs_json = inputs
where inputs_json is null;

-- Keep inputs/inputs_json synchronized (so old and new app code both work)
create or replace function public.study_inputs_sync()
returns trigger
language plpgsql
as $$
declare
  chosen jsonb;
begin
  -- Prefer explicit inputs_json, otherwise inputs.
  chosen := coalesce(new.inputs_json, new.inputs, '{}'::jsonb);
  new.inputs := chosen;
  new.inputs_json := chosen;
  return new;
end;
$$;

drop trigger if exists trg_study_inputs_sync on public.study_inputs;
create trigger trg_study_inputs_sync
before insert or update on public.study_inputs
for each row execute function public.study_inputs_sync();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_study_inputs_set_updated_at on public.study_inputs;
create trigger trg_study_inputs_set_updated_at
before update on public.study_inputs
for each row execute function public.set_updated_at();

alter table public.study_inputs enable row level security;

-- Owner-based access: derived from studies.owner_id
drop policy if exists study_inputs_select_own on public.study_inputs;
create policy study_inputs_select_own
on public.study_inputs
for select
to authenticated
using (
  exists (
    select 1
    from public.studies s
    where s.id = study_inputs.study_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists study_inputs_insert_own on public.study_inputs;
create policy study_inputs_insert_own
on public.study_inputs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.studies s
    where s.id = study_inputs.study_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists study_inputs_update_own on public.study_inputs;
create policy study_inputs_update_own
on public.study_inputs
for update
to authenticated
using (
  exists (
    select 1
    from public.studies s
    where s.id = study_inputs.study_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.studies s
    where s.id = study_inputs.study_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists study_inputs_delete_own on public.study_inputs;
create policy study_inputs_delete_own
on public.study_inputs
for delete
to authenticated
using (
  exists (
    select 1
    from public.studies s
    where s.id = study_inputs.study_id
      and s.owner_id = auth.uid()
  )
);

-- Admin full access
drop policy if exists study_inputs_admin_all on public.study_inputs;
create policy study_inputs_admin_all
on public.study_inputs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.study_inputs to authenticated;

