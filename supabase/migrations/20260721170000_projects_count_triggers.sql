-- ══════════════════════════════════════════════════════════════════════════
-- توثيق ترحيل 2026-07-21: دالتا trigger (increment/decrement_projects_count)
-- كانتا مطبَّقتين حيّاً بلا أي ترحيل مقابل (من تشغيل docs/supabase_setup.sql
-- يدوياً في وقت سابق) — لو أُعيد بناء القاعدة من migrations فقط لغابتا بصمت.
-- SECURITY DEFINER هنا آمن: الدالتان trigger فقط (لا GRANT EXECUTE لأي دور
-- عميل)، تُستدعيان تلقائياً من on_study_created/on_study_deleted، وتحدّثان
-- عمود profiles.projects_count الخاص بمالك السجل فقط — غير مستخدَم حالياً في
-- أي واجهة (grep عبر web/ فارغ)، لكن إبقاؤه متسقاً أسلم من حذفه بلا طلب.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.increment_projects_count()
returns trigger as $$
begin
  update public.profiles
  set projects_count = projects_count + 1
  where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.decrement_projects_count()
returns trigger as $$
begin
  update public.profiles
  set projects_count = greatest(0, projects_count - 1)
  where id = old.user_id;
  return old;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_study_created on public.studies;
create trigger on_study_created
  after insert on public.studies
  for each row
  execute function public.increment_projects_count();

drop trigger if exists on_study_deleted on public.studies;
create trigger on_study_deleted
  after delete on public.studies
  for each row
  execute function public.decrement_projects_count();
