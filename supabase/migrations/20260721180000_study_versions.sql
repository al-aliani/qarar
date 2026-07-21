-- ══════════════════════════════════════════════════════════════════════════
-- توثيق ترحيل 2026-07-21: جدول study_versions (سجلّ إصدارات الدراسة) كان
-- مطبَّقاً حيّاً بلا أي ترحيل مقابل (من تشغيل docs/supabase_setup.sql يدوياً).
-- RLS مفعّل والسياسة مقيّدة بمالك الدراسة فقط — لا مشكلة أمنية، لكن بلا هذا
-- الترحيل يغيب الجدول تماماً عند إعادة بناء القاعدة من migrations فقط.
-- غير مستخدَم حالياً في أي واجهة (grep عبر web/ فارغ).
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.study_versions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  version_number integer not null,
  data jsonb not null,
  change_summary text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists idx_study_versions_study_id on public.study_versions(study_id);

alter table public.study_versions enable row level security;

drop policy if exists "Users can manage versions of own studies" on public.study_versions;
create policy "Users can manage versions of own studies" on public.study_versions
  for all using (
    exists (
      select 1 from public.studies
      where id = study_versions.study_id
      and user_id = auth.uid()
    )
  );
