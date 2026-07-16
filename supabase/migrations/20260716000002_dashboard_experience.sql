-- ═══════════════════════════════════════════════════════════════════════
-- تجربة لوحة مستخدم متكاملة (2026-07-16) — أربع إضافات مستقلة:
-- 1) notifications: إشعارات حقيقية (ليست فقط UI محلي) — دفع/مراجعة/تذكير.
-- 2) export_history + storage bucket 'exports': مركز تنزيلات حقيقي — كل
--    تصدير PDF/Word/Excel يُرفع نسخة فعلية بدل الاكتفاء بتنزيل المتصفح.
-- 3) check_stale_studies(): تذكير تلقائي لدراسة لم تُلمَس منذ 3 أيام، عبر
--    pg_cron يومي — أول استخدام حقيقي لجدولة داخل هذا المشروع.
-- 4) list_my_share_links(): "روابط المشاركة التي أنشأتها" — study_shares
--    (docs/supabase_setup.sql + migration 20260714020000) لا يحمل عمود
--    مالك مباشر، فالتحقق من الملكية يمر عبر JOIN مع studies.user_id؛
--    دالة security definer بنفس نمط get_study_by_share_token/
--    admin_list_unverified_phones الموجودتين فعلاً بهذا المستودع.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1) الإشعارات ─────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('payment', 'review', 'reminder', 'system')),
  title text not null,
  body text,
  study_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

-- تعليم كمقروء فقط (read_at) — لا نسمح بتعديل أي عمود آخر عبر RLS بسيطة؛
-- لا حاجة لضبط أدق من هذا حالياً (لا حقول حساسة أخرى قابلة للتعديل هنا).
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- عمداً: لا insert/delete لأي دور غير service_role (نفس مبدأ orders) —
-- إشعار لا يُنشئه العميل نفسه، فقط أحداث خادمية موثوقة (دفع/مراجعة) أو
-- check_stale_studies() أدناه (تعمل كـsecurity definer، تتجاوز RLS).

-- ─── 2) مركز التنزيلات ────────────────────────────────────────────────
create table if not exists public.export_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_id text,
  study_name text,
  file_type text not null check (file_type in ('pdf', 'word', 'excel', 'pptx')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists export_history_user_id_idx on public.export_history (user_id, created_at desc);

alter table public.export_history enable row level security;

drop policy if exists "export_history_select_own" on public.export_history;
create policy "export_history_select_own"
  on public.export_history for select
  using (auth.uid() = user_id);

-- بخلاف orders/notifications: العميل نفسه يُنشئ سجل التصدير مباشرة بعد نجاح
-- الرفع لـStorage (لا قيمة مالية أو ثقة معرَّضة للتلاعب هنا — أسوأ حالة
-- تلاعب هي مستخدم يُدرج سجلاً وهمياً لنفسه فقط، بلا أثر على أي طرف آخر).
drop policy if exists "export_history_insert_own" on public.export_history;
create policy "export_history_insert_own"
  on public.export_history for insert
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;

drop policy if exists "exports_select_own" on storage.objects;
create policy "exports_select_own"
  on storage.objects for select
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "exports_insert_own" on storage.objects;
create policy "exports_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── 3) تذكير الدراسات الراكدة (pg_cron) ─────────────────────────────
-- يفترض وجود public.studies (id, user_id, updated_at) فعلياً — معرَّفة في
-- docs/supabase_setup.sql ومُستخدَمة فعلياً في migration 20260714020000
-- (share_tokens) دون إعادة تعريفها هناك؛ نفس الافتراض هنا لعدم ازدواج
-- تعريف الجدول بنسخة قد تتعارض مع النسخة الحية الفعلية.
create or replace function public.check_stale_studies()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, study_id)
  select
    s.user_id,
    'reminder',
    'دراستك بانتظارك',
    'دراسة «' || coalesce(s.title, 'بدون اسم') || '» لم تُحدَّث منذ أكثر من 3 أيام.',
    s.id::text
  from public.studies s
  where s.updated_at < now() - interval '3 days'
    and s.status <> 'archived'
    and not exists (
      select 1 from public.notifications n
      where n.study_id = s.id::text
        and n.type = 'reminder'
        and n.created_at > now() - interval '7 days'
    );
end;
$$;

-- تفعيل الجدولة اليومية — قد يفشل هذا السطر تحديداً بصلاحية العميل العادية
-- إن لم يكن امتداد pg_cron مُفعَّلاً مسبقاً من تبويب Database → Extensions في
-- لوحة تحكم Supabase (بعض المشاريع تتطلب تفعيلاً يدوياً من هناك أولاً) — باقي
-- هذا الملف يُطبَّق بنجاح بشكل مستقل عن نجاح هذا الجزء تحديداً.
create extension if not exists pg_cron;

select cron.schedule(
  'check-stale-studies-daily',
  '0 9 * * *',
  $$select public.check_stale_studies()$$
) where not exists (
  select 1 from cron.job where jobname = 'check-stale-studies-daily'
);

-- ─── 4) روابط المشاركة التي أنشأتها ──────────────────────────────────
-- الإلغاء يمر عبر ShareService.js revokeShare(id) الموجودة أصلاً (تحديث مباشر
-- على study_shares، تعتمد على سياسة RLS "Study owners can manage shares"
-- القائمة سلفاً) — لا حاجة لدالة إلغاء جديدة هنا، فقط القراءة عبر كل الدراسات
-- (revokeShare تعمل بمعرّف صف واحد، لا تحتاج JOIN؛ القراءة عبر كل الدراسات هي
-- التي تحتاج JOIN وبالتالي security definer).
create or replace function public.list_my_share_links()
returns table (
  id uuid,
  share_token uuid,
  study_id uuid,
  study_title text,
  permission text,
  revoked boolean,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select ss.id, ss.share_token, ss.study_id, s.title, ss.permission, ss.revoked, ss.expires_at, ss.created_at
  from public.study_shares ss
  join public.studies s on s.id = ss.study_id
  where s.user_id = auth.uid()
  order by ss.created_at desc;
$$;

grant execute on function public.list_my_share_links() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (شغّله في SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════
--
-- أ) الإشعارات: rowsecurity يجب أن يكون true، ولا سياسة insert/delete لغير service_role:
--   select relname, relrowsecurity from pg_class where relname in ('notifications','export_history');
--   select policyname, cmd from pg_policies where tablename = 'notifications';
--
-- ب) تشغيل التذكير يدوياً مرة (بدل انتظار الجدولة) والتحقق من نتيجة فعلية:
--   select public.check_stale_studies();
--   select * from public.notifications where type = 'reminder' order by created_at desc limit 5;
--
-- ج) التأكد من نجاح جدولة cron (فارغة = فشل تفعيل pg_cron، يحتاج تفعيلاً يدوياً من اللوحة):
--   select jobname, schedule from cron.job where jobname = 'check-stale-studies-daily';
--
-- د) محاكاة مستخدم لروابط مشاركته (استبدل uid فعلياً مسجّل دخول):
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<user-uid>"}';
--   select * from public.list_my_share_links();
--   reset role;
