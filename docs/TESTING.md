# Testing

## Visual regression (Playwright)
- **الملف**: `e2e/visual.spec.js`
- **التشغيل**: `npm run test:e2e:visual`
- **تحديث اللقطات**: `npm run test:e2e -- e2e/visual.spec.js --update-snapshots`
- لقطات الشاشة تُحفظ في مجلد الاختبار وتُقارن في التشغيلات التالية.

## اختبارات متصفحات متعددة
- **التشغيل**: `npm run test:e2e:all-browsers`
- يشغّل الاختبارات E2E على Chromium و Firefox و WebKit (Safari).
- الإعداد في `playwright.config.js` — مشاريع: chromium, firefox, webkit.

## Unit tests (Vitest)
هذا المشروع يستخدم **Vitest** لاختبارات وحدات محرك الحسابات.

### ملفات الاختبار
- `lib/calc/__tests__/` — المحرك القديم (Calc)
- `web/js/core/__tests__/engine.test.js` — المحرك المالي الجديد (NPV, IRR, Payback)
- `web/js/utils/__tests__/validation.test.js` — التحقق من صحة البيانات

### التثبيت
من جذر المشروع:

```bash
npm i -D vitest
```

### التشغيل

```bash
npm test
```

أو وضع المراقبة:

```bash
npm run test:watch
```

