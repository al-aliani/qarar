-- ═══════════════════════════════════════════════════════════════════════
-- مشاركة فعلية بصلاحيات (2026-07-14) — onepage.sa (منافس) عندهم "رقم مرجعي"
-- حقيقي لمشاركة الدراسة بصلاحيات وصول. عندنا جدول study_shares موجود أصلاً
-- (docs/supabase_setup.sql) لكنه مصمَّم لمشاركة بريد/حساب فقط
-- (shared_with_email NOT NULL) وغير مربوط بأي كود JS إطلاقاً — نوسّعه هنا
-- برمز مشاركة مجهول (share_token) بدل بناء جدول موازٍ.
--
-- ملاحظة نطاق صريحة: هذه الجولة تُفعِّل صلاحية 'view' فقط. عمود permission
-- يقبل 'edit'/'admin' أصلاً بالجدول القديم لكن منطقهما غير مُفعَّل هنا —
-- السماح لحامل رمز مجهول بالتعديل على دراسة طرف آخر قرار أمني أكبر يحتاج
-- تصميماً منفصلاً لاحقاً (مثال: تتبّع من عدّل ماذا، تعارض تحرير متزامن).
-- ═══════════════════════════════════════════════════════════════════════

alter table public.study_shares
  alter column shared_with_email drop not null;

alter table public.study_shares
  add column if not exists share_token uuid not null default gen_random_uuid() unique,
  add column if not exists expires_at timestamptz,
  add column if not exists revoked boolean not null default false;

create index if not exists idx_study_shares_token on public.study_shares (share_token);

-- دالة قراءة عامة (بلا مصادقة) لحامل رمز مشاركة صالح — تُرجع فقط الحقول
-- اللازمة للعرض (title/sector/data/permission)، عمداً بلا user_id أو أي
-- معرّف يكشف هوية صاحب الدراسة لحامل الرابط.
create or replace function public.get_study_by_share_token(p_token uuid)
returns table (
  title text,
  sector text,
  data jsonb,
  permission text
)
language sql
security definer
set search_path = public
stable
as $$
  select s.title, s.sector, s.data, ss.permission
  from public.study_shares ss
  join public.studies s on s.id = ss.study_id
  where ss.share_token = p_token
    and ss.revoked = false
    and (ss.expires_at is null or ss.expires_at > now())
  limit 1;
$$;

grant execute on function public.get_study_by_share_token(uuid) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (شغّله في SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════
--
-- أ) إنشاء صف مشاركة تجريبي (استبدل <study-uuid-فعلي>):
--   insert into public.study_shares (study_id, permission)
--   values ('<study-uuid-فعلي>', 'view') returning share_token;
--
-- ب) محاكاة جلسة anon بالرمز الناتج — يجب أن تُرجع صفاً واحداً:
--   set local role anon;
--   select * from public.get_study_by_share_token('<share_token-الناتج>');
--   reset role;
--
-- ج) بعد تحديث revoked=true أو تعيين expires_at بالماضي — نفس الاستدعاء
--    يجب أن يُرجع صفراً من الصفوف (لا خطأ، فقط لا نتيجة).
