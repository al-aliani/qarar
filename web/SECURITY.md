# 🔐 دليل الأمان والموثوقية

> **تصحيح مهم (2026-07-08):** أُزيل تشفير الحقول عند الحفظ سابقاً لأنه كان يُفسد البيانات
> (مفتاح في `sessionStorage` يُمسح عند إغلاق التبويب). **لا يوجد حالياً تشفير للبيانات وهي ساكنة
> (at-rest encryption).** البيانات تُخزَّن مضغوطة (LZ-string) نصاً صريحاً في `localStorage`،
> وتُرفع نصاً صريحاً إلى عمود `data` في Supabase. هذا المستند صُحّح ليعكس الواقع بدل ادعاء غير قائم.

## ✅ طبقات الحماية الفعلية القائمة

### 1. عزل البيانات على مستوى الصف (Row Level Security)
- سياسات RLS في `supabase/policies.sql` تربط كل عملية (select/insert/update/delete) بـ `auth.uid() = user_id`.
- ⚠️ **يجب تفعيلها يدوياً** على مشروع Supabase الإنتاجي — لا يوجد فرض برمجي في المستودع بعد.
  انظر «الخطوات التالية» أدناه.

### 2. طبقة الاشتراك من `app_metadata`
- تُقرأ درجة الاشتراك من `app_metadata` (يكتبها الخادم بمفتاح `service_role`) لا من `user_metadata`،
  ما يمنع الترقية الذاتية عبر `supabase.auth.updateUser`.
- ⚠️ فحوص `hasPermission`/`getSubscriptionTier` في العميل **تجميلية فقط** وقابلة للتجاوز من الـ console —
  أي فرض فعلي للدفع يجب أن يكون على الخادم.

### 3. Content Security Policy (CSP)
- CSP بلا `script-src 'unsafe-inline'` في `vercel.json` و`index.html`.
- X-Frame-Options، X-Content-Type-Options، Referrer-Policy مضبوطة.
- ⚠️ ناقص: `Strict-Transport-Security` (HSTS) و`Permissions-Policy`، و`img-src` مفتوح على `https:`.

### 4. تهريب HTML موحّد ضد XSS
- `web/js/utils/escape.js` (`escapeHtml`) يُطبَّق قبل حقن أي نص مستخدم في `innerHTML`/قيم السمات
  (RiskMatrix، PostLaunchTracker، StrategicAnalysis، AIChatModal، BusinessModelView، التقارير).

### 5. IndexedDB Fallback
- تحويل تلقائي للبيانات الكبيرة (> 5MB) إلى IndexedDB مع تحذير عند الاقتراب من حد localStorage.

---

## 📊 حالة الأمان (واقعية)

| الميزة | الحالة | الملاحظات |
|--------|--------|-----------|
| **تشفير البيانات (at-rest)** | ❌ غير مطبق | localStorage نص صريح مضغوط؛ Supabase نص صريح. الحماية عبر RLS فقط |
| **RLS** | ⚠️ يحتاج تفعيلاً يدوياً | لا فرض برمجي/CI بعد |
| **فرض طبقة الدفع** | ❌ عميلي فقط | يمكن تجاوزه؛ يحتاج Edge Function على الخادم |
| **CSP Headers** | ✅ مطبق | ينقصه HSTS و Permissions-Policy |
| **تهريب XSS** | ✅ مطبق | `escape.js` موحّد |
| **IndexedDB** | ✅ مطبق | Fallback تلقائي |

---

## 🚀 الخطوات التالية (قبل الإطلاق)

1. ⚠️ **تفعيل RLS** على مشروع Supabase الإنتاجي، ونقل `policies.sql` إلى migration مُدار يُشغَّل عبر CI + اختبار تحقق يفشل البناء إن كان RLS متوقفاً.
2. ⚠️ **فرض طبقة الدفع على الخادم** (Edge Function للكتابة تتحقق من `app_metadata.subscription_tier`).
3. ⚠️ إضافة HSTS و Permissions-Policy وتضييق `img-src` في `vercel.json`.
4. ⚠️ حسم التشفير at-rest: إمّا إعادته بمفتاح ثابت آمن (لا `sessionStorage`)، أو الإقرار الصريح بأن الحقول نص صريح وتقليل ما يُخزَّن حساساً.
5. ⚠️ إفصاح في `privacy.html` عمّا يُرسَل للأطراف الثالثة (Google Sheets/Webhook) وتأكيد صريح قبل أول إرسال.

---

**آخر تحديث:** 2026-07-08
