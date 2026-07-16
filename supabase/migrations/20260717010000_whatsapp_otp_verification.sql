-- ═══════════════════════════════════════════════════════════════════════
-- تحقق واتساب حقيقي للجوال + تفضيل باقة عند التسجيل (2026-07-17)
-- يُطبَّق بعد 20260717000000_profiles_and_phone.sql (يضيف عمود phone نفسه).
--
-- التحقق السابق للجوال كان شكلياً بالكامل (صيغة الرقم فقط عبر phoneUtils.js)
-- — لا اتصال فعلي بواتساب. هذا الملف يضيف حالة "تحقّق حقيقي" منفصلة تُضبَط
-- فقط من Edge Functions (whatsapp-otp-send/verify) بمفتاح service_role بعد
-- رمز واتساب فعلي يصل للعميل عبر WhatsApp Business Platform (ميتا) — لا بديل
-- محلي/وهمي لهذا. راجع supabase/functions/whatsapp-otp-verify/index.ts.
-- ═══════════════════════════════════════════════════════════════════════

-- 1) عمود التحقق — منفصل تماماً عن phone نفسه (رقم موجود ≠ رقم مُتحقَّق منه)
alter table public.profiles
  add column if not exists phone_verified boolean not null default false;

-- 2) تفضيل باقة عند التسجيل — غير مُلزم، لا يُنشئ أي صف orders ولا يُشغّل أي
-- دفع. القيم الثلاث الأولى تطابق معرّفات PRICING_PACKAGES (web/js/core/pricing.js
-- وsupabase/functions/_shared/pricing.ts) حرفياً — لا مفردات جديدة، فتُستخدَم
-- مباشرة لاحقاً لتمييز البطاقة المطابقة في PaywallModal.js. 'free' = خيار
-- "استخدم مجاناً الآن" — لا يقابله أي باقة فعلية بالتسعير، خيار واجهة فقط.
--
-- تنبيه تعارض تسمية متعمَّد: يوجد مفهوما "طبقة" آخران خاملان في هذا المشروع
-- ولا علاقة لهما بهذا العمود إطلاقاً — app_metadata.subscription_tier
-- (free/pro/enterprise، JWT claim يُكتب بالخادم فقط، يقرأه AuthGuard.
-- getSubscriptionTier) وprofiles.subscription_tier (نفس القيم، يقرأه admin_
-- users_stats فقط). preferred_tier عمود ثالث مستقل بقيم مختلفة تماماً
-- (self/reviewed/full/free) — لا تخلط بينها عند القراءة لاحقاً.
alter table public.profiles
  add column if not exists preferred_tier text
    check (preferred_tier in ('self', 'reviewed', 'full', 'free'));

-- 3) حماية phone_verified من التزوير عبر updateUserProfile() الموجودة أصلاً —
-- تلك الدالة تكتب لأي عمود يُمرَّر لها عبر سياسة RLS "Users can update own
-- profile" العريضة (auth.uid() = id فقط، بلا قيد أعمدة). بدون هذا التريغر
-- يقدر أي مستخدم يضبط phone_verified=true بنفسه بلا أي رمز واتساب فعلي.
create or replace function public.protect_phone_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (Edge Functions فقط) يتجاوز — هو الوحيد المخوَّل يضبط
  -- phone_verified فعلياً، بعد تحقق رمز حقيقي في whatsapp-otp-verify.
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- أي دور آخر: القيمة الجديدة تُتجاهَل قسراً، تبقى القديمة كما هي.
  new.phone_verified := old.phone_verified;

  -- استثناء وحيد: لو غيّر المستخدم رقم جواله فعلياً (عبر UserProfileView.js
  -- مثلاً)، "التحقق" السابق كان لرقم مختلف ولم يعد صالحاً — يُصفَّر تلقائياً
  -- بدل أن يبقى true زائفاً لرقم لم يُثبَت إطلاقاً.
  if new.phone is distinct from old.phone then
    new.phone_verified := false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_phone_verified on public.profiles;
create trigger trg_protect_phone_verified
  before update on public.profiles
  for each row
  execute function public.protect_phone_verified();

-- 4) تحديات رموز واتساب — جدول منفصل عمداً لا أعمدة على profiles. السبب:
-- getUserProfile() تنفّذ select('*') وprofiles له سياسة قراءة عريضة لصاحب
-- الصف (auth.uid() = id) — أي عمود سرّي (هاش الرمز مثلاً) يوضع هناك يصبح
-- مقروءاً من متصفح المستخدم نفسه ما لم يُستثنَ يدوياً بكل استدعاء select('*')
-- مستقبلي، وهذا اتفاق يُنسى بسهولة لا ضمان حقيقي. جدول منفصل بلا أي سياسة
-- RLS هو ضمان بنيوي: رفض افتراضي تام لأي دور، فقط service_role (يتجاوز RLS
-- بالكامل) يلمسه — نفس مبدأ public.orders تماماً (بلا سياسة insert/update
-- لأي دور عميل).
create table if not exists public.phone_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- أثر تدقيق: الرقم الذي أُرسل له هذا الرمز تحديداً (لا نعيد قراءة
  -- profiles.phone وقت التحقق — لو تغيّر الرقم بين الإرسال والتحقق، هذا
  -- التحدي يبقى مرتبطاً بالرقم الأصلي الذي أُرسل إليه فعلياً).
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists phone_otp_challenges_user_created_idx
  on public.phone_otp_challenges (user_id, created_at desc);

alter table public.phone_otp_challenges enable row level security;
-- عمداً: لا سياسة select/insert/update/delete لأي دور (anon/authenticated) —
-- رفض تام. القراءة/الكتابة الوحيدة عبر whatsapp-otp-send/verify بمفتاح
-- service_role.

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (شغّله في SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════
--
-- أ) تأكيد الأعمدة والجدول:
--   select column_name from information_schema.columns
--   where table_name = 'profiles' and column_name in ('phone_verified', 'preferred_tier');
--   select relname, relrowsecurity from pg_class where relname in ('profiles', 'phone_otp_challenges');
--
-- ب) محاكاة مستخدم عادي يحاول تزوير phone_verified مباشرة — يجب أن يبقى false:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uid-فعلي>","role":"authenticated"}';
--   update public.profiles set phone_verified = true where id = '<uid-فعلي>';
--   select phone_verified from public.profiles where id = '<uid-فعلي>'; -- يجب أن يبقى false
--   reset role;
--
-- ج) محاكاة anon ضد phone_otp_challenges — يجب أن يفشل كل شيء:
--   set local role anon;
--   select * from public.phone_otp_challenges; -- صفر صفوف (لا RLS تسمح، لا خطأ)
--   insert into public.phone_otp_challenges (user_id, phone, code_hash, expires_at)
--     values ('<uid-فعلي>', '+9665XXXXXXXX', 'x', now() + interval '5 minutes'); -- يجب أن يفشل
--   reset role;
