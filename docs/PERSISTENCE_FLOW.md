# Persistence Flow (Supabase Source of Truth + Local Draft Cache)

## الهدف
نجعل **قاعدة البيانات (Supabase)** هي مصدر الحقيقة للدراسة (Study Inputs)، مع إبقاء `localStorage` كـ **Draft Cache** للاسترجاع عند:
- انقطاع الشبكة
- عدم تهيئة Supabase
- عدم وجود جلسة تسجيل دخول

## الجداول
### 1) `studies`
يحفظ سجل الدراسة (metadata):
- `id`
- `owner_id`
- `template_slug`, `template_version`
- `status`
- `created_at`, `updated_at`

SQL: `templates/STUDIES_TABLE_AND_POLICIES.sql`

### 2) `study_inputs`
يحفظ **JSON المدخلات** لكل Study:
- `study_id` (unique)
- `inputs` (jsonb) ← **Source of Truth**
- `created_at`, `updated_at`

SQL: `templates/STUDY_INPUTS_TABLE_AND_POLICIES.sql`

## تدفق الإنشاء (Create Study)
1) المستخدم يبدأ Study من الـ Wizard.
2) إذا Supabase مهيأ + المستخدم مسجّل دخول:
   - Insert في `studies` → يرجع `study_id`
   - Upsert في `study_inputs` (inputs الأولية)
3) إذا غير متاح:
   - إنشاء `local_<uuid>` وتخزينه في Draft Cache فقط.

## تدفق الحفظ (Autosave)
- **Draft Cache**: يتم حفظه دائمًا في `localStorage` (للاسترجاع).
- **DB Save**:
  - Debounce: \(800ms\) بعد آخر تغيير
  - Flush interval: كل \(10s\) إذا كانت هناك تغييرات غير مرفوعة
  - Retry بسيط: 3 محاولات مع backoff

## حالة المزامنة (UI)
يظهر في التبويب:
- `Saving...`
- `Saved`
- `Offline (Draft Cache)` عند انقطاع الشبكة/عدم التهيئة/عدم تسجيل الدخول

## تدفق الفتح (Open Study)
1) محاولة تحميل `study_inputs` من Supabase أولًا (حسب `study_id`).
2) إن لم توجد/فشل الاتصال: fallback إلى `localStorage` Draft Cache.

