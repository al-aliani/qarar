# هيكل المنصة — محاكي الجدوى

## نظرة عامة

منصة دراسة جدوى SPA (Single Page Application) تعتمد على:
- **Frontend**: JavaScript (ES Modules)، Vite
- **Backend** (اختياري): FastAPI لـ AI والـ API
- **التخزين**: LocalStorage، Supabase (عند تسجيل الدخول)

---

## هيكل المجلدات (web/)

```
web/
├── app.js                 # نقطة الدخول، التنقل، ربط المكونات
├── index.html
├── js/
│   ├── core/              # المحرك والبيانات
│   │   ├── engine.js      # المحرك المالي (NPV, IRR, Payback, ...)
│   │   ├── schema.js      # بنية الدراسة
│   │   ├── store.js       # إدارة الحالة
│   │   ├── bridge.js      # ربط البيانات مع Excel/القوالب
│   │   └── wizardSteps.js # خطوات الويزارد
│   ├── services/          # الخدمات
│   │   ├── DataService.js
│   │   ├── PersistenceService.js
│   │   ├── AIConnector.js
│   │   ├── InternalAIGenerator.js
│   │   └── ReportGenerator.js
│   ├── ui/                # مكونات الواجهة
│   │   ├── Wizard.js
│   │   ├── Sidebar.js
│   │   ├── DecisionDashboard.js
│   │   └── ...
│   └── utils/
│       ├── formatters.js
│       ├── validation.js
│       ├── autoSave.js
│       └── csvImporter.js
├── export/                # مولدات التصدير
│   ├── BankReportGenerator.js
│   ├── PitchDeckExporter.js
│   ├── excelExporter.js
│   └── ...
├── css/
└── public/
    ├── manifest.json      # PWA
    └── sw.js              # Service Worker
```

---

## تدفق البيانات

1. **Store** — مصدر واحد للحقيقة؛ يحتفظ بحالة الدراسة.
2. **Wizard** — يعرض الخطوات ويعتمد على `store.get()` و`store.update()`.
3. **Engine** — `calculateStudy(state)` يُنفَّذ عند الحاجة ويُرجع النتائج المالية.
4. **AutoSave** — يمرّر التغييرات إلى ProjectManager → PersistenceService.
5. **Export** — يقرأ من Store و Engine، ينتج HTML/PDF/Excel/CSV.

---

## المكونات الرئيسية

| المكون         | الدور                                   |
|----------------|-----------------------------------------|
| Store          | الحالة، التحميل، الحفظ، الإشعار        |
| Wizard         | الخطوات، النماذج، التحقق                |
| Engine         | حسابات مالية (NPV, IRR, Payback, …)     |
| LivePanel      | عرض المؤشرات الحية أثناء التعديل        |
| DecisionDashboard | لوحة القرار النهائية                 |
| ExportMenu     | واجهة التصدير (PDF, Excel, Bank, Pitch) |
| AIChatModal    | المستشار الذكي التفاعلي                 |
