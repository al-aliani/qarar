# تشغيل المنصة محلياً

## المنافذ

| الخدمة        | المنفذ | الملاحظة                          |
|--------------|--------|-----------------------------------|
| **Vite** (الواجهة) | 5173   | `npm run dev` — لا تشغّل `python -m http.server` على 5173 |
| **خادم AI** (Python) | 8080   | `ai_server.py` أو `ai_server_enhanced.py` — الـ proxy في Vite يوجّه `/api` إلى 8080 |

## التشغيل

- **الواجهة فقط:** `npm run dev`
- **الواجهة + AI:** 
  - `serve_local.ps1` يشغّل AI على 8080، ثم `npm run dev` للواجهة على 5173
  - أو `start_all.bat` (يشغّل `ai_server.py` + `npm run dev`)

## تجنب التضارب

- لا تستخدم `python -m http.server 5173` — المنفذ 5173 مخصّص لـ Vite.
- خادم AI يجب أن يعمل على **8080** لأن `vite.config.js` يوجّه طلبات `/api` إلى `http://localhost:8080`.
