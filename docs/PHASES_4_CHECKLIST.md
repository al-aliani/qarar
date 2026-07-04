# قائمة تحقق المراحل الأربع — توصيات وحالة التنفيذ

> **المرجع:** [خطة_تطوير_الموقع.md](./خطة_تطوير_الموقع.md) — خريطة المراحل (4 مراحل)

---

## المرحلة 1 — التأسيس والاستقرار (6 أسابيع)

| # | التوصية | الحالة | الملاحظة |
|---|---------|--------|----------|
| 1 | استقرار التصدير (PPTX/DOCX) | ✅ | pptxExporter، wordExporter مكتملان |
| 2 | مصفوفة اختبارات التصدير (5 حالات) | ✅ | [EXPORT_TEST_MATRIX.md](./EXPORT_TEST_MATRIX.md) |
| 3 | تشغيل موحد (Vite/منافذ) | ✅ | [DEV_RUN_GUIDE.md](./DEV_RUN_GUIDE.md)، start_all.bat، proxy في vite.config |
| 4 | سد فجوات حرجة: خطوة التمويل | ✅ | FinancingStructure: interestRate، termYears، نسب التمويل + نص "كم ستدفع من جيبك؟" |
| 5 | سد فجوات حرجة: مصطلحات TAM/SAM/SOM | ✅ | MarketAnalysis: إجمالي حجم السوق، السوق المتاح، حصتنا المستهدفة |
| 6 | تحديد نطاق Express (5–7 مدخلات) | 📋 | [EXPRESS_MODE_SPEC.md](./EXPRESS_MODE_SPEC.md) |
| 7 | Sentry / مراقبة أخطاء | ⚠️ | monitoring.js جاهز؛ يحتاج VITE_SENTRY_DSN في الإنتاج |
| 8 | توحيد نتيجة التصدير (عقد موحد) | 📋 | مراجعة ExportMenu لإرجاع success/fileName/error + meta |

---

## المرحلة 2 — الذكاء والمسار السريع (6 أسابيع)

| # | التوصية | الحالة | الملاحظة |
|---|---------|--------|----------|
| 1 | market_engine API | ✅ | market_engine.py موجود؛ ai_server_enhanced يعرض /api/market_analysis |
| 2 | experience_engine API | ✅ | experience_engine.py موجود؛ ai_server_enhanced يعرض /api/consult_history |
| 3 | Express Mode MVP (واجهة 5–7 مدخلات) | 📋 | يحتاج ExpressInputView.js وربط بـ market_engine |
| 4 | Magic Fill للحقول الحرجة | 📋 | يحتاج MagicFillService + أزرار بجانب إيجار، رواتب، كهرباء، تسويق |
| 5 | ربط QuickFeasibilityWizard بـ market_engine | 📋 | استدعاء /api/market_analysis عند اختيار قطاع/مدينة |

---

## المرحلة 3 — الثقة والواجهة (8 أسابيع)

| # | التوصية | الحالة | الملاحظة |
|---|---------|--------|----------|
| 1 | Benchmarking "هل أرقامي منطقية؟" | 📋 | BenchmarkingView + sector_benchmarks.json |
| 2 | توطين مالي (تأمينات، إقامة، زكاة) | 📋 | ZakatView، جداول saudi_labor |
| 3 | مصفوفة امتثال تفاعلية | 📋 | ComplianceMatrixView + بنود بنك التنمية |
| 4 | تنبيهات وإرشادات | ✅ | IntroductionView، Wizard، FinancingStructure، SensitivityAnalysis، ExecutiveSummary |
| 5 | هيدر ثابت + KPI مصغّر | ✅ | app-header في index.html (حفظ، تصدير، NPV، IRR، جودة) |
| 6 | شريط مراحل في الهيدر | 📋 | stagesMapping.js + شريط مراحل أفقي |
| 7 | تبسيط الشريط الجانبي | 📋 | إزالة "المزيد"، دمج في قائمة "ملف" |
| 8 | FAB التصدير على الموبايل | 📋 | إظهار FAB، ربط بـ openExportMenu |
| 9 | مؤشر الحفظ (Saving/Saved/Offline) | 📋 | SyncIndicator.js |

---

## المرحلة 4 — التوسع وما بعده (مستمر)

| # | التوصية | الحالة | الملاحظة |
|---|---------|--------|----------|
| 1 | سلة المحذوفات (TrashView) | 📋 | soft delete، TrashView.js، سياسة 30 يوم |
| 2 | إرسال بالبريد (EmailService) | 📋 | EmailService.js، EmailModal، ربط ShareStudyView |
| 3 | GA4 + سجل تسجيلات الدخول | 📋 | analytics.js، user_sessions، SecuritySettingsView |
| 4 | QA Gate واجهة (PASS/FAIL قبل التصدير) | ⚠️ | qaChecks موجودة؛ عرض واضح في ExportMenu |
| 5 | AI Writer موسّع في كل خانة | 📋 | توسيع AIConnector / InternalAIGenerator |
| 6 | قوالب قطاعية دقيقة | 📋 | templates.js — مطعم ≠ مغسلة ≠ كافتيريا |
| 7 | قالب مشروع منزلي (Micro-Business) | 📋 | قالب مبسط في TemplateSelector |
| 8 | بطاقة المنح (بنك التنمية) | 📋 | GrantCardExporter |

---

## الرموز

- ✅ منفذ أو مكتمل
- ⚠️ جزئي أو يحتاج إعداد (مثل DSN)
- 📋 مخطط — لم يُنفّذ بعد

---

**آخر تحديث:** 31 يناير 2026
