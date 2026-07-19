-- حدّ حجم props في جدول events: السياسة تسمح بالإدراج لأي زائر (مسجَّل/مجهول) بلا
-- قيد، وحقل props (jsonb) بلا سقف حجم — ما يتيح لسكربت ضخّ صفوف بـ props ضخمة يضخّم
-- تخزين القاعدة ويرفع الفاتورة. هذا القيد يمنع الحمولات الكبيرة (يبقى event_name
-- مقيّداً بـ100 حرف من الترحيل الأصلي). لا يمنع كثرة الصفوف الصغيرة (يحتاج rate-limit
-- على مستوى التطبيق) لكنه يزيل أسوأ ناقل تضخّم.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_props_size_limit'
  ) then
    alter table public.events
      add constraint events_props_size_limit
      check (props is null or pg_column_size(props) <= 4096);
  end if;
end $$;
