# Load Balancing و CDN — دليل النشر والتوزيع

> تحسينات شهرية: موازنة الحمل ونشر المحتوى عبر CDN لتحسين الأداء والتوفر.

---

## 1. Load Balancing (موازنة الحمل)

### الهدف
- توزيع الطلبات على أكثر من خادم (أو نسخة من التطبيق) لتفادي نقطة فشل واحدة.
- تحسين زمن الاستجابة عند ارتفاع الحمل.

### خيارات التنفيذ

#### أ) Nginx كموزع أمام التطبيق

```nginx
upstream feasibility_app {
    least_conn;  # أو round_robin / ip_hash
    server 127.0.0.1:5173;  # Vite dev أو preview
    server 127.0.0.1:5174;  # نسخة ثانية إن وجدت
}

server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://feasibility_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### ب) موزع حمل سحابي
- **Vercel / Netlify**: توزيع تلقائي حسب المنطقة (Edge).
- **AWS**: Application Load Balancer (ALB) أمام EC2 أو ECS.
- **GCP**: Load Balancer أمام Cloud Run أو GKE.
- **Supabase**: استخدام Connection Pooler (PgBouncer) للقاعدة؛ الواجهة تُوزَّع عبر الاستضافة (Vercel/Netlify).

### معايير اختيار الاستراتيجية
- **عدد الزيارات المتوقع**: إذا منخفض، قد يكفي خادم واحد + CDN.
- **Backend (Python/Node)**: إن وُجد API، ضع الموازن أمامه وافصل عن الـ static (الواجهة).

---

## 2. CDN Deployment (نشر المحتوى عبر CDN)

### الهدف
- تقديم الملفات الثابتة (HTML, JS, CSS, صور) من أقرب نقطة للمستخدم.
- تقليل الحمل على الخادم الأصلي وتسريع التحميل.

### خطوات النشر مع Vite

1. **بناء الإنتاج**
   ```bash
   npm run build
   ```
   المخرجات في `web/dist` (أو حسب `vite.config.js`).

2. **تعيين base للـ CDN (إن لزم)**
   في `vite.config.js`:
   ```js
   export default defineConfig({
     base: process.env.CDN_BASE || '/',  // مثلاً https://cdn.yourdomain.com/feasibility/
     // ...
   });
   ```

3. **رفع مجلد `dist` إلى CDN**
   - **Cloudflare Pages**: ربط مستودع Git أو رفع يدوي لمجلد `dist`.
   - **Netlify**: `publish: web/dist` و (اختياري) `build: npm run build`.
   - **Vercel**: جذر المشروع مع `buildCommand: npm run build` و `outputDirectory: web/dist`.
   - **AWS CloudFront**: S3 كأصل، ثم توزيع CloudFront على الـ bucket.

### هيكل موصى به
- **الواجهة (SPA)**: تُقدّم بالكامل من CDN (أو من Edge).
- **API (إن وُجد)**: يبقى على خادمك أو على خدمة مُدارة (Supabase Edge Functions، إلخ).
- **CORS**: تأكد من السماح بنطاق الـ CDN في استجابة الـ API.

### رؤوس تخزين مؤقت (Cache)
- للملفات المُصدَّرة بـ hash في الاسم (مثل `index-abc123.js`): `Cache-Control: public, max-age=31536000, immutable`.
- لـ `index.html`: `Cache-Control: no-cache` أو مدة قصيرة لضمان حصول المستخدم على أحدث إصدار.

---

## 3. ملخص سريع

| البند | الوصف |
|--------|--------|
| **Visual regression** | `npm run test:e2e:visual` — لقطات شاشة للمقارنة البصرية |
| **متصفحات متعددة** | `npm run test:e2e:all-browsers` — Chromium, Firefox, WebKit |
| **Load balancing** | Nginx أو موزع حمل سحابي أمام التطبيق/API |
| **CDN** | بناء `npm run build` ثم رفع `web/dist` إلى Cloudflare/Netlify/Vercel أو S3+CloudFront |
| **Pitch Script بالـ AI** | استدعاء `/api/generate` مع `type: 'pitch_script'` أو تشغيل `scripts/generate_pitch_script.py` |

---

## 4. مراجع
- [Vite — Base URL](https://vitejs.dev/config/shared-options.html#base)
- [Playwright — Visual comparisons](https://playwright.dev/docs/test-snapshots)
- [Nginx — Load Balancing](https://nginx.org/en/docs/http/load_balancing.html)
