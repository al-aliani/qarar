# دليل تسليم التصميم لفيغما — منصة «قرار»

> **الغرض:** هذا المستند مرجع مباشر (Design Handoff) لمصمم واجهات يريد إعادة بناء نظام التصميم (Design System) وكل شاشات منصة «قرار» في Figma، مستخرَج آلياً وبقراءة مباشرة من كود CSS/HTML/JS المصدري الفعلي — وليس من ذاكرة أو تخمين. كل قيمة (Hex، px، اسم صنف CSS) منسوخة حرفياً من الملفات المذكورة أمامها.
>
> **لماذا Markdown لا ملف .fig مباشر؟** لا توجد أداة توليد ملفات Figma (.fig) ثنائية من كود مصدري بشكل مباشر ضمن الأدوات المتاحة هنا؛ الأداة المتصلة بفيغما في هذه البيئة هي MCP قراءة (Dev Mode) تُستخدم *من داخل* فيغما لسحب سياق تصميم موجود مسبقاً — ولا تملك عملية "إنشاء ملف/إطار جديد". لذلك المسار العملي الصحيح هو: توثيق شامل بدقة نسخ-لصق هنا ← يبنيه مصمم بشرياً (أو عبر إضافة استيراد توكنات) داخل فيغما.
>
> **منهجية الاستخراج:** قراءة مباشرة (لا تخمين) لكل ملفات `web/css/*.css` (20 ملفاً)، نقاط الدخول الخمس (`index.html`، `landing.html`، `investor.html`، `privacy.html`، `terms.html`)، تعريف خطوات المعالج الكامل (`web/js/core/wizardSteps.js`)، منطق التوجيه (`web/app.js`)، ومحتوى ~45 ملف مكوّن واجهة تحت `web/js/ui/`.
>
> **بنية المشروع البصرية بإيجاز:** منصة SaaS عربية (RTL بالكامل) لإعداد دراسات جدوى استثمارية للسوق السعودي. خمس نقاط دخول HTML منفصلة:
> | الملف | الدور |
> |---|---|
> | `web/landing.html` | صفحة تسويق/بيع مستقلة (نظام ألوان خاص بها — انظر القسم 3) |
> | `web/index.html` | تطبيق SPA الرئيسي (موجّه Hash)؛ يحوي هيكل التطبيق + معالج 42 خطوة + لوحات التحكم |
> | `web/investor.html` | صفحة عرض للمستثمر للقراءة فقط (standalone) |
> | `web/privacy.html` / `web/terms.html` | صفحتان نصيتان ثابتتان (سياسة الخصوصية / الشروط والأحكام) |
>
> ⚠️ **أهم ملاحظة اتساق يجب أن يعرفها المصمم قبل البدء:** يوجد **نظاما ألوان منفصلان تماماً وغير متزامنَين** — نظام التطبيق الرئيسي (`web/css/variables.css`، بادئة `--c-*`) ونظام صفحة الهبوط (`<style>` داخلي في `landing.html`، بادئة `--green-*`/`--gold`/`--ink`...). فرق مثال: أخضر التطبيق `#0e5b44` مقابل أخضر الهبوط `#0b6b4f` — قريبان لكن **غير متطابقَين حرفياً**. وثّقتُ كلا النظامين بالكامل ومنفصلَين أدناه (القسمان 2 و3) — لا تخلطهما عند بناء مكتبة الألوان في فيغما؛ الأفضل صناعة نمط ألوان (Color Style) لكل نظام على حدة، أو توحيدهما كقرار تصميم واعٍ قبل البدء.

---

## الفهرس

1. [نظام تصميم التطبيق الرئيسي (Design Tokens)](#1-نظام-تصميم-التطبيق-الرئيسي-design-tokens)
2. [نظام ألوان صفحة الهبوط المنفصل](#2-نظام-ألوان-صفحة-الهبوط-المنفصل-landinghtml)
3. [مكتبة الأيقونات (Icon Library)](#3-مكتبة-الأيقونات-icon-library)
4. [مكتبة المكونات (Component Library)](#4-مكتبة-المكونات-component-library)
5. [هيكلة الشاشات (Screen Blueprints)](#5-هيكلة-الشاشات-screen-blueprints)
6. [جدول معالج الخطوات الكامل (42 خطوة)](#6-جدول-معالج-الخطوات-الكامل-42-خطوة)
7. [ملاحظات هامة للمصمم — تناقضات وفجوات وكود ميت](#7-ملاحظات-هامة-للمصمم)
8. [فهرس الملفات المصدر](#8-فهرس-الملفات-المصدر)

---

## 1. نظام تصميم التطبيق الرئيسي (Design Tokens)

المصدر: `web/css/variables.css` + `web/css/main.css` + `web/css/layout.css` + `web/css/utilities.css` + `web/css/animations.css`

### 1.1 الألوان (Colors) — فاتح ← داكن

يُفعَّل الوضع الداكن عبر `[data-theme="dark"]` على `:root`. **الأعمدة أدناه تقارن القيمتين معاً.** الألوان التي لا يوجد أمامها عمود داكن منفصل **تبقى كما هي في الوضعين** (غير مُعاد تعريفها داخل selector الداكن).

#### الألوان الأساسية والخلفيات (تتغيّر بين الوضعين)

| الاسم | متغيّر CSS | فاتح (Light) | داكن (Dark) | الاستخدام |
|---|---|---|---|---|
| خلفية التطبيق | `--c-bg-app` | `#f6f5f0` | `#0b1512` | خلفية الجسم/الصفحة الرئيسية — ورقي دافئ بدل الرمادي البارد |
| خلفية اللوحة | `--c-bg-panel` | `#eeece4` | `#101d18` | خلفية الشريط الجانبي/الترويسة/اللوحة الحيّة/بطاقات القوالب |
| خلفية البطاقة | `--c-bg-card` | `#fdfcf9` | `#16261f` | خلفية البطاقات والشارات |
| **أساسي 500 (Primary)** | `--c-p-500` | `#0e5b44` | `#3ecf9a` | أخضر صنوبري — هوية «قرار»؛ الأفعال والتنقل، عنوان العلامة، الأزرار الأساسية، نقاط الحالة النشطة. **ينعكس السطوع في الداكن** (يصبح فاتحاً) |
| أساسي 600 (أغمق) | `--c-p-600` | `#0a4634` | `#2bb384` | درجة أغمق — hover/تدرجات (`grad-emerald`) |
| أساسي خفيف | `--c-p-subtle` | `rgba(14,91,68,.14)` | `rgba(62,207,154,.16)` | خلفية شارات/أيقونات مرتبطة بالأساسي |
| تباين الأساسي | `--c-p-contrast` | `#ffffff` | `#06231a` | لون النص فوق الخلفية الأساسية — **ينقلب من أبيض لأخضر داكن جداً** لأن الأساسي نفسه صار فاتحاً في الوضع الداكن |
| **نحاسي 500 (Gold)** | `--c-gold-500` | `#8a5f1c` | `#d9a84e` | لون التمييز والأرقام البارزة؛ داكن بما يكفي ليُقرأ فوق الفاتح، ويُفتَّح في الداكن |
| نحاسي خفيف | `--c-gold-subtle` | `rgba(176,125,44,.16)` | `rgba(217,168,78,.14)` | خلفية شارات/رقاقات نشطة (`stage-chip.is-active`) |
| نحاسي زخرفي | `--c-gold-deco` | `#b07d2c` | `#d9a84e` | للخلفيات والتدرجات فقط (ليست للنصوص)؛ تدرّج `grad-gold` ونبضة `pulse-gold` |
| حد نحاسي | `--c-gold-border` | `rgba(176,125,44,.35)` | `rgba(217,168,78,.35)` | حد رقيق حول العناصر النشطة |
| نص رئيسي | `--c-text-main` | `#1c2420` | `#eef5f0` | لون النص الأساسي — فحمي دافئ |
| نص خافت | `--c-text-muted` | `#5b665f` | `#93a39a` | نص ثانوي/توضيحي |
| حدود | `--c-border` | `rgba(28,36,32,.14)` | `rgba(238,245,240,.12)` | **في الداكن تصبح محايدة رمادية-خضراء بدل الذهبي** — تعليق صريح في الكود: "كان الذهبي في كل مكان = ضجيج بصري" |
| نجاح (Success) | `--c-success` | `#157f5f` | `#34d399` | حالة النجاح/الاكتمال |
| خطر (Danger) | `--c-danger` | `#c2382e` | `#f87171` | حالة الخطأ/الخطر |
| خطر خفيف | `--c-danger-subtle` | `rgba(194,56,46,.1)` | `rgba(248,113,113,.12)` | خلفية خفيفة لحالات الخطر |
| تحذير (Warning) | `--c-warning` | `#b45309` | `#fbbf24` | حالة التحذير |
| تحذير خفيف | `--c-warning-subtle` | `rgba(180,83,9,.14)` | `rgba(251,191,36,.14)` | خلفية خفيفة لحالات التحذير |
| سطح 2 | `--c-surface-2` | `rgba(28,36,32,.04)` | `rgba(238,245,240,.05)` | سطح شفاف خفيف — خلفية `stage-bar` و`kpi-mini.badge` |
| سطح 3 | `--c-surface-3` | `rgba(28,36,32,.08)` | `rgba(238,245,240,.09)` | سطح شفاف أعمق قليلاً |

#### ألوان مساعدة وثابتة (لا تتغيّر بين الوضعين)

| الاسم | متغيّر CSS | القيمة | الاستخدام |
|---|---|---|---|
| أزرق مساعد | `--c-accent-blue` | `#2563eb` | لون مساعد عام (Tailwind blue-600) |
| أخضر مساعد | `--c-accent-green` | `#10b981` | لون مساعد عام؛ يطابق أيضاً `stage-hr-1` |
| أحمر مساعد | `--c-accent-red` | `#dc2626` | لون مساعد عام (Tailwind red-600) |
| بنفسجي مساعد | `--c-accent-purple` | `#7c3aed` | لون مساعد عام؛ يطابق أيضاً `stage-marketing-2` |

#### ألوان الجدول الزمني (Gantt) — 5 فئات نشاط، درجتان لكل فئة (لا تتغيّر بين الوضعين)

| الفئة | فاتح | غامق |
|---|---|---|
| قانونية (Legal) | `--c-stage-legal-1` `#64748b` | `--c-stage-legal-2` `#475569` |
| تقنية (Technical) | `--c-stage-technical-1` `#f59e0b` | `--c-stage-technical-2` `#d97706` |
| موارد بشرية (HR) | `--c-stage-hr-1` `#10b981` | `--c-stage-hr-2` `#059669` |
| تسويق (Marketing) | `--c-stage-marketing-1` `#8b5cf6` | `--c-stage-marketing-2` `#7c3aed` |
| إطلاق (Launch) | `--c-stage-launch-1` `#ec4899` | `--c-stage-launch-2` `#db2777` |

#### تدرجات لونية (Gradients) — ثابتة في الوضعين

- `--grad-gold`: `linear-gradient(135deg, #b07d2c, #d9a84e)`
- `--grad-emerald`: `linear-gradient(135deg, #0a4634, #0e5b44)`
- `--grad-glass`: `linear-gradient(135deg, rgba(255,255,255,.05), rgba(255,255,255,.01))`
- `--glass-blur`: `blur(16px)` — تأثير ضبابي (glassmorphism)، مُعرّف مرة واحدة في `:root` فقط

#### ⚠️ ألوان خارج نظام التوكِنز (Hex صريح داخل ملفات CSS متخصصة)

بعض المكونات تستخدم قيم Hex مباشرة بدل متغيّرات `--c-*` — يستحق توحيدها في فيغما كـ Design Debt:

| القيمة | أين | ملاحظة |
|---|---|---|
| `#6366f1` → `#a855f7` | زر السحر AI (`.btn-magic`) في `ai.css` | تدرّج بنفسجي-وردي مستقل عن هوية أخضر/ذهبي |
| `#10b981` (score-excellent) | `ai.css` | لا يطابق `--c-success` الرسمي حرفياً رغم قربه |
| `#2563eb` (score-good) | `ai.css` | يطابق `--c-accent-blue` |
| `#f59e0b` (score-fair) | `ai.css` | كهرماني صريح، مختلف عن `--c-warning` |
| `#60a5fa → #a855f7` | `.text-gradient` نص متدرّج (بطاقات AI) | أزرق-بنفسجي تسويقي |
| `#fef3c7`/`#92400e`، `#fee2e2`/`#991b1b` | أعلام تحذير/خطر في `wizard-forms.css` (`.pa-flag--warn/--bad`) | قيم Tailwind خام لا توكنات |
| `#d1fae5`/`#059669`، `#fee2e2`/`#dc2626`، `#fef3c7`/`#d97706`، `#dbeafe`/`#2563eb` | أيقونات Toast (`toast.css`) | ألوان الحالة الأربع لأيقونة التنبيه |
| `#1f2937 → #000` | خلفية وضع العرض التقديمي في `ai.css` | تُعرَّف مرتين مختلفتين (أيضاً `--grad-emerald` في `decision-dashboard.css`) — ازدواجية تعريف |

### 1.2 الخطوط (Typography)

| العنصر | القيمة |
|---|---|
| **خط الواجهة الأساسي** `--font-ui` | `'IBM Plex Sans Arabic', 'Inter', system-ui, sans-serif` — مطبَّق على `body` بالكامل |
| **خط الأرقام** `--font-mono` | `'JetBrains Mono', monospace` — عبر `.text-mono`/`.num`؛ كل الحقول الرقمية تستخدم `font-variant-numeric: tabular-nums lining-nums` لمحاذاة الأرقام |
| الاتجاه | `direction: rtl` على `body` بالكامل؛ الحقول الرقمية/التاريخ تُفرَض `direction: ltr; text-align: end` داخل حاويات RTL |

**لا يوجد تعريف مركزي صريح لعناصر H1-H6** (لا "Type Scale" رسمي) — الأحجام سياقية حسب المكوّن:

| السياق | الحجم | الوزن | ملاحظة |
|---|---|---|---|
| `.brand` (شعار السايدبار) | `1.4rem` | `700` | |
| `.brand-accent` | `0.65rem` | `400` | uppercase, letter-spacing 0.2em |
| `.app-header__brand` | `1.1rem` | `700` | عنوان العلامة في الترويسة |
| `.brand-name-mobile` | `1.1rem` | `700` | |
| `.mobile-stage-indicator` | `0.78rem` | `500` | |
| `.stage-chip` / `.kpi-mini.badge` | `0.75rem` | — | |
| `.app-header__kpi` | `0.85rem` | — | |
| `.mkpi-val` (جوّال) | `14px` | `700` | |
| `.mkpi-label` (جوّال) | `10.5px` | — | |
| `.t-info h4` (بطاقة قالب) | `1.1rem` | — | |
| `.t-info p` | `0.9rem` | — | line-height 1.4 |
| `.text-sm` (utility) | `0.875rem` | — | |
| `.text-lg` (utility) | `1.125rem` | `600` | |
| `.font-bold` (utility) | — | `700` | |
| `.font-medium` (utility) | — | `500` | |
| `.dd-gauge__num` (رقم العداد المركزي، لوحة القرار) | `2.4rem` | `700` | |
| `.score-circle` (دائرة النقاط) | متغيّر حسب السياق | — | |

### 1.3 المسافات (Spacing Scale)

| المتغيّر | القيمة |
|---|---|
| `--s-1` | `0.25rem` (4px) |
| `--s-2` | `0.5rem` (8px) |
| `--s-3` | `1rem` (16px) |
| `--s-4` | `1.5rem` (24px) |
| `--s-5` | `2.25rem` (36px) |
| `--s-6` | `3rem` (48px) |

### 1.4 الظلال (Shadows) — فاتح ← داكن

| المتغيّر | فاتح | داكن |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(20,33,28,.06), 0 2px 8px -2px rgba(20,33,28,.08)` | `0 1px 2px rgba(0,0,0,.35), 0 2px 10px -2px rgba(0,0,0,.3)` |
| `--shadow-lg` | `0 4px 12px -2px rgba(20,33,28,.08), 0 16px 32px -12px rgba(20,33,28,.18)` | `0 8px 20px -6px rgba(0,0,0,.45), 0 24px 48px -16px rgba(0,0,0,.5)` |
| `--shadow-btn` | `inset 0 1px 0 rgba(255,255,255,.16), 0 16px 30px -18px rgba(14,91,68,.85)` | `inset 0 1px 0 rgba(255,255,255,.08), 0 12px 24px -14px rgba(0,0,0,.6)` |
| `--focus-ring` | `0 0 0 3px rgba(14,91,68,.28)` | `0 0 0 3px rgba(62,207,154,.35)` |

ظلال حرفية غير متغيّرة عبر ملفات أخرى (لا تتبع الوضع الداكن): `0 10px 25px rgba(0,0,0,.25)` لـ `.live-panel-fab`، `0 4px 12px rgba(0,0,0,.05)` لـ `.template-card:hover`، `-4px 0 12px rgba(0,0,0,.2)` لسايدبار الجوّال.

### 1.5 الانحناءات (Border Radius)

| المتغيّر | القيمة | الاستخدام الشائع |
|---|---|---|
| `--r-sm` | `6px` | عناصر صغيرة (حقول، أزرار أيقونة) |
| `--r-md` | `10px` | الأشيع: `stage-bar`، `template-card`، بطاقات عامة |
| `--r-lg` | `16px` | بطاقات كبيرة؛ أيضاً حرفياً لـ bottom-sheet الجوّال (`16px 16px 0 0`) |
| `--r-xl` | `20px` | معرّف، استخدام محدود |
| `--r-pill` | `999px` | كل الشارات/الرقاقات/الأزرار الحبّية (pill) |
| قيم حرفية إضافية | `4px` (`.btn-icon`)، `8px` (`.export-opt-ic`)، `50%` (دوائر كاملة) | غير مربوطة بمتغيّر |

### 1.6 نقاط الكسر (Breakpoints)

| نقطة الكسر | السلوك |
|---|---|
| **الجوّال** `max-width: 768px` | يخفي `.app-header` بالكامل؛ `.app-shell` عمود واحد؛ يظهر `.mobile-header` و`.mobile-kpi-bar`؛ `.sidebar-overlay`/`.live-panel` تتحوّل لتراكب كامل الشاشة؛ `.live-panel` ينزلق من الأسفل (bottom sheet، ارتفاع `min(70vh,520px)`، زوايا علوية `16px 16px 0 0`) مع مقبض `.live-panel-handle` |
| **تابلت/سطح مكتب صغير** `max-width: 1300px` | `.app-shell` عمود واحد؛ `.live-panel` يصبح لوحة عائمة ثابتة (عرض `360px`، `max-width: 92vw`) تنزلق أفقياً من اليمين، يظهر زر عائم `.live-panel-fab` (48×48) |
| **سطح مكتب** `min-width: 769px` | يُخفي `.sidebar` و`#stepperNav` نهائياً — **القائمة الجانبية أُلغيت رسمياً**؛ التنقّل الأساسي هو شريط المراحل داخل الصفحة |

### 1.7 الحركة والانتقالات (Transitions & Animations)

| العنصر | القيمة |
|---|---|
| انتقال عام (utility) | `.transition` → `all 0.2s ease` / `.transition-fast` → `all 0.1s ease` |
| انتقال تفاعل عالمي | `--transition-base: 0.18s cubic-bezier(0.2,0.7,0.2,1)` (طبقة "التلميع" العالمية) |
| دخول بطاقة | `.animate-entry` → `slideInUp 0.6s cubic-bezier(0.16,1,0.3,1)` |
| محتوى خطوة المعالج | `.step-content` → `slideInLeft 0.5s cubic-bezier(0.16,1,0.3,1)` |
| نبضة ذهبية | `.animate-pulse` → `pulse-gold 2s infinite` (حلقة `box-shadow` تتوسع حتى 10px) |
| تلاشي دخول | `.fade-in` → `fadeIn 0.3s ease-in` / شعار السايدبار `fadeIn 0.8s ease-out` |
| شريط تقدّم المعالج | تعبئة `width` بانتقال `0.5s cubic-bezier(0.2,0.7,0.2,1)` |
| **إمكانية الوصول** | `prefers-reduced-motion: reduce` يُصفّر كل مدد الحركة إلى `0.001ms` عالمياً (يشمل الشريط والمكوّنات) — التزام WCAG 2.3.3 |

### 1.8 طبقات العمق (Z-index)

| العنصر | القيمة |
|---|---|
| `.mobile-header` | `1002` (الأعلى) |
| `.live-panel` / `.live-panel-fab` / `.sidebar` (جوّال) | `1001` |
| `.sidebar-overlay` / `.live-panel-overlay` (خلفية تعتيم، `backdrop-filter: blur(2px)`) | `1000` |
| `.modal-overlay` (النوافذ المنبثقة القياسية) | `9999` |
| `.toast-container` | `10000` (الأعلى مطلقاً) |

---

## 2. نظام ألوان صفحة الهبوط المنفصل (`landing.html`)

**مستقل تماماً وليس مشتقّاً** من نظام القسم 1 — معرّف بالكامل داخل وسم `<style>` في `<head>` (لا يستورد `variables.css`). **لا يوجد وضع داكن لهذه الصفحة** (لم يُعثر على `[data-theme=dark]` فيها).

### 2.1 الألوان

| الاسم | متغيّر CSS | القيمة | ملاحظة مقارنة مع نظام التطبيق |
|---|---|---|---|
| أخضر 900 (الأغمق) | `--green-900` | `#062e23` | |
| أخضر 800 | `--green-800` | `#084532` | خلفية الشريط الإعلاني العلوي |
| **أخضر 700 (أساسي)** | `--green-700` | `#0b6b4f` | ≈ يقابل `--c-p-500` (`#0e5b44`) لكن **قيمة مختلفة حرفياً** |
| أخضر 600 | `--green-600` | `#108264` | |
| أخضر 500 | `--green-500` | `#17a37c` | |
| نعناعي 100 | `--mint-100` | `#e3f4ec` | |
| نعناعي 50 (خلفية أقسام فاتحة) | `--mint-50` | `#f5faf7` | |
| **ذهبي** | `--gold` | `#d7aa4a` | أفتح وأكثر إشراقاً من `--c-gold-500` (`#8a5f1c`) |
| ذهبي عميق | `--gold-deep` | `#b8892f` | |
| ذهبي ناعم | `--gold-soft` | `#fff5dc` | |
| حبر (نص أساسي) | `--ink` | `#10201a` | |
| حبر 2 | `--ink-2` | `#33443c` | |
| خافت | `--muted` | `#525f58` | |
| خافت 2 | `--muted-2` | `#66756d` | عُمِّق عمداً من `#7c8a83` لتجاوز تباين 4.5:1 (تعليق في الكود) |
| خط فاصل | `--line` | `rgba(16,32,26,.12)` | |
| خط فاصل بارز | `--line-strong` | `rgba(16,32,26,.22)` | |
| أبيض (خلفية الصفحة) | `--white` | `#ffffff` | بخلاف `--c-bg-app` الورقي الدافئ (`#f6f5f0`) في التطبيق |
| خطر | `--danger` | `#b8332b` | |
| نجاح | `--ok` | `#16835f` | |

### 2.2 الطباعة

| المتغيّر | القيمة |
|---|---|
| `--font` | `'IBM Plex Sans Arabic', system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif` |
| `--mono` | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |
| `--text-xs` | `12.5px` |
| `--text-sm` | `14px` |
| `--text-base` | `15.5px` (حجم الجسم الافتراضي) |
| `--text-lg` | `18px` |
| `--text-xl` | `22px` |

### 2.3 المسافات والانحناءات والظلال

| المتغيّر | القيمة |
|---|---|
| `--pad-card` | `clamp(22px, 3vw, 30px)` |
| `--wrap` (أقصى عرض المحتوى) | `1180px` |
| `--r-sm` | `8px` |
| `--r` | `12px` |
| `--r-lg` | `16px` |
| `--r-pill` | `999px` |
| `--shadow-sm` | `0 6px 18px -12px rgba(6,46,35,.38)` |
| `--shadow-md` | `0 16px 40px -22px rgba(6,46,35,.5)` |
| `--shadow-lg` | `0 30px 70px -34px rgba(0,0,0,.58)` |

> ⚠️ **قرار مطلوب من فريق المنتج قبل بناء مكتبة فيغما موحّدة:** هل يُدمَج هذان النظامان في نظام واحد (تحديث `landing.html` ليستورد `variables.css`)، أم يبقيان منفصلين عمداً (لغة بصرية "تسويقية" مقابل "تطبيقية")؟ حالياً أي تحديث لهوية الألوان في أحدهما (كإصلاحات تباين سبق تطبيقها على `--c-*`) **لا ينعكس تلقائياً على الآخر**.

### 2.4 نظام ثالث شبه مستقل (للعلم فقط) — هيرو الصفحة الرئيسية للتطبيق

قسم "الهيرو" الجديد في `DashboardView.js` (`dashboard-home.css`، أصناف `.qh-*`) يستعير أسلوب صفحة الهبوط التحريري لكنه **داخل التطبيق نفسه**، بتوكنات محلية إضافية: `--qh-green: #2f5c48`، `--qh-gold: #b08a4a`، وظل مخصص `--qh-shadow`، **مع نسخة داكنة صريحة عبر `[data-theme=dark]`** (بخلاف صفحة الهبوط الفعلية التي لا تملك وضعاً داكناً). راجع `web/css/dashboard-home.css` مباشرة للقائمة الكاملة عند الحاجة لدقة أعلى — هذا نظام ثالث فعلي وليس خطأ توثيقي.

---

## 3. مكتبة الأيقونات (Icon Library)

**مكتبتان منفصلتان تماماً** (كل ملف يعرّف نسخته الخاصة من `<symbol>` ولا تشتركان في DOM):

1. **`web/index.html`** (أسطر ~77–114): 28 رمزاً — مكتبة التطبيق الرئيسي.
2. **`web/landing.html`** (أسطر ~490–511): 14 رمزاً — مكتبة صفحة الهبوط.

**نمط الاستدعاء الموحّد في كل مكان:** `<svg class="ic"><use href="#i-xxx"/></svg>` — لا استخدام لـ `xlink:href`. كل الأيقونات: `viewBox="0 0 24 24"`، `stroke="currentColor"`, `fill="none"`, `stroke-width: 1.75`, `stroke-linecap/linejoin: round`. الحجم الافتراضي `.ic { width/height: 1.15em }` (يتغيّر حسب السياق: `.btn .ic` → 17px، `.btn-icon .ic` → 20px، `.ic-nav` → 18px).

**⚠️ ملاحظة تصميم مهمة:** 4 معرّفات مشتركة بالاسم بين المكتبتين (`i-bolt`، `i-doc`، `i-shield`، `i-chart`) لها **نفس مسار SVG بالضبط**؛ لكن `i-check` و`i-x` لهما **تصميم مختلف** بين المكتبتين (نسخة `index.html` بدائرة محيطة، نسخة `landing.html` علامة مجردة بلا دائرة) — قرار يستحق التوحيد في فيغما (استخدام نسخة واحدة كمكوّن Icon قابل لإعادة الاستخدام).

### 3.1 أيقونات `index.html` (مكتبة التطبيق) — 28 رمزاً

| المعرّف | الشكل | الاستخدام الفعلي (أين ولماذا) |
|---|---|---|
| `i-bolt` | برق/صاعقة | شعار «قرار» في الترويسة/السايدبار؛ زر «كيف يُولَّد المحتوى؟»؛ أزرار تشغيل مولّدات AI (اسأل مساعد AI، مونت كارلو، تقرير مفصّل، اقتراح خطة) |
| `i-save` | قرص حفظ (Floppy) | حفظ الدراسة (ترويسة + سايدبار + لوحة القرار) |
| `i-download` | سهم لأسفل داخل صندوق | تصدير/تنزيل (PDF، Pitch Deck، JSON) |
| `i-upload` | سهم لأعلى داخل صندوق | استيراد دراسة/نسخة احتياطية من ملف |
| `i-clipboard` | لوح حافظة | استيراد CSV؛ عنوان «ما يشمل تقريرنا» في مودال العينة |
| `i-reset` | سهم دائري رجوع | إعادة ضبط البيانات؛ إعادة الحساب؛ حالة «جارٍ المعالجة» أثناء محاكاة/توليد |
| `i-history` | ساعة بعقربين | تاريخ الإصدارات؛ عنوان «الجدول الزمني للتنفيذ» |
| `i-share` | 3 دوائر متصلة | مشاركة الدراسة (صلاحية محرر/مشاهد) |
| `i-shield` | درع بعلامة صح | التوافق مع بنك التنمية ومنشآت؛ حالات QA Gate؛ الإفصاح الأمني |
| `i-moon` | هلال | تبديل المظهر → داكن |
| `i-sun` | شمس مشعّة | تبديل المظهر → فاتح |
| `i-auto` | دائرة نصفها معبأ | تبديل المظهر → تلقائي؛ شعار قسم «المستشار الذكي» |
| `i-chart` | محور بياني بخط متعرج | عناوين أقسام رسوم بيانية (مونت كارلو، مقارنة أفكار، نسبة COGS) |
| `i-doc` | ورقة مستند | تصدير PDF؛ «بناء التقرير»؛ مودال عينة التقرير؛ أيقونة كل دراسة محفوظة |
| `i-table` | شبكة جدول | تصدير Excel |
| `i-slides` | شاشة عرض بقاعدة | تصدير PowerPoint؛ زر «عرض المستثمر» |
| `i-pen` | قلم مائل | تصدير Word |
| `i-bank` | مبنى بنك | تصدير «التقرير البنكي» |
| `i-code` | `< >` | تصدير JSON |
| `i-plus` | زائد | إضافة فكرة مشروع بديلة؛ إنشاء دراسة جديدة |
| `i-folder` | مجلد | الدراسات المحفوظة؛ حالة جدول فارغ |
| `i-trash` | سلة مهملات | حذف دراسة؛ سلة المحذوفات؛ حذف فكرة بديلة |
| `i-link` | حلقتا سلسلة | رابط لوحة المستثمر؛ عنصر «التكاملات» |
| `i-user` | شخص فردي | زر حجز استشارة (Zoom) |
| `i-chev-down` | شيفرون سفلي | فتح قائمة «المزيد» في لوحة القرار |
| `i-check` | دائرة + صح | حالات النجاح/الاجتياز (QA، مونت كارلو) |
| `i-x` | دائرة + إكس | حالات الرفض/الفشل |
| `i-warning` | مثلث تحذير | نقص بيانات الإيرادات؛ رسائل خطر/حرجة في المستشار المالي |
| `i-hand-stop` | شكل سداسي (يد توقف) | رسائل تحذير متوسطة (المستشار المالي) |
| `i-lightbulb` | مصباح | اقتراح/نصيحة من المستشار الذكي |
| `i-rocket` | صاروخ | رسالة إيجابية «أداء المشروع ممتاز» |
| `i-users` | شخصان | نسبة تكلفة العمالة (شريط النسب المالية) |
| `i-home` | منزل | نسبة تكلفة الإيجار |
| `i-flag-sa` | علم موجي | عنوان جدول «توطين مالي» (GOSI/جنسية) |

### 3.2 أيقونات `landing.html` (مكتبة صفحة الهبوط) — 14 رمزاً

| المعرّف | الشكل | الاستخدام الفعلي |
|---|---|---|
| `i-check` | صح مفرد (بلا دائرة) | قوائم المزايا، جدول المقارنة، الباقات السعرية، «درجة المدقق» |
| `i-x` | إكس مفرد (بلا دائرة) | عمود «مكتب الدراسات التقليدي» في جدول المقارنة |
| `i-eye` | عين لوزية | زر/روابط «شاهد تقريراً نموذجياً»؛ ركيزة «شفاف» |
| `i-target` | دائرة أهداف (Bullseye) | ركيزة «متخصص» (قوالب مختصين) |
| `i-bolt` | برق (مطابق لـ index.html) | شعار الهيدر؛ ركيزة «سريع» |
| `i-tag` | وسم/سعر | **معرّفة لكن غير مستخدَمة فعلياً** (خاملة) |
| `i-doc` | ورقة مستند (مطابق لـ index.html) | — |
| `i-shield` | درع (مطابق لـ index.html) | شريط الإثبات «امتثال سعودي مدمج»؛ ركيزة «محلي» |
| `i-chart` | محور بياني (مطابق لـ index.html) | **معرّفة لكن غير مستخدَمة فعلياً في هذا الملف** رغم استخدامها في ملفات أخرى |
| `i-scale` | ميزان | **معرّفة لكن غير مستخدَمة فعلياً** (خاملة) |
| `i-alert` | مثلث تحذير (رأس أنعم) | وسم «مثال توضيحي»؛ نقاط «المشكلة»؛ خلايا المقارنة لصالح المكتب التقليدي |
| `i-lock` | قفل | **معرّفة لكن غير مستخدَمة فعلياً** (خاملة) |
| `i-arrow` | سهم أفقي | **معرّفة لكن غير مستخدَمة فعلياً** (خاملة) |
| `i-wa` | شعار واتساب | أزرار التواصل/الطلب عبر واتساب (الشريط العلوي، بطاقات الأسعار) |

> **ملاحظة للمصمم:** 5 أيقونات في `landing.html` (`i-tag`, `i-scale`, `i-lock`, `i-arrow`, وأيضاً `i-chart` محلياً) معرّفة في الكود لكن غير مُستدعاة بـ `<use>` في أي مكان حالياً — على الأرجح محجوزة لتطوير مستقبلي في صفحة الهبوط. أدرجها في مكتبة فيغما كـ"أيقونات احتياطية" منفصلة عن الأيقونات الفعّالة.

---

## 4. مكتبة المكونات (Component Library)

المصادر: `web/css/components.css` (المكتبة الأساسية، 3774 سطراً) + `web/css/wizard-forms.css`/`wizard-inline.css`/`onboarding-polish.css`/`polish.css`/`simple-mode.css` (مكونات المعالج) + `web/css/decision-dashboard.css`/`investor.css`/`dashboard-home.css`/`scenario-switcher.css`/`timeline.css`/`ai.css`/`chrome-declutter.css` (لوحات ومكونات متخصصة) + `web/css/toast.css`/`tooltip.css` (تنبيهات).

### 4.1 الأزرار (Buttons)

**الأصناف:** `.btn`, `.btn--primary`, `.btn--ghost`, `.btn--success`, `.btn-sm`/`.btn--sm`, `.btn-xs`

الزر الأساسي في كل التطبيق: شكل «حبّة» (pill) كامل الاستدارة، `padding: 0.55rem 1.25rem`، `border-radius: var(--r-pill)`.

| Variant | الوصف |
|---|---|
| `btn--primary` | تدرّج عمودي `var(--c-p-500)→var(--c-p-600)`، نص أبيض عريض، `box-shadow: var(--shadow-btn)` |
| `btn--ghost` | شفاف بحدود رمادية — ثانوي |
| `btn--success` | خلفية `var(--c-success)` صلبة لتأكيد الإنجاز |
| `btn-sm`/`btn--sm` | حجم مصغّر |
| `btn-xs` | حبّة صغيرة جداً (padding `4px 12px`) |

**الحالات:**
- `:hover` → `translateY(-1px)` + تفتيح اللون
- `:active` → `scale(.985)`
- `:focus-visible` → outline ذهبي `var(--c-gold-deco)`
- `:disabled` (داخل `.wizard-nav`) → `opacity: .5` + `cursor: not-allowed`

### 4.2 أزرار الأيقونات (Icon Buttons)

**الأصناف:** `.btn-icon`, `.btn-close`, `.btn-delete`, `.btn-delete-act`, `.btn-magic-wand`, `.mobile-nav-close`, `.toast-close`, `.btn-remove-swot`, `.btn-magic` (AI السحري، تدرّج بنفسجي `#6366f1→#a855f7`)

أزرار بلا نص، أيقونة فقط. `background: none`، بلا حدود غالباً، padding صغير (4px) أو مربع ثابت (`.btn-close` 32×32px، `.btn-magic-wand` 2×2rem).

**الحالات:** `:hover` (زيادة opacity/خلفية خفيفة)، `.btn-magic-wand:disabled` (opacity .7)، `[aria-busy="true"]` (نبض `magic-pulse`)، `.gantt-row:hover .btn-delete-act` (ظهور تدريجي)، `:focus-visible` (outline ذهبي).

### 4.3 حقول الإدخال (Text / Number / Date / Select / Textarea / Checkbox)

**الأصناف:** `label`, `input[type=text/email/password/date/number]`, `select`, `textarea`, `.input`, `.input--sm`, `.input-actual`, `.input--textarea`, `.dynamic-table .table-input`

تنسيق موحّد: صندوق بحدّ رفيع `1px solid var(--c-border)`، `border-radius: var(--r-sm)`، ارتفاع لمس لا يقل عن **44px**، `padding: 0.55–0.6rem`. الحقول الرقمية/التاريخ: `font-family: var(--font-mono)`، `tabular-nums lining-nums`، `direction: ltr; text-align: end`. سهم `select` مخصص عبر SVG مضمّن يتبدل في الوضع الداكن.

**الحالات:**
- `:hover` → حدّ أغمق قليلاً
- `:focus` → حدّ `var(--c-p-500)` + `box-shadow: var(--focus-ring)`
- `user-invalid`/`.has-error` → حدّ وخلفية حمراء (`var(--c-danger-subtle)`)، تبقى واضحة عند `:focus`
- `.is-valid` → حدّ أخضر خافت + أيقونة صح SVG داخل الحقل
- Checkbox: `17×17px`, `accent-color: var(--c-p-500)` (بلا تصميم مخصّص — مظهر المتصفح الافتراضي)

**عناصر مرافقة:** `.field-hint` (نص مساعد 0.75rem)، `.field-error` (رسالة خطأ حمراء + أيقونة تنبيه SVG، مخفية افتراضياً وتظهر فقط ضمن `.has-error`)، `.req-mark` (نجمة إلزام حمراء)، `.tooltip-auditor` (أيقونة تلميح مدقق مالي).

### 4.4 تنظيم النماذج (Form Layout)

**الأصناف:** `.form-group`, `.form-row`, `.form-row--2`, `.input-group`, `.input-label`, `.input-with-ai`, `.form-grid`

حاويات شبكية متجاوبة (`grid-template-columns: repeat(auto-fit, minmax(200px,1fr))` لـ `form-row`؛ عمودان ثابتان لـ `form-row--2`)؛ تتحول لعمود واحد تلقائياً تحت 600–768px.

### 4.5 البطاقة الأساسية (Card) وعائلتها

**البطاقة الأساسية:** `.card` — خلفية `var(--c-bg-card)`، حدّ `1px solid var(--c-border)`، `border-radius: var(--r-md)`، `padding: var(--s-3)`، `box-shadow: var(--shadow-sm)`. عند `:hover` → حدّ `var(--c-p-subtle)` + طبقة ظل إضافية.

**عائلة كبيرة من البطاقات المتخصصة** (نفس النمط البصري، classes مستقلة): `.kpi-card`, `.service-card`, `.product-card`, `.customer-value-card`, `.location-alt-card`, `.scenario-card`, `.goal-card`, `.org-card`, `.template-card`, `.export-card`, `.kpi-mini-card`, `.highlight-card`, `.term-box`, `.sim-stat-box`, `.report-builder-card`, `.summary-card`, `.funding-source`, `.pestel-item`, `.porter-force`, `.ranking-item` — مع Variants دلالية: `kpi-positive`/`kpi-negative`، `service-viable`/`not-viable`، `scenario-pessimistic`/`base`/`optimistic`، `goal-status` (pending/progress/achieved).

### 4.6 النوافذ المنبثقة (Modal / Dialog) — النمط الأساسي

**الأصناف:** `.modal-overlay`, `.modal-overlay.is-open`, `.modal-card`, `.modal-header`, `.modal-body`, `.modal-footer`, `.export-modal`

نافذة فوق طبقة تعتيم زجاجية: `rgba(0,0,0,.75)` + `backdrop-filter: blur(8px)`، `z-index: 9999`. `.modal-card`: خلفية `var(--c-bg-panel)`، `border-radius: var(--r-lg)`، `box-shadow: var(--shadow-lg)`، `max-width/height: 90vw/90vh`. حالة الإخفاء: `display: none` بلا `.is-open`؛ الإظهار: `display: flex` + `opacity: 1`.

> **10 نوافذ منبثقة فعلية في المشروع** مبنية فوق هذا النمط الأساسي — الجرد الكامل بكل حالاتها في القسم [5.9](#59-النوافذ-المنبثقة-modals--جرد-كامل).

### 4.7 التنبيهات والبانرات (Alerts / Decision Banners)

**الأصناف:** `.alert`, `.alert-info`/`.alert--info`, `.alert-warning`/`.alert--warning`, `.decision-banner` (+ `.is-go`/`.is-nogo`/`.is-revise`), `.decision-banner-premium` (+ `.go`/`.nogo`/`.conditional`), `.verdict-box`, `.verdict-success`, `.verdict-warning`

- **`.alert`**: صندوق بحدّ جانبي ملوّن (`border-inline-start: 3px`) — `info` (أخضر `var(--c-p-500)`) أو `warning` (ذهبي `var(--c-gold-deco)`).
- **`.decision-banner`**: بانر قرار الجدوى على مستوى الدراسة الكاملة. `is-go` (تدرّج أخضر `var(--c-p-600)→var(--c-p-500)`)، `is-nogo` (خلفية `var(--c-danger-subtle)`)، `is-revise` (**ذهبي `var(--c-warning)` وليس أحمر** — تمييز متعمّد بين «رفض» و«يحتاج مراجعة»).

### 4.8 إشعارات Toast

**الأصناف:** `.toast-container`, `.toast`, `.toast-show`, `.toast-icon`, `.toast-message`, `.toast-close`, `.toast-success`, `.toast-error`, `.toast-warning`, `.toast-info`, (+ `.toast-magic` في `components.css` لميزات AI بنفسجي)

عائمة أسفل اليمين (`position: fixed; bottom/top: 20px`)، تتكدّس رأسياً. البطاقة: خلفية بيضاء `#fff`، `border-radius: 8px`، `box-shadow: 0 4px 12px rgba(0,0,0,.15)`، `min-width: 300px; max-width: 500px`، شريط تمييز `border-inline-start: 4px solid` حسب النوع.

| النوع | لون الشريط/الأيقونة | خلفية الأيقونة |
|---|---|---|
| `success` | `var(--c-success)` | `#d1fae5` / نص `#059669` |
| `error` | `var(--c-danger)` | `#fee2e2` / نص `#dc2626` |
| `warning` | `var(--c-warning)` | `#fef3c7` / نص `#d97706` |
| `info` | `var(--c-accent-blue)` | `#dbeafe` / نص `#2563eb` |

**الحالات:** ابتدائي (`opacity:0; translateX(400px)`) → `.toast-show` (`opacity:1; translateX(0)`) → إخفاء (`fade-out-down`). على الجوّال (`max-width:640px`): يمتلئ عرض الشاشة بدل الحدّ الأدنى الثابت. `prefers-reduced-motion`: تلاشي فقط بلا انزلاق.

### 4.9 التلميحات (Tooltip)

**الأصناف:** `.tooltip-wrapper`, `.tooltip-content`, `.tooltip-content::after` (السهم), `.tooltip-icon`, `.tooltip-left`/`.tooltip-right` (اتجاه), `.tooltip-success`/`.tooltip-warning`/`.tooltip-info` (لون), `.tooltip` (نمط ثانٍ أبسط في `components.css` عبر `::after` وattr)

**النمط الأساسي (`tooltip.css`):** الغلاف بحدّ سفلي منقّط (`cursor: help`)؛ الصندوق المنبثق (`position:absolute; bottom:125%`) خلفية داكنة شبه شفافة `rgba(17,24,39,.95)`، نص أبيض، `border-radius: 8px`, `width: 280px` (جوّال: `240px`)، مع سهم مثلث أسفله. تنسيقات فرعية: `strong` (تمييز بلون التحذير)، `.formula` (خط Mono لعرض معادلة مالية).

### 4.10 الشارات (Badges / Status Tags)

**الأصناف:** `.badge`, `.badge--danger`/`--warning`/`--info`/`--success`/`--neutral`, `.badge--tam`/`--sam`/`--som`, `.smart-s`/`-m`/`-a`/`-r`/`-t` (5 ألوان)، `.goal-status`/`.status-pending`/`-progress`/`-achieved`، `.service-status`, `.ranking-badge`

تسميات حبّة صغيرة (`border-radius: var(--r-pill)`, `padding: 4–8px×8–16px`, `font-size: 0.7–0.85rem`, `font-weight: 600`)، خلفية شفافة بنفس لون النص عبر `color-mix()`.

### 4.11 الجداول (Tables) — بما فيها المكوّن الأهم DynamicTable

**جداول عرض ثابتة:** `.summary-table`, `.income-statement`, `.comparison-table`, `.service-comparison-table`, `.data-table`, `.loan-schedule-table` — `border-collapse: collapse`, رؤوس `thead` بخلفية `var(--c-bg-app)`، صفوف `.total-row` بخلفية ذهبية وحدّ علوي سميك `var(--c-p-500)`.

**`DynamicTable` (المكوّن الجدولي القابل لإعادة الاستخدام الأهم في المشروع):**
- **الوصف:** جدول قابل للتحرير الكامل (إضافة/حذف صف، خلايا نصية/رقمية/select/checkbox/محسوبة)، تحويل تلقائي كسر↔نسبة مئوية لأعمدة محدَّدة، زر «🪄 تقدير تلقائي» لكل خلية فارغة، زر «اقتراح بنود» AI، ووضع «سريع» يُخفي الأعمدة المتقدمة خلف مفتاح.
- **الأصناف:** `.dynamic-table.quick-mode`, `.table-header`, `.table-wrapper`, `.table-input`, `.btn-add-row`, `.btn-suggest`, `.btn-delete`, `.btn-magic-cell`, `.col-advanced.hidden`, `.computed-cell`, `.empty-state`
- **الحالات:** فارغ (صندوق منقّط + زر «مقترحات أولية ✨»)، محمّل/مُعبَّأ، وضع سريع مطوي/موسّع، تحميل تقدير خلية (زر معطَّل + نبض 600ms)، تحميل اقتراح AI (تعطيل + «جاري التوليد...»)، خطأ (alert/toast).
- **يُستخدم في:** عشرات خطوات المعالج — المعدات، الموظفون، التراخيص، مصادر الإيرادات، الموارد التقنية، المنافسون، مراحل التنفيذ، المباني، الأثاث، تكاليف التأسيس، الموردون، تقييم الموقع، مؤشرات الأداء التشغيلية، المراجع/المحكّمون.

### 4.12 أشرطة التقدّم (Progress Bars) والمقاييس

**الأصناف:** `.progress-bar`, `.progress-bar-fill`, `.completion-rate`, `.breakdown-bar`, `.completeness-widget`, `.stress-bar-track`/`-fill` (+ `.stress-bar-negative`)، `.dv-track`/`.dv-track__fill` (بطاقة المشروع)، `.status-track`/`.status-fill` (شريط السايدبار)

شريط أفقي رفيع (4–10px)، `border-radius` نصف الارتفاع، `transition: width 0.3s ease`، تلوين ديناميكي (`bg-success`/`bg-warning`/`bg-danger`) حسب النسبة.

### 4.13 العدادات الدائرية والمقاييس (Gauges / Score Circles)

**أهم مكوّن بصري في التطبيق — `.dd-gauge` (عداد لوحة القرار):**
- عداد SVG دائري (`stroke-dasharray/dashoffset`)، قطر **168px**، مدوَّر `-90deg`، مسار خلفي `rgba(255,255,255,.18)`، قوس تعبئة بانتقال `1.2s`، رقم مركزي **2.4rem/700**.
- **لون قوس التعبئة يُحقن ديناميكياً من JS (4 مستويات وليست ثنائية):**

| النطاق | اللون |
|---|---|
| `≥ 80` | نجاح `var(--c-success)` |
| `60–79` | أزرق `var(--c-accent-blue)` (حالة وسيطة) |
| `40–59` | تحذير `var(--c-warning)` |
| `< 40` | خطر `var(--c-danger)` |

**عدادات أخرى:** `.score-circle`/`.score-excellent`/`-good`/`-fair`/`-poor` (الملخص التنفيذي)، `.idea-score-widget`/`.idea-score--red`/`-yellow`/`-green` (نتيجة الفكرة الأولية)، `.nitaqat-indicator` (مؤشر نطاقات السعودة، دائرة 120px)، عداد «درجة الجاذبية الاستثمارية» في `InvestorAnalysis.js`.

### 4.14 التنقّل (Navigation Components)

**شريط مراحل الهيدر:** `.stage-bar`, `.stage-chip` (+ `.is-active`/`.is-complete`), `.stage-chip__dot`, `.stage-chip__label` — يُبنى ديناميكياً، شريحة لكل قسم رئيسي.

**شريط تقدّم داخل المعالج:** `.wizard-progress`, `.progress-step-label`, `.progress-percent`, `.progress-eta` — نسبة مئوية + وقت متبقٍ مقدَّر.

**شريط تنقّل سابق/تالي (`.wizard-nav`):** ثابت (sticky) أسفل كل خطوة، خلفية `var(--c-bg-card)`، `box-shadow: var(--shadow-lg)`، الأزرار `min-height: 44px`, `border-radius: var(--r-pill)`؛ `#btnNextStep` بتدرّج بارز.

**السايدبار (`Sidebar.js`) — ⚠️ مُعطّل بصرياً فعلياً في وضع العمل** (راجع القسم 7): `.nav-section` (+ `.contains-active`/`.is-expanded`), `.nav-section-header`, `.step-item` (+ `.is-active`/`.is-complete`), `.step-icon`, `.sidebar-status` (3 صفوف حالة مدمجة بدل 3 بطاقات: نتيجة الفكرة، الاكتمال).

**قائمة جوّال عائمة (Off-canvas):** `.mobile-menu-btn`, `.fab-export`, `.mobile-overlay`, `.mobile-nav` (+ `.is-open`) — FAB دائري 56px، ينزلق من `right:-300px` إلى `0`.

### 4.15 مكونات متخصصة بالقسم (Composite Widgets)

تخطيطات مركّبة **خاصة بصفحة واحدة** (ليست مكونات عامة قابلة لإعادة الاستخدام في أي مكان)، مبنية فوق المكونات الأساسية أعلاه:

| المكوّن | الاستخدام |
|---|---|
| `.pestel-grid` | شبكة PESTEL (6 بطاقات عوامل) — `StrategicAnalysis.js` |
| `.swot-grid`/`.swot-quadrant` | أرباع SWOT ملوّنة (قوائم قابلة للإضافة) |
| `.porter-diagram` | القوى الخمس لبورتر (5 بطاقات بمواقع نسبية) |
| `.tows-grid` | مصفوفة TOWS (حدود متقطعة تتحول صلبة عند focus) |
| `.bm-grid` | Business Model Canvas (9 بطاقات) |
| `.ms-tier--tam`/`--sam`/`--som` | بطاقات تحجيم السوق (حدّ علوي أزرق→أخضر→ذهبي) |
| `.risk-matrix-grid` | مصفوفة مخاطر 3×3 (4 درجات لونية) |
| `.org-chart` | مخطط تنظيمي شجري |
| `.gantt-wrapper`/`.gantt-bar` | جدول جانت (5 فئات لونية) |
| `.timeline-chart__node` | خارطة طريق بديلة (عقد سحب-وإفلات) |
| `.funding-sources-grid`/`.wacc-breakdown` | هيكل التمويل وحاسبة WACC |
| `.balance-sheet-grid` | الميزانية الافتتاحية |
| `.dd-verdict`/`.dd-gauge`/`.dd-status`/`.dd-scores` | **لوحة القرار الاستثماري** (الأهم في المشروع) |
| `.pitch-view` | صفحة عرض المستثمر |
| `.dv-*` (`dv-topbar`, `dv-start`, `dv-workspace`...) | منظومة الصفحة الرئيسية |
| `.qh-*` (`qh-hero`, `qh-journey`, `qh-trust-panel`) | هيرو الصفحة الرئيسية بنمط تحريري |

### 4.16 مكونات إضافية للحالة والتفاعل

- **مؤشر تحميل دوّار:** `.spinner` (16×16px، `border-top-color` ملوّن، `animation: spin 0.8s linear infinite`).
- **أشرطة التمرير (Range Sliders):** `.sensitivity-slider`, `.stress-slider` — مقبض دائري 20×20px مخصّص المظهر (`appearance: none`).
- **فحوصات الجودة (QA):** `.qa-check.qa-pass`/`.qa-fail` — صف بخلفية خضراء/حمراء شفافة.
- **أزرار نعم/لا:** `.yesno__btn`/`.yesno-btn` (+ `.is-active`) — تستبدل checkboxes للأسئلة المنطقية، حبّة `min-width: 72px`.
- **شرائح موارد متعددة الاختيار:** `.res-chip` (+ `.active`).
- **بطاقات اختيار الوضع:** `.mode-card` (+ `.active`) — لاختيار مستوى تفصيل الدراسة.
- **أيقونات SVG سطرية:** `.ic`, `.ic-nav` — موحّدة الحجم `currentColor`.
- **مرافق CSS (utility classes):** `.flex`, `.flex-between`, `.gap-1`, `.rounded-lg`, `.rounded-full`, `.text-xs`/`.text-xl`, `.font-mono`/`.num`.

### 4.17 عناصر واجهة إضافية موثّقة من ملفات الودجت (`web/js/ui/widgets/` + `components/`)

| المكوّن | الوصف المختصر | الملف |
|---|---|---|
| **FieldHelp** | أيقونة «؟» دائرية بجانب أي تسمية حقل تفتح فقاعة شرح مبسّط + مثال اختياري؛ event delegation عالمي | `components/FieldHelp.js` |
| **FounderCardGenerator** | مولّد «بطاقة رائد أعمال» قابلة للمشاركة، مرسومة بالكامل عبر Canvas (نمط Spotify-Wrapped)، تحميل PNG + مشاركة تويتر | `widgets/FounderCardGenerator.js` |
| **FundingSimulator** | محاكي «قبول تمويل» تقديري لبنك التنمية الاجتماعية (نموذج + محرك قواعد محلي → نسبة قبول 0-100% ملوّنة) | `widgets/FundingSimulator.js` |
| **ResourcesMenu** | قائمة منسدلة «📚 مركز المعرفة والموارد» في الشريط العلوي — غلاف عرض فقط يستدعي callbacks | `widgets/ResourcesMenu.js` |
| **SensitivityWidget** | أداة «ماذا لو؟» بشريحتَي تمرير لحساب صافي ربح تقريبي حي. ⚠️ **مستورَد لكن غير مُركَّب في أي شاشة حالياً** (كود يتيم) | `widgets/SensitivityWidget.js` |
| **Charts** | غلاف Chart.js لرسم شريطي (إيراد/صافي ربح). ⚠️ **غير مستخدَم في أي مكان بالشجرة** — يبدو مُستبدَلاً بـ ReviewCharts | `js/ui/Charts.js` |
| **ReviewCharts** | دوال ثابتة لرسم Doughnut (حصص المنافسين) وBar أفقي (توزيع الرواتب) — تُستخدم في خطوة المراجعة | `js/ui/ReviewCharts.js` |
| **TimelineChart** | خارطة طريق أفقية 12 شهراً بعقد سحب-وإفلات (فأرة ولمس)، 5 فئات لونية | `js/ui/TimelineChart.js` |
| **RiskMatrix** | مصفوفة 3×3 + سجل مخاطر تفصيلي (13 عموداً) + زر حقن حزمة مخاطر قطاعية جاهزة | `js/ui/RiskMatrix.js` |

### 4.18 حالات عامة متكررة عبر كل المكونات (نمط تصميم متسق)

| الحالة | السلوك النمطي |
|---|---|
| **فارغ (Empty)** | صندوق حدّ منقّط أو رسالة توضيحية + غالباً زر إجراء لملء أولي (مثال: `DynamicTable` → «إضافة مقترحات أولية ✨») |
| **تحميل (Loading)** | تعطيل الزر + تغيير نصّه («جاري التوليد...») أو نبضة/سبينر مؤقتة، بدون قفل الصفحة كاملة |
| **خطأ (Error)** | `alert()` متصفح للأخطاء الحرجة أو `toast.error` للأخطاء الخفيفة — لا نمط Error State بصري داخل البطاقة نفسها في أغلب الحالات |
| **Focus/Keyboard** | `:focus-visible` موحّد بحلقة ذهبية `var(--c-gold-deco)` أو `box-shadow: var(--focus-ring)` أخضر — طبقة "تلميع عالمي" بخصوصية CSS صفر (`:where()`) تضبط هذا على كل عنصر تفاعلي دفعة واحدة |
| **إمكانية الوصول (Reduced Motion)** | `prefers-reduced-motion: reduce` يُلغي كل الحركة/الانزلاق عبر قاعدة عالمية واحدة |

---

## 5. هيكلة الشاشات (Screen Blueprints)

### 5.1 صفحة الهبوط (Landing Page)

**الملف:** `web/landing.html` (1029 سطراً) — مستقلة تماماً خارج الموجّه الداخلي؛ أزرارها الداخلية تُحيل إلى `./index.html`، `./privacy.html`، `./terms.html`. **تستخدم نظام الألوان المنفصل الموثّق في القسم 2.**

**الترتيب الهرمي الكامل من أعلى الصفحة لأسفلها:**

1. **شريط تقدّم القراءة** (`#progress`) — شريط رفيع ثابت أعلى الصفحة يمتلئ حسب نسبة التمرير (`aria-hidden`، زخرفي/وظيفي).
2. **الشريط العلوي للتواصل** — نص إعلاني (تسليم 24-48 ساعة + تقرير بنكي/Excel/توصية GO-REVISE-NO-GO)، رابط واتساب سريع (أيقونة `i-wa`)، رابط الخصوصية. خلفية `--green-800`؛ يختفي بالكامل تحت 620px.
3. **الرأس/شريط التنقّل** — شعار (مربع تدرّج أخضر بحرف «ق»)، قائمة تنقّل داخلية بروابط تمريرية (`#why`, `#deliverable`, `#how`, `#compare`, `#pricing`, `#faq`)، زر ثانوي «تقرير نموذجي»، زر أساسي «ابدأ دراستك». هيدر `sticky` بخلفية زجاجية شفافة يكتسب حدّاً وظلاً عند التمرير (`.scrolled`). يختفي تحت 980px لصالح تصميم مبسّط + زر واتساب عائم.
4. **Hero** — شارة eyebrow، عنوان H1 بجزء نص مظلّل ذهبي (`span.hl`)، فقرة تعريفية، زرا CTA («ابدأ دراستك الآن» / «شاهد تقريراً نموذجياً» بأيقونة `i-eye`)، شبكة «حقائق سريعة» (4 بطاقات: تسليم 24-48h / توقعات 5 سنوات / PDF+Excel / GO-NO-GO)، **بطاقة تقرير بصرية توضيحية** (شريط نافذة مزيّف بثلاث نقاط ملوّنة، عنوان «ملخص قرار استثماري» + شارة REVISE، شبكة 4 KPI، رسم أعمدة صغير متحرك، تذييل «مثال توضيحي»). خلفية داكنة (تدرّج أخضر 900→700) بعكس بقية الصفحة البيضاء.
5. **شريط الإثبات الصادق** — 3 عناصر (`i-target`/`i-eye`/`i-shield`) مفصولة بخط عمودي، خلفية نعناعية فاتحة.
6. **قسم المشكلة (Problem)** — رأس قياسي + قائمة 4 بطاقات (`i-alert`) لمشاكل شائعة.
7. **لماذا قرار — التمايز** (`#why`) — خلفية داكنة (`.band`)، شبكة 4 أعمدة (شفاف/متخصص/سريع/محلي)، سعر ديناميكي مُدرَج من `pricing.js`.
8. **المخرجات** (`#deliverable`) — عمود نصي (قائمة تحقق 5 عناصر) + بطاقة نموذج مخرجات (7 صفوف بيانات مثال).
9. **المنهجية والشفافية** (`#method`) — بطاقة «درجة المدقق» (82/100، شريط متحرك عبر IntersectionObserver، 6 وسوم تقييم) + قائمة 4 عناصر منهجية.
10. **آلية العمل** (`#how`) — شبكة 4 خطوات مرقّمة.
11. **المقارنة الصادقة** (`#compare`) — خلفية داكنة، جدول مقارنة قابل للتمرير أفقياً (منصة قرار مقابل مكتب تقليدي)، 7 صفوف معايير.
12. **التسعير** (`#pricing`) — 3 بطاقات: **ذاتي (249 ﷼)**، **مراجَع بخبير (990 ﷼ — بطاقة مميّزة `.featured`)**، **خدمة كاملة (2,900 ﷼)**. الأسعار fallback في HTML، تُستبدل ديناميكياً من `pricing.js`.
13. **الأسئلة الشائعة** (`#faq`) — أكورديون 6 عناصر `<details>`.
14. **الدعوة الختامية** — خلفية داكنة متدرّجة، زرا CTA.
15. **التذييل** — شعار + وصف، روابط، حقوق نشر بسنة ديناميكية + تنويه قانوني.
16. **عناصر عابرة:** زر واتساب عائم (جوّال فقط)، مكتبة أيقونات SVG مضمّنة، سكربتات (بناء روابط واتساب من `/whatsapp-config.js`، شريط التقدّم، `IntersectionObserver` للكشف اللطيف، مزامنة الأسعار من `pricing.js`).

### 5.2 هيكل التطبيق (App Shell)

**الملفات:** `web/index.html` (272 سطراً) + `web/js/ui/Sidebar.js` (644 سطراً)

القالب الثابت الذي يلف كل شاشات SPA: هيدر علوي + شريط جانبي (**مُعطّل فعلياً — انظر القسم 7**) + حاوية محتوى رئيسية واحدة (`#wizardContainer`) تستضيف بالتبادل إما `DashboardView` أو خطوة المعالج النشطة + مجموعة Modals كحاويات DOM فارغة تُملأ من JS.

| القسم | المكونات | ملاحظة |
|---|---|---|
| **الهيدر العلوي** (`#appHeader`) | شعار (`i-bolt`)، `#headerStageBar.stage-bar` (رقاقات مراحل)، مبدّل مظهر (`i-moon`/`i-sun`/`i-auto`)، زر حفظ (`i-save`)، زر تصدير (`i-download`) | يُبنى ديناميكياً بـ `renderHeaderStageBar()` من `app.js`؛ يختفي بالكامل تحت 768px |
| **الهيدر المحمول** (`.mobile-header`) | زر فتح سايدبار، همبرغر SVG، شعار مصغّر، `#mobileStageIndicator` («اسم القسم · رقم/إجمالي») | يعوّض اختفاء الهيدر الرئيسي على الجوّال |
| **السايدبار** (`aside#mainSidebar`) | شعار، مبدّل مظهر ثانٍ، `#stepperNav` (يُملأ من `Sidebar.js`)، أزرار حفظ/تحميل/استيراد/تصدير، جملة توافق بنكي | ⚠️ **`enterWorkspaceMode()` يخفيه فعلياً (`display:none`) في وضع العمل** |
| **محتوى Sidebar.js** | `.sidebar-status` (3 صفوف: نتيجة الفكرة، نسبة الاكتمال)، `.mode-toggle-widget` (أساسي/متقدم)، `.nav-section.studies-section`، أقسام أكورديون لكل `SIDEBAR_SECTIONS` | منطق أكورديون: قسم رئيسي واحد مفتوح + قسم «الدراسات» مستقل |
| **Main Stage** | `main.main-stage`، `#breadcrumbBar` (مخفي افتراضياً)، `#wizardContainer` | الهدف الفعلي لرابط التخطي `a.skip-link` |
| **مكتبة الأيقونات** | `<svg>` مضمّن أعلى `body` — 28 رمز `<symbol>` | نفس عائلة أيقونات landing.html (24×24، stroke 1.75) |
| **Modals مباشرة في index.html** | `#exportMenuOverlay`, `#shareStudyOverlay`, `#consultationModalOverlay`, `#authModalContainer` (حاويات فارغة) + `dialog#aiSettingsModal` (محتوى كامل جاهز، «كيف يُولَّد المحتوى؟») | ⚠️ زرّا إغلاق `dialog#aiSettingsModal` يستخدمان `onclick=""` inline رغم تعليق الكود بعدم وجود inline scripts — يستحق تحققاً من CSP |
| **الزر العائم** | `#btnFabExport.fab-export` (`i-download`، 22px) | خارج `.app-shell`؛ المدخل العملي الوحيد للتصدير على سطح المكتب مع تعطيل السايدبار |

### 5.3 الصفحة الرئيسية / مساحة العمل (DashboardView)

**الملف:** `web/js/ui/DashboardView.js` — **ليست خطوة ضمن مسار المعالج**؛ الشاشة الافتراضية عند فتح التطبيق.

| القسم | المكونات |
|---|---|
| **الشريط العلوي** (`.dv-topbar`) | شعار، `ResourcesMenu` مضمّن، أزرار دخول/خروج/حسابي |
| **الهيرو** (`.qh-hero-section`) | زرا CTA («ابدأ دراستك المجانية» / «شاهد عينة تقرير»)، زر «تابع من حيث توقفت» (مشروط)، روابط ثانوية، بطاقة توضيحية (`.qh-hero-card`) بأعمدة تقدّم `.qh-bars` |
| **كيف يشتغل قرار؟** (`.qh-steps-section`) | 3 بطاقات خطوة مرقّمة |
| **مخرجات صادقة** (`.qh-trust-section`) | شبكة 3 عناصر ثقة |
| **مساحة العمل** (`.dv-workspace`) | تنقل جانبي 3 تبويبات (role=tablist) مع عدّاد رقمي لكل تبويب |
| ↳ تبويب «دراساتك» | شريط أدوات (فلترة/بحث)، `renderQualityStrip`، شبكة بطاقات مشاريع (`.dv-projects` — شارات سحابي/محلي/مشترك + شريط جودة مصغّر)، حالة فارغة بنسختين |
| ↳ تبويب «الأدوات والمحرّكات» | بحث حي، أقسام `details/summary` قابلة للطي لكل `SIDEBAR_SECTIONS` (اختصار كامل لخطوات المعالج الـ42)، شريط أدوات سريعة |
| ↳ تبويب «أدوات مساندة للدراسة» | بحث حي، 7 مجموعات (جمع بيانات، مصادر بيانات، سوق ومنافسة، تحليل مالي، تخطيط وتشغيل، تحقق وجودة، إخراج وتقديم) |
| **سطر الثقة السفلي** (`.dv-trustline`) | روابط نصية صغيرة (توافق بنكي، ضمان استرداد، نموذج تقرير) |
| **مودالات ملحقة** | `FundingSimulator` Modal، `FounderCardGenerator` Root، Onboarding overlay (3 خطوات، مرة واحدة) |

> ملاحظة: `#sensitivity-widget-root` موجود في DOM لكنه `hidden` — كود ميت جزئياً (`SensitivityWidget` غير مُركَّب).

### 5.4 لوحة القرار الاستثماري (DecisionDashboard) — «غرفة القرار»

**الملف:** `web/js/ui/DecisionDashboard.js` — أثقل شاشة في التطبيق (~1180 سطر). **خطوة STEPS رقم 38** (`id: decisionDashboard`، متقدمة). **الشاشة الأهم في «التقرير النهائي»** — الحكم النهائي + بوابة الجودة + بوابة التمويل + اختبار الضغط.

| القسم | المكونات |
|---|---|
| حالة «لا بيانات» بديلة | alert بقائمة الخطوات الناقصة (يمنع حكماً مضللاً) |
| تنبيهات أعلى الصفحة | أفضل الممارسات + تحذير جودة استثمار + `renderFinancingGate` (فجوة تمويل/DSCR/EBITDA) |
| **`.dd-verdict` (المحوري)** | عداد دائري SVG 168px + عنوان توصية (شارات نجاح/تحذير/خطر) + شريط أزرار (ملخص تنفيذي، عرض تقديمي، رابط مستثمر، إعادة حساب، نسخ احتياطي) |
| لماذا هذا القرار / خطواتك التالية | بطاقة زجاجية بعمودين (أسباب + خطوات علاجية) |
| **DecisionExplainer** («ما الرقم الذي كسر الدراسة؟») | بطاقة حالة + قائمة `issues` (عنوان + tooltip + شرح + اسم خطوة + إجراء) |
| بطاقات QA Gate | أخطاء حرجة / تحذيرات / أخطاء بيانات / اجتياز نظيف (البانر الأخضر يظهر فقط عند غياب الاثنين معاً) |
| تفاصيل التقييم | `.dd-scores` — قائمة معايير بشريط لوني موجب/سالب |
| العمود الأيسر | 6 بطاقات KPI (NPV/IRR/استرداد/ROI/فجوة تمويل/DSCR) + «ماذا لو؟» (منزلقان حيّان) + جاهزية 8 أبعاد |
| العمود الأيمن | جدول سيناريوهات (متشائم/أساسي/متفائل) + شروط النجاح الحرجة |
| شريط الإجراءات الختامي | أفعال رئيسية (حفظ، بنكي، إكسل) + قائمة «المزيد» (استشارة، عرض مستثمر، Pitch Deck) |

### 5.5 لوحة التحكم المالي (FinancialDashboard)

**الملف:** `web/js/ui/FinancialDashboard.js` — **خطوة STEPS رقم 41** (`id: dashboard`). أثقل لوحة بيانياً.

بانر قرار ثلاثي (مبدّل عرض مبسّط/كامل) → عرض مبسّط اختياري (3 بطاقات بلا مصطلحات) → `ScenarioSwitcher` مضمّن → لوحة KPI موحّدة (6 بطاقات) → تدفق نقدي سنوي (Chart.js) → لوحة توقعات 5-7 سنوات (وضعان) → لوحة الأداء → شبكة مؤشرات كاملة (تُخفى في المبسّط) → مؤشرات القرار والجدارة التمويلية → نظرة المدقق → **المستشار الذكي** (رؤى + شريط نسب COGS/Labor/Rent + «اسأل عن رقمك» + اقتراحات تحسين + `BenchmarkingView` مضمّن) → ملخص CAPEX/OPEX → توطين مالي (اختياري) → قائمة الدخل الكاملة (5 سنوات) → تحليل الإيرادات وصافي الربح (رسم قابل للتبديل).

### 5.6 الملخص التنفيذي (ExecutiveSummary)

**الملف:** `web/js/ui/ExecutiveSummary.js` — **يُستخدم مرتين حرفياً بنفس المحتوى بالضبط:** خطوة 27 (`financial_eval`، «نظرة مبكرة») وخطوة 39 (`executiveSummary`، «الملخص التنفيذي النهائي»)، بالإضافة لمودال يُفتح من `DecisionDashboard`.

⚠️ لا يزال يستخدم عنوان بإيموجي `📋` (لم يُوحَّد بعد لنظام SVG المستخدم في `DecisionDashboard`/`DashboardView`).

تحذيرات أعلى الصفحة → درجة الجدوى (`score-circle` + `breakdown-bar`) → نظرة عامة قابلة للتحرير (AI) → الفرضية ولماذا سنربح (اختياري) → أبرز نقاط الاستثمار (5 بطاقات بإيموجي 💰📈📊⏱️💹) → المخاطر الرئيسية (🔴🟡) → الحلول المقترحة → التوصية النهائية (✅❌⚠️) → مقارنة بمعايير الصناعة (هامش ربح فقط مكتمل، الباقي `—` عمداً).

### 5.7 بناء التقرير (ReportBuilderView)

**الملف:** `web/js/ui/ReportBuilderView.js` — **خطوة STEPS رقم 40** (`id: reportBuilder`). شريط مساعد كتابة AI (5 أزرار سريعة) + معاينة ناتج AI + **شبكة 24 بطاقة قسم قابلة للسحب والإفلات** (`draggable=true`، مقبض `⋮⋮`) لإعادة ترتيب التقرير المُصدَّر فعلياً.

### 5.8 العرض التقديمي (PresentationView) — Pitch Deck

**الملف:** `web/js/ui/PresentationView.js` — نافذة overlay ملء الشاشة (لا رقم خطوة STEPS)، تُستدعى من أزرار متعددة. إطار (زر خروج، عداد شرائح، تنقّل ↔، تحكم لوحة مفاتيح) + **8 شرائح:** (1) العنوان، (2) المشكلة والحل (split أحمر/أخضر)، (3) حجم السوق (أعمدة TAM/SAM/SOM)، (4) أبرز المؤشرات المالية، (5) الفريق والتنفيذ، (6) المخاطر الرئيسية، (7) التمويل المطلوب (رقم ضخم نابض)، (8) دعوة ختامية.

### 5.9 النوافذ المنبثقة (Modals) — جرد كامل

10 نوافذ منبثقة فعلية في المشروع، جميعها فوق النمط الأساسي في القسم 4.6:

| # | النافذة | الغرض | مصدر الفتح |
|---|---|---|---|
| 1 | **المستشار الذكي (AI Chat)** | دردشة مع مساعد قواعد محلي (SWOT/ملخص/مخاطر/سيناريو ضغط)، ردود streaming حرفاً بحرف | زر FAB عائم دائم (🤖) |
| 2 | **حجز استشارة** | ملخص دراسة + رابط حجز Zoom (قابل للتعديل) | `ConsultationModal.js` |
| 3 | **قفل الترقية (Paywall)** | 3 باقات + دفع مباشر (Moyasar/Stripe) أو واتساب | عند تصدير صيغة مدفوعة |
| 4 | **تعيين كلمة مرور جديدة** | بعد حدث `PASSWORD_RECOVERY` من Supabase | رابط بريد استعادة كلمة المرور |
| 5 | **سياسة الاسترداد** | نص ضمان الاسترداد | `RefundPolicyModal.js` |
| 6 | **عينة تقرير** | مقارنة جودة + تحميل PDF فعلي | `SampleReportModal.js` |
| 7 | **المصادقة الثنائية (2FA)** | تفعيل/إدارة TOTP عبر Supabase MFA (وضعا تسجيل/إدارة) | `TwoFactorModal.js` |
| 8 | **دخول/تسجيل (AuthModal)** | دخول، OAuth Google، استعادة كلمة مرور، تحدي 2FA (AAL2) | `AuthModalStub.js` |
| 9 | **قائمة التصدير الموحدة** | ~24 بطاقة تصدير + بوابة QA Gate + بوابة Paywall | `#headerExportMenu` / FAB |
| 10 | **معرض القوالب** | نقطة بداية كل دراسة (فارغ/قوالب مختصين/مسودات) | عند إنشاء دراسة جديدة |

### 5.10 لوحة المستثمر وشاشات المشاركة

| الشاشة | الملف | الوصف |
|---|---|---|
| **لوحة المستثمر (InvestorDashboard)** | `web/js/ui/InvestorDashboard.js` + `web/investor.html` | عرض احترافي للقراءة فقط (LivePlan-style): هيرو + فرصة سوقية (TAM/SAM/SOM) + أداء مالي (4 KPI) + فريق ومطلوب تمويل + فوتر CONFIDENTIAL. نقطة دخول standalone منفصلة |
| **نافذة مشاركة الدراسة** | `web/js/ui/ShareStudyView.js` | مودال: دعوة عضو (صلاحية محرر/مشاهد، مذكّرة محلية غير مفعّلة فعلياً)، رابط قراءة فقط + QR (**معطّل عمداً** — الرابط لا يعمل عبر الأجهزة بعد)، مشاركة بريد |
| **ShareView (نمط بديل)** | `web/js/ui/ShareView.js` | Pitch Deck فاتح الألوان بديل — غلاف + مشكلة/حل + سوق + مؤشرات؛ تصميم موازٍ أقدم لـ InvestorDashboard |

### 5.11 الصفحات الثابتة

| الصفحة | الملف | البنية |
|---|---|---|
| **الخصوصية** | `web/privacy.html` | هيدر (عنوان + تاريخ تحديث + زر عودة) + 7 بطاقات `.card` مرقّمة متتالية |
| **الشروط والأحكام** | `web/terms.html` | نفس بنية HTML حرفياً + 10 بطاقات `.card` (تعريفات، الخدمة، المسؤولية، الدفع/VAT، الملكية الفكرية، الاستخدام، حدود المسؤولية، التعديلات، الاختصاص القضائي، التواصل) |

### 5.12 كود موجود لكن غير حي حالياً (للعلم — لا يُبنى في فيغما إلا بقرار صريح)

- **`web/js/ui/results.js`** — دالة `renderResults` كاملة (KPI + قائمة دخل + تدفقات) لكن **لا استيراد لها في أي مكان بالمشروع** — كود ميت بالكامل، نمط تصميم أقدم (ألوان hex مباشرة لا توكنات).
- **`web/js/ui/Charts.js`** — غلاف Chart.js غير مستخدَم؛ يبدو مُستبدَلاً بـ `ReviewCharts.js`.
- **`SensitivityWidget`** (`widgets/SensitivityWidget.js`) — مستورَد في `DashboardView.js` لكن غير مُركَّب فعلياً (`#sensitivity-widget-root` مخفي في DOM).

---

## 6. جدول معالج الخطوات الكامل (42 خطوة)

مصدر البيانات: `web/js/core/wizardSteps.js` + خريطة التوجيه الفعلية في `web/app.js` (سلسلة `if/else` تفحص `step.isXxx`). **البنية المشتركة لكل خطوة** (راجع القسم 5.2/4.14 للتفاصيل البصرية): شريط مراحل الهيدر + مؤشر 3 مراحل كبرى دائري + شريط تقدّم بالنسبة% ووقت متبقٍ + عنوان الخطوة + زر «كيف أملأ هذه الخطوة؟» + محتوى الخطوة (View مخصص أو نموذج عام تلقائي من `Wizard.js`) + شريط `.wizard-nav` موحّد (سابق/تالي) يُلحَق دائماً حتى لو رسم المكوّن شريطه الخاص.

**3 مراحل كبرى (MAJOR_PHASES):** ١) التقييم والسوق (خطوات 0-11) → ٢) البناء الفني والمالي (12-28) → ٣) المخاطر والقرار (29-41).

| # | المعرّف (id) | التسمية | ملف الشاشة (View) | نوع المكوّن |
|---|---|---|---|---|
| 0 | `preliminaryCheck` | الدراسة المبدئية (اختيارية) | `PreliminaryCheckView.js` | مخصّص — أسئلة ثلاثية + بطاقة نتيجة فورية ملوّنة |
| 1 | `projectAlternatives` | اختيار المشروع (مقارنة أفكار) | `ProjectAlternativesView.js` | مخصّص — جدول مقارنة يدوي بترشيح تلقائي |
| 2 | `projectInfo` | معلومات المشروع ونموذج العمل | *(بلا View — نموذج عام)* | عام — `Wizard.js::renderStep()` |
| 3 | `projectDetails` | تفاصيل الفكرة (المنتجات والخدمات) | *(بلا View — نموذج عام)* | عام — 3 جداول `DynamicTable` |
| 4 | `keyPeople` | الأشخاص الرئيسون | *(بلا View — نموذج عام)* | عام — جدولان `DynamicTable` |
| 5 | `projectIntro` | مقدمة الجدوى الموحدة | `IntroductionView.js` | مخصّص — أكبر خطوة من حيث عدد اللوحات |
| 6 | `smartGoals` | الأهداف الذكية | `SmartGoals.js` | مخصّص — بطاقات SMART بلا جدول |
| 7 | `marketing` | الدراسة السوقية | *(بلا View — نموذج عام)* | عام — 4 جداول `DynamicTable` |
| 8 | `marketSizing` | تحجيم السوق (TAM/SAM/SOM) | `MarketAnalysis.js` | مخصّص — دوائر متداخلة + بيانات GASTAT |
| 9 | `strategic` | التحليل الاستراتيجي | `StrategicAnalysis.js` | مخصّص — PESTEL + SWOT + TOWS + بورتر |
| 10 | `revenue` | مصادر الإيرادات | *(بلا View — نموذج عام)* | عام — جدول واحد فقط |
| 11 | `services` | تحليل الخدمات المفصل | `ServiceAnalysis.js` | مخصّص — يستدعي محرك NPV/IRR لكل خدمة |
| 12 | `technical` | الدراسة الفنية (الأصول) | *(بلا View — نموذج عام)* | عام — 6 جداول `DynamicTable` |
| 13 | `hr` | الموارد البشرية (الرواتب) | *(بلا View — نموذج عام)* | عام — جدول `positions` + Smart Fill |
| 14 | `techResources` | الموارد التقنية | *(بلا View — نموذج عام)* | عام — جدول واحد فقط |
| 15 | `logistics` | الموارد اللوجستية | *(بلا View — نموذج عام)* | عام — جدول واحد فقط |
| 16 | `administrative` | الموارد الإدارية | *(بلا View — نموذج عام)* | عام — جدول واحد (صف افتراضي «إيجار») |
| 17 | `orgStructure` | الهيكل التنظيمي والحوكمة | `OrgStructure.js` | مخصّص — مخطط شجري + جداول يدوية |
| 18 | `operational_sim` | محاكاة التشغيل (صفوف الانتظار) | `OperationalSim.js` | مخصّص — Erlang-C + محاكاة Canvas |
| 19 | `legal` | الدراسة القانونية | `LegalStudy.js` | مخصّص — شكل قانوني + جدول تراخيص |
| 20 | `financing` | مصادر وهيكلة التمويل | `FinancingStructure.js` | مخصّص — Chart دائري + حاسبة WACC |
| 21 | `investor_analysis` | تحليل الجدوى الاستثمارية | `InvestorAnalysis.js` | مخصّص — عداد دائري «الجاذبية الاستثمارية» |
| 22 | `assumptions` | الافتراضات المالية | *(بلا View — نموذج عام)* | عام — الوحيدة بلا أي علم `isXxx` |
| 23 | `financialStatements` | القوائم المالية التقديرية | `FinancialStatements.js` | مخصّص — قائمة دخل + تدفقات + ميزانية افتتاحية |
| 24 | `balance_sheet` | الميزانية العمومية | `BalanceSheetView.js` | مخصّص — مبدّل سنوات + شارة فحص توازن |
| 25 | `breakEven` | تحليل نقطة التعادل | `BreakEvenAnalysis.js` | مخصّص — Chart خطي |
| 26 | `financial_eval` | مؤشرات التقييم المالي (نظرة مبكرة) | `ExecutiveSummary.js` | **نفس مكوّن خطوة 39 حرفياً** |
| 27 | `zakatTax` | حساب الزكاة والضريبة | `ZakatView.js` | مخصّص — جدول إسقاطات سنوي |
| 28 | `valuation` | تقييم الشركة | `ValuationAnalysis.js` | مخصّص — DCF + مضاعف EBITDA + Pre/Post-money |
| 29 | `riskAnalysis` | تحليل المخاطر | `RiskMatrix.js` | مخصّص — مصفوفة 3×3 + سجل 13 عموداً |
| 30 | `stress_test` | اختبار التحمل | `StressTest.js` | مخصّص — 3 سيناريوهات جاهزة + Runway حي |
| 31 | `sensitivity` | تحليل الحساسية | `SensitivityAnalysis.js` | مخصّص — مصفوفة تأثير ±20% |
| 32 | `scenarios` | مستويات السيناريوهات | `ScenarioAnalysis.js` | مخصّص — 3 بطاقات قابلة للتحرير |
| 33 | `monteCarlo` | محاكاة مونت كارلو | `MonteCarloAnalysis.js` | مخصّص — 1000 تكرار + مدرّج تكراري |
| 34 | `timeline` | الجدول الزمني للتنفيذ | `Timeline.js` | مخصّص — `TimelineChart` سحب-وإفلات |
| 35 | `appendices` | الملاحق والمصادر والمراجع | `AppendicesView.js` | مخصّص — جدولان `DynamicTable` |
| 36 | `businessModel` | نموذج العمل | `BusinessModelView.js` | مخصّص — Canvas 9 بطاقات |
| 37 | `decisionDashboard` | لوحة القرار الاستثماري | `DecisionDashboard.js` | مخصّص — **راجع القسم 5.4** |
| 38 | `executiveSummary` | الملخص التنفيذي النهائي | `ExecutiveSummary.js` | **نفس مكوّن خطوة 26 حرفياً** |
| 39 | `reportBuilder` | بناء التقرير (ترتيب الأقسام) | `ReportBuilderView.js` | مخصّص — سحب-وإفلات 24 بطاقة |
| 40 | `dashboard` | لوحة التحكم المالي العامة | `FinancialDashboard.js` | مخصّص — **راجع القسم 5.5** |
| 41 | `actuals` | مراقبة الأداء الفعلي (اختيارية بالكامل) | `PostLaunchTracker.js` | مخصّص — جدول إدخال شهري + انحرافات |

> **ملاحظة تسمية:** الجدول أعلاه 42 صفاً (ترقيم من 0)؛ الرقم "44" المذكور في طلب المستخدم الأصلي يقارب العدد الإجمالي الفعلي بحساب مختلف (مع/بدون خطوات معينة حسب وضع العرض السريع/المتقدم) — اعتمد هذا الجدول كمرجع دقيق نهائي.

---

## 7. ملاحظات هامة للمصمم

نقاط تستحق قراراً واعياً (توحيد أو إبقاء كما هو) قبل/أثناء بناء مكتبة فيغما — كلها موثّقة من قراءة الكود الفعلي وليست افتراضات:

1. ~~**نظاما ألوان منفصلان (الأهم):**~~ **[مُوحَّد 2026-07-14]** كان `variables.css` (التطبيق) يتعارض حرفياً مع `<style>` داخل `landing.html` (التسويق): أخضر التطبيق `#0e5b44` ≠ أخضر الهبوط `#0b6b4f`. القرار: توحيد على قيمة التطبيق `#0e5b44` (لأن لها نظام فاتح/داكن كامل موثّق في القسمين 1 و2، بخلاف قيمة الهبوط الثابتة). `--green-700` في landing.html أصبح alias مباشر لـ`--c-p-500`، وبقايا الـhex الصريح (favicon، `theme-color` meta، `web/css/tool-report.css`) صُححت لنفس القيمة. لا تعارض متبقٍّ في الكود.

2. **السايدبار مُعطّل فعلياً في وضع العمل:** `Sidebar.js` كامل (بأزراره وقائمته وشعاره) موجود في DOM ومُبنى بالكامل من JS، لكن `enterWorkspaceMode()` في `app.js` يضبط `display: none` عليه صراحة كلما دخل المستخدم أي دراسة. **التنقّل الفعلي الوحيد هو شريط المراحل في الهيدر + أزرار سابق/تالي.** لا تبنِ فيغما افتراض أن السايدبار جزء من تجربة الاستخدام الفعلية أثناء العمل على دراسة — إلا إذا كان الهدف توثيق كود موجود لا تجربة مستخدم حية.

3. **إيموجي متبقٍّ لم يُوحَّد بعد لنظام SVG:** `DecisionDashboard.js` و`FinancialDashboard.js` وُحِّدا بالكامل لأيقونات `<svg class="ic"><use href="#i-..."/></svg>` (تدقيق موثّق في تعليقات الكود)، لكن `ExecutiveSummary.js` و`PresentationView.js` و`results.js` ما زالت تستخدم إيموجي خام (📋💰📈📊⏱️💹🔴🟡✅❌⚠️🚀📧📅) — نقطة عدم اتساق بصري واضحة عبر شاشات "التقرير النهائي" نفسها.

4. **`i-check`/`i-x` بتصميمين مختلفين** بين مكتبتي الأيقونات (دائرة محيطة في `index.html` مقابل علامة مجردة في `landing.html`) — وحّدهما إلى مكوّن Icon واحد في فيغما.

5. **مكوّنات مُعرَّفة في الكود لكن غير حيّة حالياً:** `results.js` (ميت بالكامل)، `Charts.js` (يتيم، استُبدل بـ `ReviewCharts.js`)، `SensitivityWidget` (مستورَد لكن غير مُركَّب). لا تُدرَج كشاشات "حالية" إلا بوسم صريح "غير نشط".

6. **الملخص التنفيذي يظهر مرتين حرفياً بنفس المكوّن** (خطوة 27 «نظرة مبكرة» وخطوة 39 «الملخص التنفيذي النهائي») — نفس الملف، نفس الأقسام تماماً، بفارق ~12 خطوة في رحلة المستخدم. قرار تصميم يستحق مراجعة (هل يُبقى التكرار أم يُدمَج؟).

7. **جداول بيانات "ميتة بصمت":** بعض مفاتيح `tables` في `wizardSteps.js` (مثل `marketAnalysis`, `marketingPlan`, `capacityUtilization`, `advisoryBoard` في قسم HR) لا تملك تعريف عمود مطابق في `TABLE_SCHEMAS` — حاوياتها تبقى فارغة بصمت في الواجهة (`console.warn` فقط). عند بناء فيغما لهذه الخطوات، لا ترسم جدولاً لهذه المفاتيح لأنه لا يظهر فعلياً للمستخدم.

8. **ثلاثة أنظمة توكنات جزئية للألوان** (وليس اثنين فقط): (أ) `variables.css` للتطبيق، (ب) `<style>` في `landing.html`، (ج) `--qh-*` في `dashboard-home.css` (هيرو الصفحة الرئيسية، بنمط شبيه بـ(ب) لكن *مع* وضع داكن ومُدمَج داخل التطبيق). راجع القسم 2.4.

9. **ازدواجية تعريف خلفية وضع العرض التقديمي:** `#presentationOverlay` يُعرَّف بخلفية `var(--grad-emerald)` في `decision-dashboard.css` ثم يُعاد تعريفها بخلفية مختلفة تماماً (`#1f2937 → #000`) في `ai.css` — سلوك آخر تعريف يفوز يعتمد على ترتيب تحميل CSS، غير موثّق كقرار مقصود.

---

## 8. فهرس الملفات المصدر

للرجوع المباشر عند الحاجة لتفصيل أدق مما ورد أعلاه:

**CSS (نظام التصميم والمكونات):**
`web/css/variables.css` · `web/css/main.css` · `web/css/layout.css` · `web/css/components.css` · `web/css/utilities.css` · `web/css/animations.css` · `web/css/wizard-forms.css` · `web/css/wizard-inline.css` · `web/css/onboarding-polish.css` · `web/css/polish.css` · `web/css/simple-mode.css` · `web/css/decision-dashboard.css` · `web/css/investor.css` · `web/css/dashboard-home.css` · `web/css/scenario-switcher.css` · `web/css/timeline.css` · `web/css/ai.css` · `web/css/chrome-declutter.css` · `web/css/toast.css` · `web/css/tooltip.css`

**نقاط الدخول HTML:**
`web/index.html` · `web/landing.html` · `web/investor.html` · `web/privacy.html` · `web/terms.html`

**منطق التوجيه وتعريف الخطوات:**
`web/app.js` (خريطة `navigateTo()`) · `web/js/core/wizardSteps.js` · `web/js/ui/Wizard.js` · `web/js/core/schema.js`

**مكونات الشاشات الرئيسية (`web/js/ui/`):**
جميع الملفات الـ 70+ تحت هذا المجلد؛ الأهم المذكورة بالتفصيل أعلاه: `DashboardView.js` · `DecisionDashboard.js` · `FinancialDashboard.js` · `ExecutiveSummary.js` · `ReportBuilderView.js` · `PresentationView.js` · `Sidebar.js` · `Wizard.js` · `DynamicTable.js` · `InvestorDashboard.js` · `ShareStudyView.js` · `ShareView.js` · وكل ملفات `web/js/ui/{AIChatModal,ConsultationModal,PaywallModal,NewPasswordModal,RefundPolicyModal,SampleReportModal,TwoFactorModal,AuthModalStub,ExportMenu,TemplateGallery}.js` (النوافذ المنبثقة) و`web/js/ui/widgets/*.js` + `web/js/ui/components/FieldHelp.js` (الودجت).

---

*مستند مُولَّد بقراءة مباشرة للكود المصدري بتاريخ 2026-07-09. أي تحديث مستقبلي على الكود (خصوصاً `variables.css` أو `landing.html`) يستوجب إعادة تشغيل عملية الاستخراج لإبقاء هذا المستند مطابقاً 100% للواقع.*
