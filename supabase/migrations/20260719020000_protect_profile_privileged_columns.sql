-- قفل أعمدة الامتياز في public.profiles ضد التعديل الذاتي.
-- سياسة UPDATE (20260717000000) تسمح للمستخدم بتحديث صفّه بلا تقييد أعمدة، فيستطيع من
-- DevTools رفع subscription_tier إلى 'enterprise' أو projects_count عبر REST بمفتاح anon.
-- لا شيء في التطبيق يكتب هذين العمودين عبر طلب مستخدم (الصلاحيات الفعلية تُقرأ من
-- app_metadata لا من هنا، وعدّاد المشاريع يُحسب من صفوف studies)، فنعيدهما لقيمتهما
-- القديمة لأي كاتب end-user (authenticated/anon)، ونسمح لـ service_role وللوصول المباشر
-- للقاعدة (لا JWT). بلا هذا كان التزوير يلوّث إحصاءات لوحة الأدمن (admin by_tier) ويشكّل
-- لغماً لأي ميزة مستقبلية تثق بهذا العمود.
create or replace function public.protect_profile_privileged_columns()
returns trigger as $$
begin
  if coalesce(auth.role(), 'service_role') in ('authenticated', 'anon') then
    new.subscription_tier := old.subscription_tier;
    new.projects_count := old.projects_count;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_profile_privileged_columns on public.profiles;
create trigger protect_profile_privileged_columns
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileged_columns();
