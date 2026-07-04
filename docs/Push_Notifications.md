# Push Notifications — إشعارات الدفع

دعم أساسي لإشعارات الدفع (Web Push) في محاكي الجدوى.

## الحالة الحالية

- **Service Worker:** التطبيق يسجّل `web/public/sw.js` (إن وُجد) عند التحميل (`index.html`).
- **الطلب والصلاحيات:** يمكن إضافة صفحة إعدادات تطلب صلاحية الإشعارات وتخزين الاشتراك (subscription) لإرسال الإشعارات لاحقاً من الخادم.

## تفعيل الإشعارات (للمطورين)

1. **تفعيل Push في Service Worker**
   - في `web/public/sw.js` أضف مستمعاً لـ `push`:
   ```js
   self.addEventListener('push', (e) => {
     const data = e.data?.json() || {};
     const title = data.title || 'محاكي الجدوى';
     const opts = { body: data.body || '', icon: '/icon-192.png' };
     e.waitUntil(self.registration.showNotification(title, opts));
   });
   ```

2. **طلب الصلاحية وحفظ الاشتراك**
   - في واجهة الإعدادات أو بعد تسجيل الدخول، استدعِ:
   ```js
   const reg = await navigator.serviceWorker.ready;
   const sub = await reg.pushManager.subscribe({
     userVisibleOnly: true,
     applicationServerKey: 'VAPID_PUBLIC_KEY_BASE64'
   });
   // أرسل sub.toJSON() إلى الخادم لحفظه وإرسال الإشعارات لاحقاً
   ```

3. **خادم الإشعارات**
   - استخدم مكتبة مثل `web-push` (Node) مع مفتاح VAPID الخاص لإرسال إشعارات إلى الـ endpoint المُرجَع من `sub.endpoint`.

## الخيارات المستقبلية

- إشعار عند اكتمال تصدير تقرير طويل.
- تذكير بحفظ الدراسة بعد مدة عدم نشاط.
- إشعارات من الخادم (مثلاً تحديثات على دراسة مشتركة).

---

**مرجع:** [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
