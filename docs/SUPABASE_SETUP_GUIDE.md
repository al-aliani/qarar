# 🔐 دليل إعداد Supabase للمصادقة والحفظ السحابي

هذا الدليل يشرح كيفية إعداد Supabase لتفعيل المصادقة والحفظ السحابي في منصة دراسة الجدوى.

---

## 📋 المتطلبات

- حساب على [Supabase](https://supabase.com) (مجاني)
- 10 دقائق من وقتك

---

## 🚀 الخطوات

### الخطوة 1: إنشاء مشروع Supabase

1. اذهب إلى [app.supabase.com](https://app.supabase.com)
2. اضغط على **"New Project"**
3. أدخل:
   - **Name**: `feasibility-simulator` (أو أي اسم تريده)
   - **Database Password**: كلمة مرور قوية (احفظها!)
   - **Region**: اختر الأقرب إليك (مثلاً `Middle East (Bahrain)`)
4. اضغط **"Create new project"**
5. انتظر 2-3 دقائق حتى يكتمل الإنشاء

---

### الخطوة 2: الحصول على بيانات الاتصال

1. من لوحة تحكم المشروع، اذهب إلى **Settings** (الترس ⚙️)
2. اضغط على **API**
3. ستجد:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`

📝 **احفظ هذه البيانات** - ستحتاجها لاحقاً

---

### الخطوة 3: إنشاء الجداول

1. اذهب إلى **SQL Editor** من القائمة الجانبية
2. اضغط **"New query"**
3. انسخ محتوى ملف `docs/supabase_setup.sql` والصقه
4. اضغط **"Run"** (أو Ctrl+Enter)
5. يجب أن ترى: `Success. No rows returned`

---

### الخطوة 4: إعداد المصادقة

#### 4.1 تفعيل Email Authentication

1. اذهب إلى **Authentication** من القائمة
2. اضغط على **Providers**
3. تأكد أن **Email** مفعّل
4. الإعدادات الموصى بها:
   - ✅ Enable Email Signup
   - ✅ Confirm email (اختياري للتجربة، مُوصى به للإنتاج)
   - ❌ Double confirm email changes

#### 4.2 تخصيص قوالب البريد (اختياري)

1. اذهب إلى **Authentication** > **Email Templates**
2. يمكنك تخصيص:
   - **Confirm signup**: رسالة تأكيد التسجيل
   - **Reset password**: رسالة استعادة كلمة المرور
   - **Magic link**: رسالة رابط الدخول السريع

مثال لقالب عربي:
```html
<h2>مرحباً!</h2>
<p>اضغط على الرابط أدناه لتأكيد حسابك:</p>
<p><a href="{{ .ConfirmationURL }}">تأكيد الحساب</a></p>
```

#### 4.3 إعداد عناوين URL

1. اذهب إلى **Authentication** > **URL Configuration**
2. أدخل:
   - **Site URL**: `http://localhost:5173` (للتطوير)
   - **Redirect URLs**: أضف:
     - `http://localhost:5173/*`
     - `https://yourdomain.com/*` (للإنتاج)

---

### الخطوة 5: ربط التطبيق

#### الطريقة 1: من واجهة التطبيق

1. افتح التطبيق: `http://localhost:5173`
2. اضغط على أيقونة المستخدم أو "إعداد السحابة"
3. أدخل:
   - **Project URL**: الرابط من الخطوة 2
   - **Anon Key**: المفتاح من الخطوة 2
4. اضغط "حفظ وتفعيل"

#### الطريقة 2: من الكود (للمطورين)

أضف في `index.html` قبل `</head>`:

```html
<script>
  window.SUPABASE_URL = 'https://xxxxx.supabase.co';
  window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...';
</script>
```

أو أنشئ ملف `.env`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

---

## ✅ التحقق من الإعداد

1. افتح التطبيق
2. اضغط "إنشاء حساب جديد"
3. أدخل بريد وكلمة مرور
4. إذا نجح التسجيل، الإعداد صحيح!

---

## 🔧 استكشاف الأخطاء

### "Supabase غير مهيأ"
- تأكد من إدخال URL و Anon Key بشكل صحيح
- تأكد أن الرابط ينتهي بـ `.supabase.co`

### "فشل تسجيل الدخول"
- تأكد من تفعيل البريد الإلكتروني إذا كان مطلوباً
- تأكد من صحة كلمة المرور

### "خطأ في إنشاء الجداول"
- تأكد من تشغيل SQL بالكامل
- تحقق من عدم وجود جداول سابقة بنفس الاسم

### "Could not find the 'data' column of 'studies'" (400 Bad Request)
- جدول `studies` موجود لكن بدون عمود `data` (محتوى الدراسة).
- **الحل:** في Supabase اذهب إلى **SQL Editor** → **New query** → انسخ محتوى ملف `docs/supabase_add_data_column.sql` → **Run**.
- أو نفّذ يدوياً: `ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';`

### "Rate limit exceeded"
- انتظر دقيقة وحاول مجدداً
- Supabase المجاني يحد من عدد الطلبات

---

## 📊 الجداول المُنشأة

| الجدول | الوصف |
|--------|-------|
| `profiles` | معلومات المستخدمين |
| `studies` | المشاريع/الدراسات |
| `study_shares` | مشاركة المشاريع |
| `study_versions` | تاريخ إصدارات المشاريع |

---

## 🔒 الأمان

- ✅ Row Level Security (RLS) مُفعّل
- ✅ كل مستخدم يرى مشاريعه فقط
- ✅ كلمات المرور مُشفرة
- ✅ JWT tokens للجلسات

---

## 💰 حدود الخطة المجانية

| الميزة | الحد |
|--------|------|
| قاعدة البيانات | 500 MB |
| المستخدمين | 50,000 MAU |
| طلبات API | 500K/شهر |
| التخزين | 1 GB |

للمزيد: [Supabase Pricing](https://supabase.com/pricing)

---

## 🆘 المساعدة

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues)

---

**تم إعداد هذا الدليل لمنصة دراسة الجدوى v1.0**
