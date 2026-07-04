-- Templates table + access policies (Postgres / Supabase-style RLS)
-- الهدف:
-- - Admin فقط للتحرير (insert/update/delete)
-- - المستخدم يقرأ القوالب المنشورة ويبدأ "دراسة"
--
-- ملاحظة:
-- - هذا السكربت يفترض وجود auth (مثل Supabase).
-- - تعريف "admin" هنا يعتمد على JWT app_metadata.role = "admin".
--   إذا عندك طريقة أخرى (جدول roles مثلاً) عدّل دالة is_admin().

-- Required for gen_random_uuid() in vanilla Postgres:
-- create extension if not exists pgcrypto;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  -- Stable slug for UX/URLs. Not unique because we store multiple versions.
  slug text not null,
  name text not null,
  description text,
  country_code text not null default 'SA' check (country_code = 'SA'),
  domain text not null default 'restaurants' check (domain = 'restaurants'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),

  -- Versioning keys (read by studies)
  -- template_id mirrors TemplateDefinition.id
  template_id text not null,
  -- template_version mirrors TemplateDefinition.version
  template_version text not null,

  -- Canonical template JSON definition (matches web/template-types.d.ts)
  definition jsonb not null,

  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

-- Optional: keep updated_at fresh on updates
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_templates_set_updated_at on public.templates;
create trigger trg_templates_set_updated_at
before update on public.templates
for each row execute function public.set_updated_at();

-- RLS
alter table public.templates enable row level security;

-- Read access:
-- - Anyone can read published templates (so users can start a study).
drop policy if exists templates_select_published on public.templates;
create policy templates_select_published
on public.templates
for select
using (status = 'published');

-- Admin full access:
drop policy if exists templates_admin_all on public.templates;
create policy templates_admin_all
on public.templates
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Grants (Supabase typically manages roles, but these are safe defaults)
grant usage on schema public to anon, authenticated;
grant select on public.templates to anon, authenticated;
grant insert, update, delete on public.templates to authenticated;

-- ---- Migration helpers (safe to run multiple times) ----
-- If your `templates` table already exists from an older schema:
alter table public.templates add column if not exists template_id text;
alter table public.templates add column if not exists template_version text;

-- Backfill from JSON definition if present
update public.templates
set template_id = coalesce(template_id, definition->>'id'),
    template_version = coalesce(template_version, definition->>'version')
where (template_id is null or template_version is null)
  and definition is not null;

-- Allow multiple versions per slug (older schema had slug UNIQUE)
-- Default Postgres name for that constraint is typically: templates_slug_key
alter table public.templates drop constraint if exists templates_slug_key;

-- Uniqueness for versioning (must exist for UPSERT on (template_id, template_version))
create unique index if not exists uniq_templates_template_id_version
on public.templates(template_id, template_version);

create index if not exists idx_templates_slug on public.templates(slug);
create index if not exists idx_templates_status on public.templates(status);

