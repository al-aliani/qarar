-- عيب مؤكد من قائمة مراجعة 2026-08-27 (fable backlog، مجموعة account-deletion):
-- لا صلاحية للعميل لحذف ملف تصدير واحد بعينه من مركز التنزيلات — لا سياسة
-- RLS للحذف لا على جدول export_history ولا على bucket 'exports' (فقط
-- select/insert مُعرَّفتان في 20260716000002_dashboard_experience.sql)، رغم
-- أن الزر المقابل سيُضاف في DownloadsCenterView.js في نفس التغيير. بلا هذه
-- السياسات، أي محاولة حذف من العميل تفشل بصمت (RLS تمنع افتراضياً بلا سياسة
-- مطابقة) رغم أن Storage API لا يُرجع خطأ واضحاً دائماً.
--
-- نفس فلسفة المخاطر الموثّقة أصلاً لهذا الجدول تحديداً (تعليق 20260716000002):
-- العميل يُنشئ سجل التصدير بنفسه مباشرة، فلا قيمة مالية أو ثقة معرَّضة
-- للتلاعب — أسوأ حالة هي حذف المستخدم لملفه/سجله الخاص هو فقط، بلا أثر على
-- أي طرف آخر. هذا يخالف تماماً orders/notifications (بلا insert/delete
-- للعميل عمداً لأنها سجلات مالية/إشعارية موثوقة الخادم) ولا يُعاد النظر
-- فيهما هنا.

drop policy if exists "export_history_delete_own" on public.export_history;
create policy "export_history_delete_own"
  on public.export_history for delete
  using (auth.uid() = user_id);

drop policy if exists "exports_delete_own" on storage.objects;
create policy "exports_delete_own"
  on storage.objects for delete
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);
