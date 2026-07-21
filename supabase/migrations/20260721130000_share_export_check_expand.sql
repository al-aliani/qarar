-- ══════════════════════════════════════════════════════════════════════════
-- توسيع قيود CHECK لقيم أُضيفت في الواجهة بعد إنشاء الجدولين (تدقيق 2026-07-21).
-- الجدولان أُنشئا في ترحيلات سابقة، فنعدّل القيد بترحيل مستقلّ (drop if exists ثم add)
-- ليعمل سواء كان القيد الأصلي موجوداً (من الإعداد الكنسي) أو غير موجود.
-- ══════════════════════════════════════════════════════════════════════════

-- 1) study_shares.permission: الواجهة تعرض خيار 'edit_copy' (نسخة تجريبية للمستثمر
--    ليعدّل الأرقام دون التأثير على الأصل)، ويعالجه app.js (renderShareRoute → sandbox).
--    كان القيد الكنسي يقصره على view/edit/admin فيرفض إدراج 'edit_copy' فيفشل إنشاء
--    الرابط دائماً. نضمن السماح به مع إبقاء بقية القيم.
alter table public.study_shares drop constraint if exists study_shares_permission_check;
alter table public.study_shares
  add constraint study_shares_permission_check
  check (permission is null or permission in ('view', 'edit', 'admin', 'edit_copy'));

-- 2) export_history.file_type: أنواع تصدير جديدة (تقرير جاهز للإقراض/منشآت/نسخة المراجعة/
--    المراجعة الاحترافية) تُسجَّل عبر trackExport، لكن القيد الأصلي يقصر النوع على
--    pdf/word/excel/pptx فيرفض إدراجها بصمت (فلا تظهر في مركز التنزيلات، وقد يُرفع
--    الملف ثم ييتّم في التخزين). نوسّع القيد ليشمل الأنواع المستخدمة فعلاً.
alter table public.export_history drop constraint if exists export_history_file_type_check;
alter table public.export_history
  add constraint export_history_file_type_check
  check (file_type in (
    'pdf', 'word', 'excel', 'pptx',
    'lending_ready', 'review_copy', 'professional_review', 'monshaat'
  ));
