# قائمة التحقق للإنتاج (Production Checklist)

هذه القائمة تلخص الخطوات المطلوبة لتجهيز النظام للبيئة الإنتاجية.

## 1. الأمان والصلاحيات (RLS & Roles)
- [x] تفعيل RLS على جميع الجداول (`studies`, `templates`, `study_inputs`).
- [x] سياسات الوصول:
  - `templates`: القراءة للجميع (أو Authenticated)، الكتابة للـ Admin فقط.
  - `studies`: القراءة/الكتابة لصاحب الدراسة فقط (Owner).
  - `study_inputs`: القراءة/الكتابة لصاحب الدراسة فقط.
- [ ] **إجراء مطلوب**: تأكد من إنشاء دور `admin` في `auth.users` أو `app_metadata` وتحديث دالة `is_admin()` في SQL لتطابق طريقة التخزين الفعلية في Supabase (حالياً تفحص `app_metadata->>'role'`).

## 2. إدارة القوالب (Templates Versioning)
- [x] جدول `templates` يدعم `template_id` و `template_version`.
- [x] جدول `studies` يربط الدراسة بنسخة محددة (`template_id` + `template_version`).
- [x] سكربت `extract-excel-templates.ts` يمنع الكتابة فوق النسخ الموجودة (Idempotent).
- [x] واجهة المستخدم (`web/app.js`) تحمل النسخة المحددة للدراسة وتكشف عدم التطابق.

## 3. الاختبارات (Testing)
- [x] اختبارات الوحدة (Unit Tests) للمحرك المالي (`lib/calc`) باستخدام Vitest.
  - تغطية: NPV, IRR, Payback, Break-even, Delivery Commission.
- [ ] **إجراء مطلوب**: إعداد CI Pipeline (GitHub Actions أو غيرها) لتشغيل `npm test` عند كل Push.
- [ ] **إجراء مطلوب**: اختبارات E2E (End-to-End) باستخدام Playwright أو Cypress لسيناريوهات المستخدم الكاملة (إنشاء دراسة -> إدخال بيانات -> تصدير).

## 4. البنية التحتية (Infrastructure)
- [ ] **نسخ احتياطي (Backups)**: تفعيل النسخ الاحتياطي اليومي لقاعدة البيانات في Supabase (Point-in-Time Recovery إن أمكن).
- [ ] **مراقبة (Monitoring)**: إعداد Sentry أو أداة مشابهة لمراقبة أخطاء الـ Frontend والـ Edge Functions.
- [ ] **أداء (Performance)**: تفعيل Caching لملفات `definition.json` و Assets الثابتة عبر CDN.

## 5. الاعتمادية (Reliability)
- [x] التعامل مع الأخطاء في الواجهة (Error Boundaries / Toast Notifications).
- [x] التحقق من صحة المدخلات (QA Gate - Hard/Soft).
- [x] التحقق من اتساق التقرير (Report Consistency Check).

## 6. التعريب والترميز
- [ ] **مشكلة المسار العربي**: يفضل استخدام مسارات إنجليزية في بيئة الإنتاج لتجنب مشاكل الترميز في بعض الأدوات/الطرفيات.
