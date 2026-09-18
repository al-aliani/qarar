-- No-code site content management for the owner/admin dashboard.

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  title text not null check (char_length(title) between 1 and 160),
  status text not null default 'draft' check (status in ('draft','published','disabled')),
  template text not null default 'standard' check (template in ('standard','landing','article')),
  seo_title text check (char_length(seo_title) <= 160),
  seo_description text check (char_length(seo_description) <= 320),
  social_image_url text,
  content jsonb not null default '{"sections":[]}'::jsonb,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_navigation (
  id uuid primary key default gen_random_uuid(),
  location text not null default 'header' check (location in ('header','footer_platform','footer_company','footer_legal')),
  label text not null check (char_length(label) between 1 and 100),
  href text not null check (char_length(href) between 1 and 500),
  sort_order int not null default 0,
  enabled boolean not null default true,
  open_new_tab boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  logo_url text,
  website_url text,
  description text check (char_length(description) <= 500),
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_content_revisions (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('page','navigation','partner')),
  entity_id uuid not null,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists site_pages_status_idx on public.site_pages(status, updated_at desc);
create index if not exists site_navigation_location_order_idx on public.site_navigation(location, sort_order);
create index if not exists site_partners_order_idx on public.site_partners(sort_order) where enabled;
create index if not exists site_content_revisions_entity_idx on public.site_content_revisions(entity_type, entity_id, created_at desc);

alter table public.site_pages enable row level security;
alter table public.site_navigation enable row level security;
alter table public.site_partners enable row level security;
alter table public.site_content_revisions enable row level security;

create policy "published pages are public" on public.site_pages for select to anon, authenticated
  using (status = 'published' or public.is_admin(auth.uid()));
create policy "admins manage pages" on public.site_pages for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "enabled navigation is public" on public.site_navigation for select to anon, authenticated
  using (enabled or public.is_admin(auth.uid()));
create policy "admins manage navigation" on public.site_navigation for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "enabled partners are public" on public.site_partners for select to anon, authenticated
  using (enabled or public.is_admin(auth.uid()));
create policy "admins manage partners" on public.site_partners for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "admins read revisions" on public.site_content_revisions for select to authenticated
  using (public.is_admin(auth.uid()));

create or replace function public.capture_site_content_revision()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    insert into public.site_content_revisions(entity_type, entity_id, snapshot, changed_by)
    values (case tg_table_name when 'site_pages' then 'page' when 'site_navigation' then 'navigation' else 'partner' end,
            old.id, to_jsonb(old), auth.uid());
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  if tg_table_name = 'site_pages' then new.updated_by := auth.uid(); end if;
  return new;
end $$;

drop trigger if exists site_pages_revision on public.site_pages;
create trigger site_pages_revision before update or delete on public.site_pages for each row execute function public.capture_site_content_revision();
drop trigger if exists site_navigation_revision on public.site_navigation;
create trigger site_navigation_revision before update or delete on public.site_navigation for each row execute function public.capture_site_content_revision();
drop trigger if exists site_partners_revision on public.site_partners;
create trigger site_partners_revision before update or delete on public.site_partners for each row execute function public.capture_site_content_revision();

insert into public.site_pages(slug, title, status, template, seo_title, seo_description, content)
values ('home', 'الصفحة الرئيسية', 'published', 'landing', 'قرار | منصة دراسة الجدوى الذكية',
  'منصة قرار لدراسات الجدوى الشاملة في السعودية.',
  '{"hero":{"eyebrow":"دراسة جدوى سعودية مبنية على أرقام قابلة للتدقيق","title":"قبل أن تصرف أول ريال، اعرف رقم مشروعك الحقيقي.","description":"ابنِ دراسة جدوى واضحة، اختبر الافتراضات، واتخذ قرارك قبل الالتزام بالتكاليف.","primary_label":"ابدأ دراستك الآن","primary_url":"./index.html?auth=1&cta=hero","secondary_label":"اطلب مراجعة خبير","secondary_url":"./index.html?auth=1&pkg=reviewed&cta=hero-review"},"final_cta":{"title":"قبل أن توقّع عقد الإيجار، اختبر القرار بالأرقام","description":"حوّل الحماس إلى قرار استثماري تستطيع الدفاع عنه."},"sections":[]}'::jsonb)
on conflict (slug) do nothing;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set public=true, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy "public reads site media" on storage.objects for select to anon, authenticated using (bucket_id = 'site-media');
create policy "admins upload site media" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and public.is_admin(auth.uid()));
create policy "admins update site media" on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and public.is_admin(auth.uid())) with check (bucket_id = 'site-media' and public.is_admin(auth.uid()));
create policy "admins delete site media" on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and public.is_admin(auth.uid()));

revoke execute on function public.capture_site_content_revision() from public, anon, authenticated;
grant execute on function public.capture_site_content_revision() to service_role;
