-- ═══════════════════════════════════════════════════════════════════════
-- public.profiles + رقم الجوال (واتساب) عند التسجيل (2026-07-17)
--
-- فجوة حقيقية سابقة: public.profiles مُستخدم فعلياً منذ فترة (admin_dashboard.sql
-- يقرأ منه total_users/subscription_tier/daily_signups، وsupabaseClient.js يحوي
-- getUserProfile/updateUserProfile) لكن تعريفه لم يكن موجوداً في أي ملف داخل
-- supabase/migrations — عاش فقط في docs/supabase_setup.sql (يُطبَّق يدوياً عبر
-- SQL Editor، خارج مسار الترحيلات المتتبَّع). هذا الملف يُدخله رسمياً ضمن
-- الترحيلات (idempotent — آمن حتى لو كان الجدول موجوداً أصلاً من تطبيق يدوي
-- سابق لـ docs/supabase_setup.sql)، ويضيف التقاط رقم الجوال عند التسجيل
-- (raw_user_meta_data->>'phone'، يُمرَّر من signUp() في web/supabaseClient.js)
-- الذي لم يكن موجوداً في handle_new_user() الأصلية هناك (كانت تلتقط
-- full_name فقط).
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  phone text,
  avatar_url text,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'pro', 'enterprise')),
  projects_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- تلتقط الآن full_name وphone معاً من raw_user_meta_data (تحديث عن نسخة
-- docs/supabase_setup.sql الأصلية التي كانت تلتقط full_name فقط).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.update_updated_at();
