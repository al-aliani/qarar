# ملف تسليم للمبرمج/الأداة البرمجية التالية — منصة «قرار» (sahib.sa)

> **الغرض:** سواء كنت مبرمجاً بشرياً جديداً على المشروع أو أداة AI مختلفة (Cursor / Windsurf / Copilot / غيرها)، هذا الملف يعطيك السياق اللي تحتاجه بدل ما تكتشفه من الصفر. اقرأه قبل أي تعديل.
> آخر تحديث: 2026-08-22.

## 0) البداية السريعة (Getting Started)

```bash
git clone https://github.com/al-aliani/qarar.git
cd qarar
npm install
cp .env.example .env   # عبّي VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY (من لوحة Supabase → Project Settings → API)
npm run dev            # يفتح على http://localhost:5173
npm test                # 1810/1810 يجب أن تمر خضراء قبل أي commit (تحقَّق 2026-08-22)
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
| بايثون قديم | **حُقِّق ونُظِّف (2026-08-22):** `ai_server.py` (بلا أي مرجع تنفيذي — حُذف). `ai_server_enhanced.py` **حيّ فعلياً** كأداة تطوير محلي + CI: `package.json` (`start:single`)، `start_all.bat`، `serve_local.ps1`، واختبار حارس `web/js/core/__tests__/apiServerContract.guard.test.js` يقرأ مصدره مباشرة (حذفه يكسر CI) — **لا يُلمَس بلا قرار مالك صريح** (حذفه فعلياً هو قرار "هل نتخلى عن خادم AI المحلي؟" لا تنظيف كود ميت). `*_engine.py` (item/market/experience) اعتماديات ناعمة له (`try/except ImportError`) — حذفها لا يكسر شيئاً لكنه يُعطِّل ميزات AI محلياً بصمت؛ تُرِكت مع `ai_server_enhanced.py` لنفس السبب. المنطق المالي الحقيقي المستخدم فعلياً هو `lib/calc/` + `web/js/core/engine.js` بلا علاقة بأيٍّ من هذه الملفات. |

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

⚠️ **تغيير منتجي جوهري (2026-08-21، قرار مالك):** **#/home صارت تتطلب تسجيل دخول إلزامياً** —
انتهى وضع الضيف (كان يسمح بتجربة المعالج كاملاً بلا تسجيل). زائر غير مسجَّل تُفتح له نافذة الدخول
تلقائياً؛ إغلاقها يوجّهه لـ`landing.html`. راجع `web/app.js` (`routeToView`، فرع `''`/`'home'`/
`HOME_PANEL_ROUTES`) و`AuthGuard.protect()`.
تبعات: 11 ملف اختبار e2e احتاجت تحديثاً (مساعد مشترك `e2e/helpers/auth.js`).

✅ **فجوة الاتساق أُغلقت (2026-08-22):** `#/step/N` و`#/category/N` (نفس محتوى المعالج الفعلي) كانتا
الاستثناء الوحيد الباقي — مفتوحتان بلا تسجيل دخول لمن يعرف الرابط المباشر. الآن كلتاهما تمران عبر
`runProtectedRoute()` نفسها المستخدَمة لـ#/home بالضبط (نفس `AuthGuard.protect()`/نفس رسالة/نفس
التوجيه لـ`landing.html` عند التخطي) — مسار حماية واحد موحّد لكل محتوى المعالج. **تبعة على e2e:**
7 ملفات تلمس `#/step/`/`#/category/` مباشرة؛ اثنان منها (`mobile-journey.spec.js`،
`user-journey.spec.js`) كانا يسجّلان الدخول أصلاً قبل التنقّل فلم يحتاجا تعديلاً، والباقي
(`critical_path.spec.js`، `e2e-extended.spec.js` ×5 اختبارات، `export-quality-downloads.spec.js`،
`financial_charts.spec.js`، `visual.spec.js` ×2 من 3) أُضيف لها `test.skip(!hasE2ECredentials())` +
`loginTestUser()` قبل الوصول للخطوة. **أثر عملي مهم:** بلا `E2E_CUSTOMER_EMAIL`/`E2E_CUSTOMER_PASSWORD`
كـSecrets حقيقية في GitHub Actions (لا تزال غير مضبوطة وقت هذا التحديث)، كل هذه الاختبارات
**تتخطّى نفسها في CI** بدل الفشل — تغطية e2e الفعلية لمحتوى المعالج تنتظر إضافتها. لا أستطيع
إنشاء حساب Supabase حقيقي ولا إدخال كلمات مرور بنفسي (قيود أمنية ثابتة) — هذا الجزء يحتاج المالك
تحديداً: إنشاء حساب اختبار مؤكَّد البريد على Supabase الحيّة، ثم إضافته كـSecrets بمستودع GitHub
(Settings → Secrets and variables → Actions) باسمَي `E2E_CUSTOMER_EMAIL`/`E2E_CUSTOMER_PASSWORD` —
`e2e.yml` أصبح يمرّرهما فعلاً لخطوة تشغيل E2E إن وُجدا.

✅ **مجموعة E2E الكاملة أخضر بالكامل في CI الفعلي (2026-08-21، PR [#16](https://github.com/al-aliani/qarar/pull/16)):**
التسعة سيناريوهات الفاشلة (chromium+firefox+webkit) تحقَّقت جذورها فعلياً — لا علاقة بأي منها بإصلاحات
2FA/استعادة كلمة المرور أعلاه رغم تزامن التاريخ. خلاصة الأسباب: (أ) CI لا يمرّر إعداد Supabase فيُحظر
الاتصال أمنياً (`blockedInDev`) — أُضيف `VITE_ALLOW_DEFAULT_SUPABASE_IN_DEV=true` لـ`e2e.yml`. (ب)
`investor_dashboard` بقائمة التصدير ضمن مسار فلترة "مستثمر" مخفي افتراضياً — اختبار لم يُحدَّث بعد
إضافة ميزة الفلترة. (ج) **علة إنتاج حقيقية**: السجل المحلي (`LocalExportHistory.js`) لم يكن يُسجِّل إلا
صيغ التصدير عبر Worker فقط (json/csv/pitch/bank/... لم تُسجَّل) — أُصلح جذرياً بمستمع مركزي لحدث
`feasibility:download` (نقطة الالتقاء الحقيقية لكل صيغ التصدير عبر `downloadBlob()`)، مستورَد الآن
بشكل ثابت من `app.js` عند الإقلاع. (د) **علة إنتاج حقيقية أخرى**: زر «الرسوم البيانية التفاعلية»
(`#btnGoCharts`) كان يفتح `/financial_charts.html` (صفحة عرض عامة بأرقام تجريبية ثابتة) بدل خطوة
«لوحة المؤشرات المالية» الحقيقية داخل المعالج — أُعيد توجيهه لـ`navigateTo(stepIndexById('dashboard'))`.
(هـ) `visual.spec.js` (×3): `.sidebar` مخفي دائماً منذ إعادة تصميم التنقّل — أُعيدت كتابتها لتستهدف
`.app-shell`/`#categoryStepper`|`#macroJourneyStepper`/`#wizardContainer` الفعليين؛ لقطات Linux
المرجعية وُلِّدت عبر CI نفسه (Docker غير متاح محلياً لمطابقة `ubuntu-latest`) وهي موجودة بالمستودع الآن.
اكتُشف أثناء التحقق أيضاً: طبقة جولة `driver.js` التعريفية تحجب النقر تحت بطء CI (أُضيف تعطيلها لكل
اختبار ينقر داخل `#/step/N`)، واختبار وحدة flaky غير مرتبط (`userProfileView.logoutUnsyncedWarning`)
أُصلح بـ`vi.waitFor` بدل عدد دورات `setTimeout(0)` ثابت. **تحقُّق فعلي في CI الحقيقي عبر عدة تشغيلات
متتالية، لا افتراضاً من الكود فقط.**
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

🟢 **تدقيق أمني شامل (2026-08-21، 47 وكيلاً بتحقق عدائي) — 10/12 ثغرة مؤكَّدة مُصلَحة ومُختبَرة:**
- **حرجتان (مُصلَحتان في نفس اليوم):** (أ) 2FA/TOTP كانت واجهة فقط بلا إنفاذ خادمي — جلسة `aal1` كاملة تُمنح فوراً بعد كلمة المرور بمعزل عن نجاح تحدي 2FA، وإغلاق لوحة الرمز يترك الجلسة صالحة. (ب) رابط استعادة كلمة المرور يمنح جلسة كاملة فوراً قبل أي تغيير فعلي لكلمة المرور. كلاهما مُصلَح بإنفاذ `isAuthenticated` مرتبط فعلياً بحالة AAL/نجاح التغيير + `signOut()` حقيقي عند الإغلاق بلا إكمال (راجع `AuthGuard.js`/`AuthModalStub.js`/`NewPasswordModal.js`، 43 اختبار).
- **بقية الإصلاحات:** XSS مخزَّن بتقرير البنك (`BankReportGenerator.js`)، حدّ معدّل (rate limiting) على `create-checkout`/`places-nearby`/`check-name-availability` (جدول `rate_limit_events` جديد)، تضييق CSP wildcard (`*.supabase.co`/`*.sentry.io` → نطاقات محددة)، حذف تعارض meta-CSP مع رأس Vercel، إخفاء تفاصيل خطأ Postgres بـ`health`، تحقق مدخلات `reviewer-submit`.
- **مؤجَّل بقرار — أثر منخفض موثّق:** سباق TOCTOU على الكوبونات، غياب `noopener` على `window.open` (يحتاج إعادة هيكلة أكبر من `document.write`).
- الكومِتات الأربعة (`ba10c504`، `7d83e144`، `17d6a2c5`، `bb551540`) مدفوعة ومنشورة حيّاً.

🟡 **معطَّل بقرار مالك، لا عطل:** Moyasar/Stripe/Tamara مبنية ومنشورة (البنية كاملة، webhooks تتحقق من التوقيع فعلاً) لكن الواجهة تعرض التحويل البنكي فقط حالياً (`SubscriptionCheckoutView.js`).

⚠️ **فجوة منتج معروفة (مقصودة):** التغطية القطاعية خارج المطاعم (تجزئة/خدمي/صناعي/لوجستي/SaaS) عامة وليست بعمق المطاعم — راجع PRODUCT_CONSTITUTION.md.

🟢 **تقييم شامل بـ10 محاور + إصلاحات (2026-08-22، PR [#17](https://github.com/al-aliani/qarar/pull/17) و[#18](https://github.com/al-aliani/qarar/pull/18)، كلاهما مدموج):**
أداء، أمان (أعلاه)، UX، إمكانية الوصول، SEO، محتوى/ثقة، CRO، جودة تقنية، مراقبة، امتثال قانوني — كل محور بوكلاء مستقلين بدليل فعلي (curl حي على sahib.sa + فحص كود)، ثم تنفيذ مُتحقَّق (1810/1810 اختبار + بناء إنتاجي).
- **أداء**: إزالة modulepreload الخاطئ لحزمة pptx (385KB، PR #17). **حزمة chart.js (207KB) أُصلحت لاحقاً (2026-08-22):** لم تعد تُحمَّل ثابتة بـ`index.html` — تحميل كسول عبر `ensureChartGlobal()` في `stepComponentRegistry.js`/`Wizard.js` قبل رسم أيٍّ من 6 مكوّنات تستهلكها فعلياً (dashboard/financing/monteCarlo/services/breakEven/marketing+staffing)، بلا لمس الملفات المستهلِكة نفسها فتبقى اختباراتها (`monteCarloAnalysis.test.js`) سليمة.
- **UX/A11y**: حبس تركيز `ExportMenu.js`، استرجاع مؤشر تركيز حقول الدخول، h1/تسلسل عناوين `DecisionDashboard.js` (16×h4→h3)، `aria-label` على حقول `DynamicTable.js`.
- **SEO/محتوى/CRO**: canonical/robots/JSON-LD/sitemap، إخلاء مسؤولية فعلي بتقرير البنك (كان يحاكي هوية بنكية رسمية بلا إفصاح)، مؤشرات ثقة + CTA مخصَّص بصفحة الدفع.
- **مراقبة**: نشر دالة `health` الغائبة عن CI (**نفس نمط ثغرة `reviewer-*` المكتشَفة 2026-08-21** — تحقق دورياً من تطابق `supabase/functions/*/` مع قائمة `supabase-functions-deploy.yml` عند إضافة أي دالة جديدة)، `captureException`/`captureMessage` لفشل المصادقة/الدفع الحرج.
- **امتثال**: نظام موافقة كوكيز فعلي (لا تحميل Sentry/تحليلات قبل موافقة صريحة)، ربط زر حذف الحساب ببنية `AccountService.requestAccountDeletion()` كانت جاهزة وغير مستخدَمة.
- **مؤجَّل بقرار (منتج/هندسة، لا أخطاء)**: تحويل بنكي بدل بوابة دفع فورية.

✅ **بنود إضافية أُغلقت (2026-08-22، PR [#19](https://github.com/al-aliani/qarar/pull/19)، مدموج — CI أخضر: unit/e2e/test-frontend):**
- **`npm audit`**: `uuid` (عبر exceljs) أُصلح بـ`overrides` بلا كسر إصدار exceljs (10→8 ثغرة). **مؤجَّل عمداً بعد تحقّق فعلي، لا افتراض**: esbuild (يحتاج vitest 2→4، جُرِّب فعلياً وكسر `lib/calc/index.js` CJS/ESM + اختبارين آخرين — تراجُع أكبر من قيمة ثغرة "moderate" مقصورة على dev محلي)، و`image-size` (عبر pptxgenjs — `pptxExporter.js` لا يستدعي `addImage()` إطلاقاً، الثغرة غير قابلة للوصول فعلياً بهذا التطبيق).
- **كود بايثون/React قديم**: `ai_server.py` (صفر مرجع تنفيذي) **حُذف**. `ai_server_enhanced.py` وملفات `*_engine.py` وتجربة React (`src/*.jsx`) **أُبقيت عمداً** — الأول أداة تطوير محلي حيّة فعلياً (`package.json:start:single`، `start_all.bat`، واختبار حارس `apiServerContract.guard.test.js`)، والثانية اعتماديات ناعمة له، والثالثة قرار سابق موثَّق صراحة بـ`vite.config.js` بإبقائها كنقطة بداية محتملة.
- **اختبارات**: `AdminDashboardView.js` كان له فعلياً 8 ملفات اختبار (534 سطراً) — الادّعاء السابق "صفر تغطية" كان خطأً. `FinancialStatements.js` كان فعلياً بلا أي اختبار — أُضيف `financialStatements.render.test.js` (6 اختبارات: حالتا تحذير حقيقيتان، رسم كامل، موسمية، تنقّل).
- **تنبيه خادمي لفشل webhooks**: بُني `supabase/functions/_shared/alerting.ts` — يرسل لـSentry عبر Envelope API الخام بـ`fetch()` (بلا SDK، Deno-متوافق) عند قراءة `Deno.env.get('SENTRY_DSN')` بنجاح؛ يتراجع لـ`console.error` بصمت (لا يرمي أبداً) بلا هذا السرّ. مُوصَّل بالفعل بنقطتي الفشل الحقيقيتين (رفض توقيع، فشل تحديث طلب مدفوع) بكل من `webhook-moyasar`/`webhook-stripe`/`webhook-tamara`. **يتطلب إجراءً من المالك ليعمل فعلياً**: `supabase secrets set SENTRY_DSN=<DSN مشروع Sentry>` — بلا هذا يبقى بنفس سلوك اليوم (سجلّ محلي فقط، لا كسر لأي شيء).

⚠️ **`test-backend` بـ`.github/workflows/ci.yml` فاشل — سابق ومنفصل تماماً عن PR #19:** `tests/test_tasks.py` يستورد `celery_app.py` الذي يحتاج حزمة `celery`، لكن لا يوجد `requirements.txt` بجذر المستودع يُثبِّتها (الخطوة تُثبِّت `pytest` فقط ثم تتحقق من وجود `requirements.txt` — غير موجود). نفس الفشل كان موجوداً بالضبط على PR #18 قبله. لم يُلمَس — خارج نطاق هذه الجلسة، ويحتاج قراراً: هل ميزة Celery/tasks.py حيّة فعلياً (فتحتاج `requirements.txt`) أم بقايا تجربة أخرى (فتُحذف مثل `ai_server.py` أعلاه)؟ لم يُحقَّق بعد.

---

## 5) فخاخ متكررة (لا تعيد اكتشافها)

- **لقطات Playwright لعنصر أطول من الفيوبورت + عنصر `position:fixed`** — أي عنصر ثابت (شريط إشعار، banner) يُلحَق بموضع الفيوبورت أثناء تصوير/دمج لقطة عنصر (لا `fullPage`) أطول من ارتفاع الشاشة، فيظهر مكرَّراً/متغيّر الموضع فجأة — يبدو "تذبذب توقيت عشوائي" لكنه سببٌ حتمي قابل للتكرار. الحل: ثبّت أي حالة توافق/إشعار (`localStorage`) عبر `addInitScript` قبل التنقّل بدل رفع المهلة/التفاوت المسموح. اكتُشف 2026-08-22 بعد 4 كومِتات ظنّت أنه توقيت (راجع `e2e/visual.spec.js`).

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
