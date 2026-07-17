-- إصلاح handle_new_user للدخول الأصيل بالجوال (تدقيق 2026-07-17).
--
-- الخلل المُصلَح: النسخة السابقة (20260717000000_profiles_and_phone.sql:45-52) تقرأ
-- الجوال من `new.raw_user_meta_data->>'phone'` فقط. ذلك صحيح لمسار signUp(email,
-- password, phone) القديم الذي يمرّر الرقم في بيانات التسجيل — لكن الدخول الأصيل
-- بالجوال (supabase.auth.signInWithOtp({phone}) في supabaseClient.js) لا يمرّ عبر
-- signUp إطلاقاً: raw_user_meta_data يبقى فارغاً، والرقم يصل في العمود new.phone.
--
-- الأثر قبل الإصلاح: profiles.phone = NULL لكل داخل بالجوال ← بوابة
-- AuthGuard._continuePhoneGate() (AuthGuard.js:146-155) تفتح CompletePhoneModal
-- «أكمل رقم جوالك» لمستخدم لتوّه أثبت ملكية جواله بالرمز — وقد يُدخل رقماً مختلفاً
-- فيتشعّب مصدرا الحقيقة (auth.users.phone مقابل profiles.phone).
--
-- فخّ الصيغة: auth.users.phone يُخزَّن أرقاماً فقط بلا '+' (9665...)، بينما
-- profiles.phone بصيغة E.164 بعلامة '+' (+9665...) كما ينتجها toE164SaudiPhone
-- في web/js/utils/phoneUtils.js. التوحيد يتم هنا، وإلا لبقيت المقارنات تفشل صامتةً.
--
-- أُضيف كذلك `set search_path = public` — كانت الدالة security definer بلا مسار
-- مثبّت (متجه تصعيد صلاحيات معروف)، بخلاف is_admin في 20260716000000_admin_dashboard.sql.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  v_phone := nullif(new.raw_user_meta_data->>'phone', '');

  if v_phone is null and nullif(new.phone, '') is not null then
    v_phone := case
                 when left(new.phone, 1) = '+' then new.phone
                 else '+' || new.phone
               end;
  end if;

  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', v_phone)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- التريغر نفسه دون تغيير (after insert on auth.users) — يُعاد ربطه احتياطاً فقط.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ترميم المتأثرين أصلاً: من دخل بالجوال قبل هذا الإصلاح لديه profiles.phone فارغ
-- بينما auth.users.phone مضبوط ومؤكَّد. نملأه من مصدر الحقيقة بدل مطالبته يدوياً.
-- لا نلمس صفاً فيه رقم بالفعل — قد يكون رقم تواصل مختلفاً أدخله المستخدم عمداً.
update public.profiles p
   set phone = case
                 when left(u.phone, 1) = '+' then u.phone
                 else '+' || u.phone
               end
  from auth.users u
 where u.id = p.id
   and nullif(p.phone, '') is null
   and nullif(u.phone, '') is not null;
