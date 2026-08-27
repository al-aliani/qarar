-- ═══════════════════════════════════════════════════════════════════════
-- دفعة 7 (2026-08-27، نظافة قاعدة البيانات): سياسة notifications_update_own
-- (20260716000002_dashboard_experience.sql) يرافقها تعليق يدّعي "لا نسمح
-- بتعديل أي عمود آخر [غير read_at] عبر RLS بسيطة" — لكن هذا غير صحيح فعلياً:
-- RLS في Postgres تُقيِّد أي الصفوف (rows) يمكن الوصول إليها، لا أي الأعمدة —
-- USING(auth.uid()=user_id) WITH CHECK(نفس الشرط) يسمحان فعلياً بتعديل title/
-- body/type/study_id/created_at لأي صف يملكه المستخدم نفسه، لا read_at فقط
-- كما يزعم التعليق. الأثر الفعلي محدود (نطاق الصف يبقى صفوف المستخدم نفسه
-- فقط — لا تسريب بين المستخدمين)، لكنه فجوة صدق حقيقية بين التوثيق والسلوك،
-- ولا مستهلك عميلي شرعي يعتمد على تعديل غير read_at (تحقّق: NotificationService.js
-- .markRead()/.markAllRead() هما المستدعيان الوحيدان من كود التطبيق، وكلاهما
-- .update({ read_at }) حصراً — لا شيء يعتمد فعلياً على حرية تعديل أعمدة أخرى).
--
-- الإصلاح: trigger فعلي يرفض أي UPDATE يغيّر عموداً غير read_at، لا مجرد
-- تصحيح نص التعليق — يجعل السلوك الفعلي مطابقاً لما كان مُدَّعى منذ البداية.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.notifications_restrict_update_columns()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.study_id is distinct from old.study_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'notifications: يمكن تعديل عمود read_at فقط عبر هذا المسار';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_restrict_update_columns on public.notifications;
create trigger notifications_restrict_update_columns
  before update on public.notifications
  for each row
  execute function public.notifications_restrict_update_columns();
