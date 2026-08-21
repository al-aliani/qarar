# ملف تسليم للمبرمج/الأداة البرمجية التالية — منصة «قرار» (sahib.sa)

> **الغرض:** سواء كنت مبرمجاً بشرياً جديداً على المشروع أو أداة AI مختلفة (Cursor / Windsurf / Copilot / غيرها)، هذا الملف يعطيك السياق اللي تحتاجه بدل ما تكتشفه من الصفر. اقرأه قبل أي تعديل.
> آخر تحديث: 2026-08-21.

## 0) البداية السريعة (Getting Started)

```bash
git clone https://github.com/al-aliani/qarar.git
cd qarar
npm install
cp .env.example .env   # عبّي VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY (من لوحة Supabase → Project Settings → API)
npm run dev            # يفتح على http://localhost:5173
npm test                # 1784/1784 يجب أن تمر خضراء قبل أي commit (تحقَّق 2026-08-21)
```

**قواعد الدمج (من `CONTRIBUTING.md`) — مهم تعرفها قبل أول push:**
- **يُمنع الـ push المباشر لفرع `main`.** كل ميزة/إصلاح في فرع `feature/` أو `fix/` منفصل، ثم Pull Request.
- CI (`.github/workflows/ci.yml`) يشغّل Lint + Vitest؛ فشل أي اختبار مالي يحجب الـ Merge تلقائياً.
- عند الدمج في `main`، ورشتا `supabase-functions-deploy.yml` و`supabase-migrations.yml` تنشران Edge Functions/الترحيلات تلقائياً، والفرونت‌إند ينشر عبر Vercel.
- هوية git المحلية لهذا المستودع مضبوطة على `al-aliani` (وليست الهوية العامة على هذا الجهاز) — لا تغيّرها، فهذا كان سبب حجب نشر فعلي سابقاً (راجع §4).

---

## 1) الفكرة في جملة

**قرار** — منصة SaaS عربية (RTL) تحوّل بيانات مشروع استثماري في السعودية إلى **قرار GO/NO-GO/REVISE** مبني على نموذج مالي محسوب برمجياً (NPV/IRR/Payback/DSCR + حساسية + مخاطر)، وليس مجرد "جداول". القطاع المرجعي الأعمق هو **مطاعم السعودية**، مع دعم فعلي (محرك عام + معايير قطاعية) لخمسة قطاعات مساندة: تجزئة، خدمات مهنية، تصنيع، لوجستيات، SaaS.

المرجع الكامل للرؤية والنطاق ومصطلحات المنتج: **[PRODUCT_CONSTITUTION.md](PRODUCT_CONSTITUTION.md)** — اقرأه قبل أي قرار منتج (نطاق، تسعير، ما هو داخل/خارج النطاق).
مرجع نظام التصميم الكامل (ألوان/مكونات/أيقونات مستخرجة من الكود فعلياً): **[FIGMA_HANDOFF.md](FIGMA_HANDOFF.md)**.

⚠️ **لا تعتمد على مجلد `docs/` كمصدر حقيقة.** فيه ~90 ملف تقرير تراكمي من جلسات ماضية (تقييمات، خطط، تحقيقات) — أغلبها تاريخي/متجاوَز وليس حياً. المصادر الحية الوحيدة: هذا الملف + `PRODUCT_CONSTITUTION.md` + `FIGMA_HANDOFF.md`.

---

## 2) المكدس التقني (Tech Stack)

| الطبقة | التقنية |
|---|---|
| الواجهة | Vite + **JavaScript خام بدون فريمورك** (لا React/Vue) — مكوّنات يدوية في `web/js/ui/*.js` |
| التوجيه | SPA بموجّه Hash داخل `web/index.html` (لا history routing) |
| الحالة | `web/js/core/store.js` |
| المحرك المالي | `lib/calc/*.js` (Node/ESM، مختبَر بـ Vitest بمعزل عن الواجهة) + `web/js/core/engine.js` كطبقة تجميع |
| قاعدة البيانات/المصادقة | **Supabase** (Postgres + Auth + RLS) |
| الدفع | Supabase Edge Functions (`supabase/functions/`) — **التحويل البنكي اليدوي هو المفعَّل فعلياً** (قرار مالك 2026-07-22)؛ Moyasar/Stripe/Tamara مبنية ومنشورة لكن معطَّلة بالواجهة حالياً |
| المراجعة البشرية | `reviewer-queue`/`reviewer-claim`/`reviewer-submit` (باقة «مراجَع بخبير») — منشورة وحيّة (تحقَّق 2026-08-21)؛ تحتاج صفاً فعّالاً بجدول `reviewers` ليستخدمها أحد |
| المراقبة | Sentry (`VITE_SENTRY_DSN`) — مُفعَّل بالإنتاج (تحقَّق 2026-08-21) |
| التصدير | `docx`, `exceljs`, `pptxgenjs`, `chart.js`, `qrcode` |
| الاختبارات | Vitest (وحدة) + Playwright (e2e) |
| النشر | Vercel/Netlify (كلا الإعدادين موجودين: `vercel.json`, `netlify.toml`) |
| بايثون قديم | `ai_server.py` / `ai_server_enhanced.py` وملفات `*_engine.py` في الجذر — **بقايا نموذج أولي مبكر**، المنطق الحقيقي المستخدم الآن هو `lib/calc/` + `web/js/core/engine.js`. تحقق قبل التعديل هل ما زالت مستخدمة فعلياً أو ميتة. |

**التشغيل محلياً:** `npm run dev` (Vite على المنفذ 5173 — مضمّن صراحة في الكود). الاختبارات: `npm test` (vitest)، `npm run test:e2e` (playwright).

---

## 3) خريطة البنية (أين تبحث)

```
web/js/core/       منطق أعمال محايد عن الواجهة: engine.js (التجميع المالي)، wizardSteps.js (42 خطوة المعالج)،
                    schema.js، sectorBenchmarks.js (معايير القطاعات الستة)، fieldOptions.js، zakatTax.js
web/js/services/    طبقة خدمات: PersistenceService (حفظ سحابي)، ReportGenerator، InternalAIGenerator،
                    AIConnector، PaymentService، ExpertTemplateService
web/js/ui/          ~45 مكوّن واجهة (View classes)، أبرزها Wizard.js (المعالج)، DecisionDashboard.js
lib/calc/           المحرك المالي الخام: balanceSheet.js، loanSchedule.js، wacc.js، dscr.js، zakat.js،
                    monteCarloEnhanced.js، qaGate.js (بوابة جودة/تناقضات) — مختبَر بمعزل تام
supabase/functions/ Edge Functions: create-checkout، webhook-moyasar، webhook-stripe
supabase/migrations/ RLS + جداول orders/payments
web/css/            variables.css (توكنات --c-*) — نظام ألوان منفصل تماماً عن landing.html (راجع FIGMA_HANDOFF §Q)
```

**نقاط الدخول HTML الخمس (منفصلة، لا تتشارك نظام ألوان):** `web/index.html` (التطبيق)، `web/landing.html` (تسويق)، `web/investor.html` (عرض للمستثمر، قراءة فقط)، `web/privacy.html`، `web/terms.html`.

---

## 4) الحالة الحالية (ما يعمل / ما لا يعمل)

✅ **يعمل ومُختبَر:**
- المحرك المالي الكامل (NPV/IRR/Payback/DSCR/Zakat/Monte Carlo) + بوابة جودة تمنع تناقضات القرار
- المعالج الكامل (42 خطوة) لقطاع المطاعم بعمق، وقطاعات مساندة بمحرك عام
- المصادقة: تسجيل دخول/خروج، إعادة تعيين كلمة مرور، إنفاذ 2FA فعلي
- الحفظ السحابي، ونطاق موحّد (`sahib.sa`) في robots.txt/sitemap/og:url بعد تدقيق SEO (commit `c05fbfc`)
- رؤوس أمان الإنتاج كاملة: CSP بلا `unsafe-inline`، HSTS، `X-Frame-Options: DENY`، `nosniff`

🟢 **تدقيق إطلاق go/no-go (2026-07-22) — الخمسة عيوب P0 المُكتشَفة وقتها مُصلَحة ومُتحقَّق منها حيّاً.**
التقرير الأصلي في [`docs/تقرير_فحص_الإطلاق_sahib_2026-07-22.md`](docs/تقرير_فحص_الإطلاق_sahib_2026-07-22.md) (سياق تاريخي فقط، لا تثق بحالته — راجع هذا القسم بدلاً منه). خلاصة ما تحقَّق منذ ذلك التاريخ:

- **P0 الخمسة** (overflow:hidden، CORS، `study_id uuid=text`، حقن HTML، هوية git) — مُصلَحة، وmigration `20260722094000` **مؤكَّد تطبيقها على Supabase الحيّة** عبر سجلّ GitHub Actions الفعلي (لا افتراض).
- **8 أخطاء P1 المالية** (§P1 "مالية" بالتقرير) — **6/8 مُصلَحة** (تحقُّق مباشر من الكود 2026-08-21): NPV/IRR لا يخصمان رصيد قرض متبقٍّ عند نهاية الأفق، ميزانية PDF ناقصة بندين، فجوة التمويل مخفية بـExcel/Word، سيناريوهات Excel NPV=0، إهلاك يستمر بعد نفاد العمر، تجاهل نسبة استهلاك مخصَّصة — كلها مُصلَحة. **جزئي:** Word/PPTX لا يزالان يختصران مبالغ ≥ مليون في بعض المسارات (أثر منخفض، راجع تاريخ git لتفاصيل `web/export/wordExporter.js`).
- **دوال المراجعين الثلاث** (`reviewer-queue/claim/submit`) — **منشورة وحيّة** (كانت 404 لغياب خطوة نشر بالـCI فقط، لا مشكلة كود/DB). حساب أدمن أُضيف فعلياً (`public.admins`) وتحقَّقنا منه حيّاً. **تحقَّق بنفسك:** هل صفّ `public.reviewers` (`active=true`) أُضيف أيضاً؟ — شرط منفصل تماماً عن `admins`، لازم للباقة نفسها.
- **Sentry** (`VITE_SENTRY_DSN`) — مُفعَّل بالإنتاج، تحقَّق من الملف المنشور فعلياً.

✅ **اختبار الدفع الحيّ e2e نُفِّذ فعلياً وتحقَّق (2026-08-21)** — أول مرة منذ إطلاق المنتج:
[`e2e/payment_bank_transfer.spec.js`](e2e/payment_bank_transfer.spec.js) شُغِّل حياً على حساب حقيقي وأثبت المسار كاملاً يعمل: تسجيل دخول → دراسة → تحويل بنكي (`create-checkout` عبر CORS) ينشئ طلباً حقيقياً بنجاح، وجانب الأدمن (تبويب التحويلات البنكية) يفتح بلا `admin-error` (تأكيد حي لإصلاح `study_id uuid=text`، لا افتراضاً من الكود فقط). كُشفت ثلاث مشاكل بالاختبار نفسه أثناء التشغيل الأول وأُصلحت (سيلكتور غامض، وسباق `AuthGuard.currentUser` يحتاج انتظار `#dvAccountToggle` قبل أي مسار محمي — درس مفيد لأي اختبار e2e جديد يتحقق من صلاحيات بعد تسجيل دخول مباشرة).

🟡 **معطَّل بقرار مالك، لا عطل:** Moyasar/Stripe/Tamara مبنية ومنشورة (البنية كاملة، webhooks تتحقق من التوقيع فعلاً) لكن الواجهة تعرض التحويل البنكي فقط حالياً (`SubscriptionCheckoutView.js`).

⚠️ **فجوة منتج معروفة (مقصودة):** التغطية القطاعية خارج المطاعم (تجزئة/خدمي/صناعي/لوجستي/SaaS) عامة وليست بعمق المطاعم — راجع PRODUCT_CONSTITUTION.md.

---

## 5) فخاخ متكررة (لا تعيد اكتشافها)

- **`confirm()` يوافق تلقائياً في أدوات أتمتة المتصفح** (preview/browser automation) — إذا رأيت "نقرة دمّرت بيانات بصمت" تحقق من guard الـ confirm قبل افتراض أنها علة.
- **CSP بدون inline scripts** — أي كود جديد يجب أن يكون في ملفات JS منفصلة، لا `<script>` inline ولا `onclick=""`.
- **فخ وحدة الكسر (fraction-unit trap)** — حقول نسب مئوية/كسور تتكرر كخطأ شائع (تخزين 0.15 مقابل 15) عبر المولّدات، تحقق من الوحدة الفعلية قبل التعديل.
- **نظاما ألوان منفصلان**: `web/css/variables.css` (`--c-*`) مقابل `landing.html` (`--green-*`/`--gold`) — غير متزامنين، موثّق بالتفصيل في FIGMA_HANDOFF.md §3.
- **الشريط الجانبي مخفي دائماً** عبر `main.css` — التنقل الأساسي الآن هو شريط المراحل + أزرار Prev/Next داخل المعالج، ليس الشريط الجانبي القديم.

---

## 6) أولويات معلّقة (لو تكمل من هنا)

1. **تأكد أن صفّاً بجدول `public.reviewers` (`active=true`) مضاف فعلاً** — الأدمن أُضيف (`public.admins`)، لكن `reviewers` شرط منفصل ولم يتأكَّد. مثال SQL جاهز:
   ```sql
   insert into public.reviewers (id, display_name, credentials)
   select id, 'اسم المراجع', null from auth.users where email = '...';
   ```
2. Word/PPTX لا يزالان يختصران بعض المبالغ الكبيرة لـ"X.X مليون ريال" في مسارات متبقية (أثر منخفض) — راجع تاريخ git لـ`web/export/wordExporter.js`/`pptxExporter.js` إن أردت إغلاقها بالكامل.
3. عمق قطاعي أكبر للقطاعات المساندة (قرار عند وجود طلب فعلي، ليس افتراضياً)
