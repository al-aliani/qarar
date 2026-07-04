# إطلاق Beta — محاكي الجدوى (مطاعم السعودية)

## 1) الهدف
إطلاق نسخة Beta قابلة للاستخدام لتوليد:
- Wizard إدخال بيانات
- نتائج (P&L / Cash Flow / KPIs / Break-even / Scenarios/Sensitivity)
- تصدير Excel مطابق للقالب المعياري + تصدير تقرير PDF

## 2) الصلاحيات + RLS (قاعدة البيانات)
ملفات SQL جاهزة:
- `templates/TEMPLATES_TABLE_AND_POLICIES.sql` (قوالب)
- `templates/STUDIES_TABLE_AND_POLICIES.sql` (دراسات)

سياسة عامة:
- القوالب: قراءة المنشور للجميع، تحرير للأدمن فقط.
- الدراسات: المستخدم يرى/يعدل/يحذف دراساته فقط، الأدمن صلاحيات كاملة.

## 3) تتبع الأخطاء
- داخل الواجهة: زر `تصدير سجل الأخطاء` يصدر JSON من الأخطاء المخزنة محليًا.
- صفحات الخصوصية/الشروط توضّح ذلك.

## 4) اختبار مسار كامل (Smoke)
افتح:
- `http://localhost:5173/web/smoke_test.html`

ثم اضغط “تشغيل الاختبار”.

## 5) التشغيل المحلي
من جذر المشروع:
- `powershell -ExecutionPolicy Bypass -File .\serve_local.ps1 -Port 5173`

ثم افتح:
- `http://localhost:5173/web/`

## 6) ملاحظات Beta
- Export Excel يعتمد على ExcelJS عبر CDN (يتطلب إنترنت) ما لم نوفر نسخة محلية.
- Export PDF يتم عبر طباعة نافذة HTML (Save as PDF).

