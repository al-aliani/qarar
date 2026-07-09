# ملف تسليم للأداة/المساعد البرمجي التالي — منصة «قرار»

> **الغرض:** إذا كنت أداة AI مختلفة (Cursor / Windsurf / Copilot / غيرها) تبدأ العمل على هذا المشروع لأول مرة، هذا الملف يعطيك السياق اللي تحتاجه بدل ما تكتشفه من الصفر. اقرأه قبل أي تعديل.
> آخر تحديث: 2026-07-09.

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
| الدفع | Supabase Edge Functions (`supabase/functions/`) — Moyasar + Stripe |
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
- المصادقة (تم إصلاحها بالكامل 2026-07-09، commit `b6eaeed`): تسجيل دخول/خروج، إعادة تعيين كلمة مرور (كانت معطوبة تماماً)، إنفاذ 2FA فعلي
- الحفظ السحابي (بعد توحيد كاتبَين متضاربين كانا يسببان فساد بيانات)

🟡 **مبني لكن غير مُختبَر حياً:**
- **الدفع (Moyasar + Stripe)**: البنية كاملة (commit `4033d5f`، 2026-07-09) لكن **بلا مفاتيح Sandbox حقيقية بعد** — لا تفترض أنه يعمل end-to-end قبل اختبار فعلي بمفاتيح تجريبية.

⚠️ **فجوات معروفة (من التدقيق الأخير):**
- التغطية القطاعية خارج المطاعم (تجزئة/خدمي/صناعي/لوجستي/SaaS) عامة وليست بعمق المطاعم — لا قوالب خبراء/تراخيص متخصصة لها بعد (قرار منتج مقصود، راجع PRODUCT_CONSTITUTION.md).

---

## 5) تعديلات غير مُلتزَمة (Uncommitted) وقت كتابة هذا الملف

**هذا مهم:** يوجد تعديل حالي في شجرة العمل (`git status` / `git diff`) لم يُعمل له commit بعد — نتيجة اختبار عميل حي كمالك مقهى (2026-07-09):

- **11 خلل مُصلَح** عبر: `lib/calc/balanceSheet.js`, `lib/calc/loanSchedule.js`, `web/js/core/engine.js`, `web/js/core/schema.js`, `web/js/core/DecisionExplainer.js`, `web/js/services/{AIConnector,InternalAIGenerator,ReportGenerator}.js`, `web/js/ui/{BalanceSheetView,DecisionDashboard,FinancingStructure,PostLaunchTracker,Wizard}.js`
- أبرزها: تعارض مولّدات "مقهى مقابل مطعم" في ٦ أماكن، عدم توازن الميزانية العمومية المتنامي بعد فترة سماح القرض، انزلاق تقريب في قرض بفائدة صفر، ازدواج احتساب الإيجار
- تفاصيل كاملة موثّقة في الذاكرة (مرجع داخلي: qarar-coffeeshop-customer-test-2026-07-09)، وملفات اختبار جديدة تثبت كل إصلاح تحت `__tests__/`

**قبل الانتقال لأداة أخرى: راجع `git diff` والتزم (commit) هذا العمل أولاً**، وإلا الأداة الجديدة سترى ملفات معدّلة بلا سياق لماذا.

---

## 6) فخاخ متكررة (لا تعيد اكتشافها)

- **`confirm()` يوافق تلقائياً في أدوات أتمتة المتصفح** (preview/browser automation) — إذا رأيت "نقرة دمّرت بيانات بصمت" تحقق من guard الـ confirm قبل افتراض أنها علة.
- **CSP بدون inline scripts** — أي كود جديد يجب أن يكون في ملفات JS منفصلة، لا `<script>` inline ولا `onclick=""`.
- **فخ وحدة الكسر (fraction-unit trap)** — حقول نسب مئوية/كسور تتكرر كخطأ شائع (تخزين 0.15 مقابل 15) عبر المولّدات، تحقق من الوحدة الفعلية قبل التعديل.
- **نظاما ألوان منفصلان**: `web/css/variables.css` (`--c-*`) مقابل `landing.html` (`--green-*`/`--gold`) — غير متزامنين، موثّق بالتفصيل في FIGMA_HANDOFF.md §3.
- **الشريط الجانبي مخفي دائماً** عبر `main.css` — التنقل الأساسي الآن هو شريط المراحل + أزرار Prev/Next داخل المعالج، ليس الشريط الجانبي القديم.

---

## 7) أولويات معلّقة (لو تكمل من هنا)

1. اختبار الدفع (Moyasar/Stripe) end-to-end بمفاتيح Sandbox حقيقية — لم يحدث بعد
2. الالتزام (commit) بتعديلات القسم 5 أعلاه
3. عمق قطاعي أكبر للقطاعات المساندة (قرار عند وجود طلب فعلي، ليس افتراضياً)
