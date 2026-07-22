# ملف تسليم للمبرمج/الأداة البرمجية التالية — منصة «قرار» (sahib.sa)

> **الغرض:** سواء كنت مبرمجاً بشرياً جديداً على المشروع أو أداة AI مختلفة (Cursor / Windsurf / Copilot / غيرها)، هذا الملف يعطيك السياق اللي تحتاجه بدل ما تكتشفه من الصفر. اقرأه قبل أي تعديل.
> آخر تحديث: 2026-07-22.

## 0) البداية السريعة (Getting Started)

```bash
git clone https://github.com/al-aliani/qarar.git
cd qarar
npm install
cp .env.example .env   # عبّي VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY (من لوحة Supabase → Project Settings → API)
npm run dev            # يفتح على http://localhost:5173
npm test                # 1749/1749 يجب أن تمر خضراء قبل أي commit
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
- المصادقة: تسجيل دخول/خروج، إعادة تعيين كلمة مرور، إنفاذ 2FA فعلي
- الحفظ السحابي، ونطاق موحّد (`sahib.sa`) في robots.txt/sitemap/og:url بعد تدقيق SEO (commit `c05fbfc`)
- رؤوس أمان الإنتاج كاملة: CSP بلا `unsafe-inline`، HSTS، `X-Frame-Options: DENY`، `nosniff`

🔴 **تدقيق إطلاق go/no-go بأقصى عمق (2026-07-22، 111 وكيلاً) خرج بقرار NO-GO** — التقرير الكامل في
[`docs/تقرير_فحص_الإطلاق_sahib_2026-07-22.md`](docs/تقرير_فحص_الإطلاق_sahib_2026-07-22.md). وجد 5 عيوب P0 حرجة
في مسار الإيراد (صفحة الأسعار محجوبة 71%، صفر CORS في كل دوال Edge، دالة تأكيد التحويلات البنكية معطوبة
`uuid=text`، حقن HTML عبر اسم المشروع، النشر محظور بهوية git خاطئة).

**تحقّق مباشر من الكود وقت كتابة هذا التحديث يُظهر أن الخمسة كلها أُصلحت بعده بالفعل:**
- P0-1 (overflow:hidden يحجب الصفحة) → مُصلَح، مُقيَّد الآن بصنف `body.is-app-shell-page` (`web/css/layout.css`)
- P0-2 (صفر CORS) → موجود الآن `supabase/functions/_shared/cors.ts`
- P0-3 (`study_id uuid=text`) → migration جديدة `20260722094000_fix_bank_transfer_study_id_type.sql` تستخدم `study_uuid`
- P0-4 (حقن HTML عبر `info.name`) → `bankEsc()`/`escapeHtml()` مُطبَّقة الآن في كل المواضع (`BankReportGenerator.js`, `ReportGenerator.js`)
- P0-5 (هوية git تحجب النشر) → `.git/config` المحلي لهذا المستودع مضبوط بالفعل على `al-aliani` (وليس الهوية العامة `shafaq-company`)

**⚠️ هذا لا يعني "GO" تلقائياً — بقي قبل أي إعلان جاهزية:**
1. تأكد أن migration `20260722094000` طُبّقت فعلاً على قاعدة Supabase **الحيّة** (ليس كافياً أن تكون في المستودع).
2. **اختبار دفع كامل من متصفح حقيقي على `sahib.sa`** حتى وصول الـwebhook وتأكيد الطلب من `/admin.html` — هذا المسار **لم يُختبر e2e قط** وهو ما سمح لهذه العيوب بالبقاء أصلاً.
3. راجع قسم "عيوب عالية غير مانعة (P1)" في التقرير — فيه 8 أخطاء مالية تمسّ أرقاماً يراها العميل في مخرَج مدفوع (PDF/Excel)، تستحق جولة إصلاح مخصصة قبل تسويق واسع.

🟡 **مبني لكن غير مُختبَر حياً بمفاتيح إنتاج حقيقية:** Moyasar + Stripe (البنية كاملة، webhooks تتحقق من التوقيع فعلاً).

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

1. **تأكيد نشر migration `20260722094000` على Supabase الحيّة** ثم **اختبار دفع كامل e2e من متصفح حقيقي على `sahib.sa`** (تحويل بنكي حتى تأكيد الأدمن، ثم Moyasar/Stripe بمفاتيح Sandbox) — هذا المسار لم يُختبر حياً قط، راجع §4.
2. الأخطاء المالية الثمانية في التقرير (§P1 قسم "مالية") — تمسّ أرقاماً في مخرَجات مدفوعة (PDF/Excel)، تستحق جولة إصلاح مخصصة.
3. نشر/تحقق دوال المراجعين الثلاث (`reviewer-queue/claim/submit`) حيّة — باقة «مراجَع بخبير 1,999» تُباع وتحتاج مساراً فعلياً خلفها.
4. عمق قطاعي أكبر للقطاعات المساندة (قرار عند وجود طلب فعلي، ليس افتراضياً)
