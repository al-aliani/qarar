-- ═══════════════════════════════════════════════════════════════════════
-- تحقق واتساب يدوي بدل رمز آلي عبر ميتا (2026-07-17، تعديل قرار لاحق)
--
-- 20260717010000_whatsapp_otp_verification.sql بنى تحققاً آلياً كاملاً عبر
-- WhatsApp Business Platform (ميتا) — يبقى كوده قائماً وصالحاً (Edge Functions
-- whatsapp-otp-send/verify + phone_otp_challenges) لمن يريد التفعيل لاحقاً،
-- لكن يتطلب حساب Meta Business حقيقي وموافقة قالب رسالة خارجية — قرار المالك
-- الآن تأجيل هذا وتفعيل مسار أبسط فوراً بلا أي اعتماد خارجي: العميل يفتح
-- واتساب برسالة جاهزة موجَّهة لرقم صاحب الموقع نفسه (نفس آلية wa.me
-- الموجودة أصلاً في PaywallModal.js/config.js)، وصاحب الموقع يؤكد يدوياً من
-- لوحة الأدمن بعد ما يستلم الرسالة فعلياً.
--
-- عمود جديد منفصل تماماً عن phone_verified: whatsapp_contact_prompted يعني
-- فقط "عُرضت عليه خطوة فتح واتساب" (تُضبط عند فتح/تخطي النافذة، بصرف النظر
-- هل أرسل فعلاً) — يمنع تكرار مطالبته بها كل دخول. phone_verified لا يتغيّر
-- إلا بفعل صريح من الأدمن.
--
-- تنبيه تصميم مهم (مراجعة ذاتية بعد محاولة أولى أوسع من اللازم): لا سياسة
-- RLS عامة تمنح الأدمن قراءة/كتابة كل صفوف profiles (بيانات شخصية لعملاء
-- آخرين — اسم، جوال، اسم شركة — نطاق أوسع بكثير من "تأكيد جوال واحد").
-- بدلاً من ذلك دالتان security definer ضيّقتا النطاق تحديداً، بنفس نمط
-- admin_overview_stats وغيرها (20260716000000_admin_dashboard.sql): تتحققان
-- من is_admin() داخلياً، الأولى تُرجع فقط الأعمدة اللازمة لعرض قائمة "بانتظار
-- التأكيد" (لا صف profiles كاملاً)، والثانية تُحدّث phone_verified لمستخدم
-- واحد محدَّد فقط. التريغر لا يُوسَّع لقبول أي أدمن مباشرة عبر updateUserProfile()
-- العامة — يثق فقط بعلم محلي (GUC) تضبطه الدالة الثانية نفسها قبل الكتابة،
-- فيبقى "من يُخوَّل هذا التعديل" مُعرَّفاً في مكان واحد فقط (الدالة).
-- ═══════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists whatsapp_contact_prompted boolean not null default false;

-- علم محلي بنطاق المعاملة (transaction) فقط — تضبطه admin_confirm_phone_verified
-- أدناه مباشرة قبل التحديث، يقرأه التريغر بعدها بنفس المعاملة. لا صلاحية
-- إضافية تُمنح لأي دور مباشرة عبر RLS أو JWT — فقط مسار الدالة هذا يضبطه.
create or replace function public.protect_phone_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or coalesce(current_setting('app.admin_phone_confirm', true), '') = 'true' then
    return new;
  end if;

  new.phone_verified := old.phone_verified;

  if new.phone is distinct from old.phone then
    new.phone_verified := false;
  end if;

  return new;
end;
$$;

-- قائمة "بانتظار التأكيد" — أعمدة دنيا فقط (لا صف profiles كاملاً)، وأدمن فقط.
create or replace function public.admin_list_unverified_phones()
returns table (
  id uuid,
  full_name text,
  phone text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select p.id, p.full_name, p.phone, p.created_at
    from public.profiles p
    where p.phone is not null and p.phone_verified = false
    order by p.created_at asc;
end;
$$;

-- تأكيد جوال مستخدم واحد محدَّد — أدمن فقط، لا يمسّ أي عمود آخر بالصف.
create or replace function public.admin_confirm_phone_verified(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  perform set_config('app.admin_phone_confirm', 'true', true);
  update public.profiles set phone_verified = true where id = target_user_id;
end;
$$;

grant execute on function public.admin_list_unverified_phones() to authenticated;
grant execute on function public.admin_confirm_phone_verified(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (شغّله في SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════
--
-- أ) محاكاة أدمن يستدعي القائمة والتأكيد — يجب أن ينجحا:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<admin-auth-uid>"}';
--   select * from public.admin_list_unverified_phones();
--   select public.admin_confirm_phone_verified('<other-user-uid>');
--   select phone_verified from public.profiles where id = '<other-user-uid>'; -- يجب true
--   reset role;
--
-- ب) محاكاة مستخدم عادي (غير أدمن) — يجب أن يفشل كلاهما بـ"not authorized":
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<non-admin-auth-uid>"}';
--   select * from public.admin_list_unverified_phones(); -- يجب يفشل
--   select public.admin_confirm_phone_verified('<other-user-uid>'); -- يجب يفشل
--   reset role;
--
-- ج) تأكيد عدم وجود أي سياسة RLS عامة جديدة على profiles تتجاوز "own row فقط":
--   select policyname, cmd from pg_policies where tablename = 'profiles';
--   -- يجب أن تظهر فقط سياسات "own profile" الثلاث الأصلية، لا شيء باسم admin_all
