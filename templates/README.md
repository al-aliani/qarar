# كيف تستخدم القالب (Quick Start)

## 1) توليد ملف Excel قالب
شغّل:

```bash
python tools/create_feasibility_template.py
```

سينشئ: `templates/Feasibility_Template.xlsx`

## 2) املأ الدراسة
اتبع المواصفات في:
- `FEASIBILITY_TEMPLATE_SPEC.md`

## 3) تدقيق صارم قبل الاعتماد
شغّل:

```bash
python tools/feasibility_validate.py templates/Feasibility_Template.xlsx
```

- إذا `verdict = PASS` → النموذج صالح مبدئيًا.
- إذا `verdict = FAIL` → أصلح البنود الحرِجة أولاً (لا قرار قبل الإصلاح).

## 4) معيار الجودة
المعيار الرسمي موجود في:
- `FEASIBILITY_QA_STANDARDS.md`

