-- Studies table + access policies (Postgres / Supabase-style RLS)
-- الهدف:
-- - المستخدم ينشئ دراسة من قالب ويعدّلها (ملكيته فقط)
-- - قراءة/تعديل/حذف الدراسات: صاحبها فقط
-- - Admin صلاحيات كاملة
--
-- ملاحظة:
-- - يعتمد على auth (مثل Supabase).
-- - admin حسب JWT app_metadata.role = "admin" (كما في TEMPLATES_TABLE_AND_POLICIES.sql).

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- create extension if not exists pgcrypto;

create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),

  -- Versioned template binding (prevents old studies from breaking)
  -- template_id: the TemplateDefinition.id (string)
  -- template_version: the TemplateDefinition.version (semver string)
  template_id text,
  template_version text,

  -- Legacy (kept for readability/back-compat in older studies/exports)
  template_slug text not null,

  status text not null default 'draft' check (status in ('draft', 'final', 'archived')),

  -- Study payload (wizard inputs + outputs snapshots + optional attachments)
  data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- Migration helpers (safe to run multiple times) ----
-- If your table already exists (older schema), you can apply:
alter table public.studies add column if not exists template_id text;
alter table public.studies add column if not exists template_version text;

create index if not exists idx_studies_owner on public.studies(owner_id);
create index if not exists idx_studies_template_id_version on public.studies(template_id, template_version);
create index if not exists idx_studies_template_slug on public.studies(template_slug);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_studies_set_updated_at on public.studies;
create trigger trg_studies_set_updated_at
before update on public.studies
for each row execute function public.set_updated_at();

alter table public.studies enable row level security;

-- User: can read only own studies
drop policy if exists studies_select_own on public.studies;
create policy studies_select_own
on public.studies
for select
to authenticated
using (owner_id = auth.uid());

-- User: can insert only as self
drop policy if exists studies_insert_own on public.studies;
create policy studies_insert_own
on public.studies
for insert
to authenticated
with check (owner_id = auth.uid());

-- User: can update only own
drop policy if exists studies_update_own on public.studies;
create policy studies_update_own
on public.studies
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- User: can delete only own
drop policy if exists studies_delete_own on public.studies;
create policy studies_delete_own
on public.studies
for delete
to authenticated
using (owner_id = auth.uid());

-- Admin full access
drop policy if exists studies_admin_all on public.studies;
create policy studies_admin_all
on public.studies
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.studies to authenticated;

