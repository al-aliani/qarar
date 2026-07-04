# إعداد Supabase لمنصة دراسة الجدوى

هذا المستند يوضح خطوات تهيئة مشروع Supabase لتفعيل **المصادقة** و**الحفظ السحابي** في المنصة. بدون إعداد Supabase تعمل المنصة بشكل **محلي فقط** (المسودة تُحفظ على جهازك).

---

## 1. إنشاء مشروع Supabase

1. ادخل إلى [supabase.com](https://supabase.com) وسجّل الدخول.
2. أنشئ مشروعاً جديداً (New Project).
3. اختر المنطقة (Region) وحفظ كلمة مرور قاعدة البيانات.
4. من **Project Settings → API** انسخ:
   - **Project URL** → سيكون قيمة `SUPABASE_URL`
   - **anon public** key → سيكون قيمة `SUPABASE_ANON_KEY`

---

## 2. إنشاء الجداول وتفعيل RLS

**مهم:** محرر SQL في Supabase يقبل **نص SQL فقط**. لا تنسخ أسطر Markdown مثل \`\`\`sql أو \`\`\` — وإلا سيرفض PostgreSQL التنفيذ.

### الطريقة الموصى بها

1. افتح الملف **[docs/supabase_schema.sql](supabase_schema.sql)** في المشروع.
2. انسخ **كل محتوى الملف** (من أول سطر SQL إلى آخر سطر).
3. في لوحة Supabase: **SQL Editor** → New query → الصق النص → Run.

الملف `supabase_schema.sql` يحتوي على:
- إنشاء جدولَي `studies` و `study_inputs`
- الفهارس
- تفعيل Row Level Security (RLS)
- سياسات الصلاحيات (SELECT, INSERT, UPDATE, DELETE) حسب `owner_id`

### إذا نسخت من هذا المستند (إعداد_Supabase.md)

- انسخ **فقط** أسطر الـ SQL (التي تبدأ بـ `CREATE` أو `ALTER` أو `--`).
- **لا تنسخ** السطر \`\`\`sql ولا السطر \`\`\` الأخير — PostgreSQL يعتبرهما نصاً ويسببان خطأ.

---

## 3. تهيئة المنصة بمتغيرات Supabase

المنصة تقرأ القيم من أحد المصدرين:

### أ) من المتصفح (للتطوير أو اختبار يدوي)

في Console المتصفح (F12) نفّذ قبل استخدام زر الدخول:

```javascript
localStorage.setItem('SUPABASE_URL', 'https://YOUR_PROJECT_REF.supabase.co');
localStorage.setItem('SUPABASE_ANON_KEY', 'YOUR_ANON_KEY_HERE');
```

ثم حدّث الصفحة.

### ب) عند النشر (بيئة الإنتاج)

عرض القيم من خلال المتغيرات البيئية أو من ملف إعداد البناء، وتمريرها إلى الواجهة عبر `window`، مثلاً:

```html
<script>
  window.SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
  window.SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
</script>
```

**تحذير:** لا تضع المفتاح السري (service_role key) في الواجهة أو في الكود الأمامي؛ استخدم دائماً **anon public** key.

---

## 4. التحقق من العمل

1. افتح المنصة واختر "دخول / تسجيل".
2. أنشئ حساباً بالبريد وكلمة المرور.
3. أنشئ أو عدّل دراسة ثم انتظر الحفظ التلقائي (أو غيّر شيئاً ثم احفظ).
4. في الشريط الجانبي يجب أن يظهر **"● محفوظ في السحابة"** عند نجاح المزامنة.
5. أغلق المتصفح وافتح المنصة مرة أخرى، وافتح المشروع من القائمة؛ يجب أن تُحمَّل الدراسة من السحابة.

---

## 4.1 إذا لم يصل بريد التأكيد ("البريد غير مفعّل")

Supabase يرسل بريد تأكيد عند التسجيل. أحياناً الرسالة لا تصل (مزعج، حدود إرسال، أو البريد من نطاق Supabase يُعتبر spam).

### الحل السريع (للتطوير أو الاستخدام الشخصي): تعطيل تأكيد البريد

1. في لوحة Supabase: **Authentication** → **Providers**.
2. اضغط على **Email**.
3. أوقف الخيار **"Confirm email"** (أزل التفعيل).
4. احفظ (Save).

بعدها يمكن تسجيل حسابات جديدة والدخول **بدون** انتظار بريد التأكيد. (للمنتج العام يُفضّل إبقاء التأكيد مفعّلاً وإعداد SMTP مخصّص — انظر أدناه.)

### إذا أردت إبقاء التأكيد مفعّلاً

- استخدم زر **"إعادة إرسال رابط التأكيد"** في المنصة (يظهر عند ظهور رسالة "البريد غير مفعّل").
- تحقق من **صندوق المزعج (Spam)** وفلتر "العروض الترويجية" إن وُجد.
- للإنتاج: في Supabase **Project Settings → Auth → SMTP** أعدّ بريد مخصّص (مثل Resend أو SendGrid) لتحسين وصول الرسائل.

---

## 5. تفعيل الدخول برقم الجوال (اختياري)

1. في لوحة Supabase: **Authentication → Providers**.
2. فعّل **Phone**.
3. اختر مزود SMS (مثل Twilio أو MessageBird) وأضف المفاتيح حسب [توثيق Supabase](https://supabase.com/docs/guides/auth/phone-login).
4. في المنصة يظهر تبويب **بالجوال** في نموذج الدخول: أدخل الرقم (مثل 05xxxxxxxx) ثم اضغط "إرسال رمز الدخول"، أدخل الرمز من الرسالة ثم "تأكيد الدخول".

**ملاحظة:** بدون إعداد مزود SMS في Supabase، زر "إرسال رمز الدخول" سيرجع خطأ من السيرفر.

---

## 6. تفعيل تسجيل الدخول بـ Google (OAuth)

### 6.1 إنشاء OAuth Client في Google Cloud Console

1. ادخل إلى [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. اختر مشروعاً موجوداً أو أنشئ مشروعاً جديداً (**Create Project** → اسم المشروع → Create).
3. من القائمة الجانبية: **APIs & Services** → **Credentials**.
4. اضغط **+ Create Credentials** → **OAuth client ID**.
5. إذا طُلِب منك إعداد **OAuth consent screen**:
   - اختر **External** (أو Internal إن كان حساب مؤسسة) → Create.
   - **App name:** مثلاً «منصة دراسة الجدوى».
   - **User support email:** بريدك.
   - **Developer contact:** بريدك → Save and Continue → (Scopes يمكن تخطيها) → Save and Continue → (Test users اختياري) → Back to Dashboard.
6. مرة أخرى: **Create Credentials** → **OAuth client ID**.
7. **Application type:** اختر **Web application**.
8. **Name:** مثلاً `Feasibility Web`.
9. تحت **Authorized redirect URIs** اضغط **+ ADD URI** وأضف:
   - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   - استبدل `YOUR_PROJECT_REF` بمعرّف مشروع Supabase (موجود في عنوان المشروع، مثلاً `ljvskvzvgrpawyexetzv` في `https://ljvskvzvgrpawyexetzv.supabase.co`).
10. اضغط **Create** → انسخ **Client ID** و **Client Secret** (ستضعهما في Supabase).

### 6.2 تفعيل Google في Supabase

1. في لوحة Supabase: **Authentication** → **Providers**.
2. ابحث عن **Google** واضغط لتفعيله.
3. الصق **Client ID** و **Client Secret** من الخطوة السابقة.
4. احفظ (Save).

### 6.3 إعداد عنوان العودة (Site URL)

1. في Supabase: **Authentication** → **URL Configuration**.
2. **Site URL:** ضع عنوان تطبيقك بعد تسجيل الدخول من Google:
   - للتطوير المحلي: `http://localhost:5173` (أو المنفذ الذي تشغّل عليه).
   - للإنتاج: `https://yourdomain.com`.
3. (اختياري) **Redirect URLs:** يمكن إضافة نفس القيم المسموح بها للعودة، مثلاً `http://localhost:5173/**` و `https://yourdomain.com/**`.

### 6.4 التحقق

1. في المنصة اضغط «تسجيل الدخول» ثم **«تسجيل بحساب Google»**.
2. يجب أن يُوجّهك المتصفح إلى صفحة اختيار حساب Google، ثم بعد الموافقة يعود إلى تطبيقك ويسجّل الدخول تلقائياً.
3. إذا ظهر خطأ «redirect_uri_mismatch» فتأكد أن الـ URI في Google Cloud مطابق تماماً لـ `https://PROJECT_REF.supabase.co/auth/v1/callback` (بدون شرطة في النهاية).

**مراجع الكود:** `web/supabaseClient.js` (`signInWithOAuth`)، `web/js/ui/AuthComponent.js` (زر «تسجيل بحساب Google»)، `web/js/ui/AuthModalStub.js` (نافذة الدخول).

---

## 6.5 تفعيل تسجيل الدخول بـ Apple (OAuth)

### المتطلبات
- حساب **Apple Developer** (مدفوع، 99$/سنة)
- مرجع: [Supabase — Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)

### الخطوات

1. ادخل إلى [Apple Developer](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles**.
2. **Identifiers** → أنشئ **App ID** جديد مع تفعيل "Sign In with Apple".
3. أنشئ **Services ID** (يعمل كـ `client_id` للتطبيقات الويب).
4. تحت Services ID: أضف **Return URL** = `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
5. أنشئ **مفتاح سري** (.p8) من **Keys** → "Sign In with Apple" → احفظ الملف وآخرته (Key ID).
6. في Supabase: **Authentication** → **Providers** → **Apple** → فعّل وأدخل:
   - **Services ID** (Client ID)
   - **Team ID** و **Key ID** و **Private Key** (محتوى ملف .p8)
   - **Bundle ID** إن لزم

**تنبيه:** Apple يتطلب إنشاء مفتاح سري جديد كل 6 أشهر. احفظ تذكيراً في التقويم واحتفظ بملف .p8 بأمان.

**الكود جاهز:** `AuthComponent.js` (زر «تسجيل بحساب Apple») يستدعي `signInWithOAuth('apple')`.

---

## 6.6 تفعيل تسجيل الدخول بـ Microsoft (Azure OAuth)

### الخطوات

1. ادخل إلى [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** (سابقاً Azure AD).
2. **App registrations** → **New registration**.
3. أدخل **Name** واختر **Accounts in any organizational directory and personal Microsoft accounts**.
4. تحت **Web** → **Redirect URI** أضف:
   - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
5. اضغط **Register**.
6. من الصفحة: انسخ **Application (client) ID**.
7. **Certificates & secrets** → **New client secret** → احفظ **Value** (وليس Secret ID) وتاريخ الانتهاء.
8. في Supabase: **Authentication** → **Providers** → **Azure** → فعّل وأدخل:
   - **Client ID** (Application ID)
   - **Client Secret** (قيمة الـ secret من الخطوة 7)

**ملاحظة للتطوير المحلي:** Azure لا يقبل `127.0.0.1` كـ redirect URI؛ استخدم `http://localhost:5173` في Supabase **Redirect URLs**.

**الكود جاهز:** `AuthComponent.js` (زر «تسجيل بحساب Microsoft») يستدعي `signInWithOAuth('azure')`.

مرجع: [Supabase — Login with Azure](https://supabase.com/docs/guides/auth/social-login/auth-azure)

---

## 7. المصادقة الثنائية (2FA / TOTP)

المصادقة الثنائية (TOTP) مُفعّلة افتراضياً في Supabase ولا تحتاج إعداداً إضافياً في اللوحة.

1. **تفعيل 2FA:** بعد تسجيل الدخول، اضغط على أيقونة 🔐 بجانب بريدك في الشريط الجانبي → "بدء التفعيل" → امسح رمز QR بتطبيق مصادقة (مثل Google Authenticator أو Authy) → أدخل الرمز المكوّن من 6 أرقام → "تأكيد وتفعيل".
2. **عند الدخول:** إذا كان الحساب مفعّلاً فيه 2FA، بعد إدخال البريد وكلمة المرور سيُطلب منك إدخال رمز التطبيق.
3. **إلغاء 2FA:** من نفس نافذة "المصادقة الثنائية" يمكنك إلغاء العامل (إلغاء التفعيل).

مراجع الكود: `web/supabaseClient.js` (mfaEnrollTOTP, mfaChallengeAndVerify, mfaListFactors, mfaUnenroll)، `web/js/ui/TwoFactorModal.js`.

---

## 8. مراجع الكود (قائمة الملفات)

| الغرض           | الملف |
|-----------------|--------|
| عميل Supabase   | `web/supabaseClient.js` |
| الحفظ السحابي   | `web/js/services/PersistenceService.js` |
| واجهة الدخول (الشريط الجانبي) | `web/js/ui/AuthComponent.js` |
| نافذة الدخول / التسجيل | `web/js/ui/AuthModalStub.js` (AuthModal) |
| إعدادات 2FA     | `web/js/ui/TwoFactorModal.js` |

---

**آخر تحديث:** يناير 2026
