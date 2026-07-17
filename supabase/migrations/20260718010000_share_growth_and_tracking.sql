-- ═══════════════════════════════════════════════════════════════════════
-- مشاركة كقناة نمو حقيقية (2026-07-18) — ثلاث إضافات مستقلة، نفس نمط
-- 20260716000002_dashboard_experience.sql (بند واحد لكل قسم، لا تشابك):
--
-- 1) تتبّع مشاهدات رابط المشاركة (نمط DocSend): تحويل "فُتح الرابط؟" من مجهول
--    لرقم حقيقي — سلاح تفاوضي فعلي لا يملكه منافس مباشر يُسلِّم ملفاً ميتاً.
-- 2) حلقة نمو: ربط توكن مشاركة بتسجيل حساب جديد لاحق (بلا بصمة شخصية، فقط
--    عدّاد قابل للشرح).
-- 3) تمييز "طلب تعريف تمويل" عن تذاكر الدعم العادية (support_tickets، بُنيت
--    بتاريخ 20260718000000) — عمود بدل تحليل نص هشّ لعنوان التذكرة.
--
-- يعتمد على: study_shares+share_token (20260714020000)، profiles+
-- handle_new_user (20260717000000)، support_tickets (20260718000000) —
-- يجب تطبيق الثلاثة أولاً.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1) تتبّع المشاهدات ────────────────────────────────────────────────
alter table public.study_shares
  add column if not exists view_count integer not null default 0,
  add column if not exists first_viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz;

-- تحديث ذرّي بدالة عامة (بلا مصادقة، نفس صلاحيات get_study_by_share_token) —
-- استدعاؤها من ShareView.js عند أول رسم فعلي للصفحة، مرة واحدة لكل تحميل.
create or replace function public.record_share_view(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.study_shares
  set view_count = view_count + 1,
      first_viewed_at = coalesce(first_viewed_at, now()),
      last_viewed_at = now()
  where share_token = p_token
    and revoked = false
    and (expires_at is null or expires_at > now());
end;
$$;

grant execute on function public.record_share_view(uuid) to anon, authenticated;

-- list_my_share_links (20260716000002_dashboard_experience.sql) يحتاج أعمدة المشاهدة
-- الجديدة أيضاً — drop+create صريح لا create or replace: تغيير قائمة أعمدة RETURNS TABLE
-- غير مضمون النجاح دائماً عبر create or replace في Postgres، والفارق الزمني الفعلي هنا
-- صفر (نفس الاستعلام الفوري).
drop function if exists public.list_my_share_links();
create function public.list_my_share_links()
returns table (
  id uuid,
  share_token uuid,
  study_id uuid,
  study_title text,
  permission text,
  revoked boolean,
  expires_at timestamptz,
  created_at timestamptz,
  view_count integer,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select ss.id, ss.share_token, ss.study_id, s.title, ss.permission, ss.revoked, ss.expires_at,
         ss.created_at, ss.view_count, ss.first_viewed_at, ss.last_viewed_at
  from public.study_shares ss
  join public.studies s on s.id = ss.study_id
  where s.user_id = auth.uid()
  order by ss.created_at desc;
$$;

grant execute on function public.list_my_share_links() to authenticated;

-- ─── 2) حلقة النمو: إحالة تسجيل عبر توكن مشاركة ───────────────────────
alter table public.profiles
  add column if not exists referred_by_token text;

-- create or replace: نفس الدالة المعرَّفة في profiles_and_phone.sql، إضافة
-- التقاط referred_by_token فقط (لا تكرار لبقية المنطق — idempotent تماماً
-- كنمط الملف الأصلي نفسه).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, referred_by_token)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'referred_by_token'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- ─── 3) تصنيف تذاكر الدعم: طلب تعريف تمويل مقابل دعم عادي ─────────────
alter table public.support_tickets
  add column if not exists category text not null default 'support'
    check (category in ('support', 'funding_introduction'));

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════
--
-- أ) تتبّع المشاهدات — بعد إنشاء رابط مشاركة (من القسم السابق):
--   select public.record_share_view('<share_token-فعلي>');
--   select view_count, first_viewed_at, last_viewed_at from public.study_shares
--     where share_token = '<share_token-فعلي>';  -- view_count=1، الطابعان مضبوطان
--   select public.record_share_view('<نفس-share_token>');
--   select view_count from public.study_shares where share_token = '<نفس-share_token>';
--     -- view_count=2، first_viewed_at لم يتغيّر، last_viewed_at تحدَّث
--
-- ب) حلقة النمو — بعد تسجيل مستخدم جديد بـreferred_by_token في raw_user_meta_data:
--   select id, referred_by_token from public.profiles where id = '<user-uuid-فعلي>';
--
-- ج) تصنيف التذاكر:
--   select category from public.support_tickets limit 1; -- 'support' افتراضياً للصفوف القديمة
