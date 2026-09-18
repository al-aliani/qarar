-- ═══════════════════════════════════════════════════════════════════════
-- إصلاح: سياسة "Shared users can view their shares" على public.study_shares
-- كانت تستعلم auth.users مباشرة:
--   shared_with_email = (select email from auth.users where id = auth.uid())
--
-- بوستجرس يتطلب صلاحية SELECT على auth.users لتقييم خطة RLS كاملة — لكل فروع
-- OR في السياسة، حتى الفرع الذي لا يطابق الصف فعلياً — قبل تنفيذ أي استعلام.
-- لا authenticated ولا anon يملكان هذه الصلاحية على auth.users، فأي قراءة من
-- study_shares (بما فيها RETURNING بعد INSERT من المالك نفسه عبر
-- .insert().select()) كانت تفشل بـ"permission denied for table users" —
-- حتى للمالك، الذي لا علاقة له بفرع "Shared users" أصلاً. اكتُشف 2026-09-16
-- عند فشل حقيقي لإنشاء رابط مشاركة في تدقيق تجربة مستخدم حيّ: الإنشاء نفسه
-- نجح (سياسة المالك لا تلمس auth.users) فترك صفاً "يتيماً" غير مرئي، وقائمة
-- الروابط بقيت فارغة (listShares يُبلّع الخطأ ويُرجع []).
--
-- الحل: قراءة البريد من مطالبة JWT (auth.jwt()->>'email') بدل استعلام الجدول —
-- Supabase تضع بريد المستخدم في مطالبة email القياسية لكل جلسة، فلا حاجة لأي
-- صلاحية جدول إضافية ولا فرق في القيمة الفعلية. idempotent (drop if exists)
-- بنفس نمط 20260829040000_enable_rls_study_shares.sql.
-- ═══════════════════════════════════════════════════════════════════════

drop policy if exists "Shared users can view their shares" on public.study_shares;
create policy "Shared users can view their shares" on public.study_shares
    for select using (
        shared_with_user_id = auth.uid() or
        shared_with_email = (auth.jwt() ->> 'email')
    );

-- اختبار تحقق يدوي (SQL Editor):
--   select polname, pg_get_expr(polqual, polrelid) from pg_policy
--   where polrelid = 'public.study_shares'::regclass;
--   -- يجب ألا يظهر أي مرجع لـauth.users في الناتج.
