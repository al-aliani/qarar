# اختبارات E2E (Playwright)

## الإعداد

```bash
npm install
npx playwright install
```

## التشغيل

- تشغيل جميع اختبارات E2E (يشغّل السيرفر تلقائياً):
  ```bash
  npm run test:e2e
  ```
- تشغيل مع واجهة Playwright:
  ```bash
  npm run test:e2e:ui
  ```

## الملفات

- `playwright.config.js` — إعداد Playwright (baseURL، webServer على المنفذ 5173)
- `e2e/app.spec.js` — اختبارات أساسية: تحميل الصفحة، الشريط الجانبي، زر التصدير، المحتوى الرئيسي

## ملاحظات

- السيرفر يُشغّل تلقائياً قبل التشغيل (`npm run dev`).
- في CI ضع `CI=1` لعدم إعادة استخدام سيرفر موجود.
