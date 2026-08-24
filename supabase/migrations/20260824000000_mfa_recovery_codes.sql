-- ═══════════════════════════════════════════════════════════════════════
-- رموز استرداد المصادقة الثنائية (2FA Recovery Codes) — 2026-08-24
-- يُطبَّق بعد إعداد MFA (TwoFactorModal.js / supabaseClient.js mfa* الحالية).
--
-- المشكلة التي يحلّها: لا يوجد أي مسار "فقدت جهاز المصادقة؟" حالياً — مستخدم
-- فقد تطبيق المصادقة (أو حذفه بالخطأ) يُحبَس عند تحدي AAL2 في AuthModalStub.js
-- للأبد بلا أي مخرج، رغم أن كلمة مروره صحيحة تماماً. المسار العادي
-- (auth.mfa.unenroll) لا يحل شيئاً لأنه يتطلب هو نفسه AAL2 من نفس الجلسة —
-- بالضبط ما لا يملكه من فقد جهازه فعلاً. الحل: دفعة رموز استرداد لمرة واحدة
-- تُعرَض فور أول تفعيل ناجح، تُستهلَك عبر Edge Function بصلاحية service_role
-- (supabase/functions/mfa-recovery-unenroll) تستدعي admin.mfa.deleteFactor —
-- نظير إداري لا يشترط AAL2 من جلسة المستخدم نفسها. راجع
-- supabase/functions/mfa-recovery-generate و mfa-recovery-unenroll.
-- ═══════════════════════════════════════════════════════════════════════

-- جدول منفصل عمداً بلا أي سياسة RLS لأي دور — نفس مبدأ phone_otp_challenges
-- (20260717010000) و rate_limit_events (20260821010000): رفض افتراضي تام،
-- القراءة/الكتابة الوحيدة عبر service_role داخل mfa-recovery-generate/
-- mfa-recovery-unenroll. لا تُخزَّن الرموز الخام إطلاقاً — code_hash فقط
-- (HMAC-SHA256 بسرّ RECOVERY_CODE_HASH_SECRET، منفصل عن OTP_HASH_SECRET —
-- رموز الاسترداد طويلة العمر بخلاف رموز OTP قصيرة العمر، فلا يجوز مشاركة
-- نفس السرّ بينهما).
create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  -- null = غير مستخدَم بعد. تنبيه: التصميم الحالي لا يترك أي صف بـused_at
  -- غير null فعلياً — استهلاك رمز صحيح واحد يحذف الدفعة العشرة كاملة فوراً
  -- (mfa-recovery-unenroll)، لا يعلّم صفاً واحداً فقط. العمود مُبقًى للتوافق
  -- مع بديل "كل رمز single-use منفصل" إن اختاره المالك لاحقاً بدل الحذف
  -- الكامل — لا يُقرأ حالياً في أي مسار غير شرط .is('used_at', null) نفسه.
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mfa_recovery_codes_user_idx
  on public.mfa_recovery_codes (user_id);

alter table public.mfa_recovery_codes enable row level security;
-- عمداً: لا سياسة select/insert/update/delete لأي دور (anon/authenticated) —
-- رفض تام. حتى مالك الصف نفسه لا يُسمَح له بقراءة code_hash مباشرة من
-- المتصفح؛ التحقق يمر حصراً عبر Edge Function بصلاحية service_role.

-- ═══════════════════════════════════════════════════════════════════════
-- تحقق يدوي بعد التطبيق (شغّله في SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════
--
-- أ) تأكيد الجدول وRLS:
--   select relname, relrowsecurity from pg_class where relname = 'mfa_recovery_codes';
--
-- ب) محاكاة مستخدم عادي يحاول قراءة هاش رموزه الخاصة مباشرة — يجب أن يفشل:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uid-فعلي>","role":"authenticated"}';
--   select * from public.mfa_recovery_codes where user_id = '<uid-فعلي>'; -- صفر صفوف (لا خطأ)
--   reset role;
--
-- ج) محاكاة anon — يجب أن يفشل كل شيء:
--   set local role anon;
--   select * from public.mfa_recovery_codes; -- صفر صفوف
--   insert into public.mfa_recovery_codes (user_id, code_hash) values ('<uid-فعلي>', 'x'); -- يجب أن يفشل
--   reset role;
