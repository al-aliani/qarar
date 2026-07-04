# سجل التغييرات

## [مخطط] — 2026-02: ميزات التصدير والتكامل

### 📋 التخطيط والتوثيق (31 يناير 2026)

تم التخطيط الشامل لـ **10 ميزات جديدة** مع وثائق تفصيلية كاملة:

#### التصدير المتقدم
- [ ] **PowerPoint Export (PPTX)**: 10 شرائح احترافية مع دعم العربية
- [ ] **Word Export (DOCX)**: تقرير 20-30 صفحة قابل للتعديل
- [ ] **QR Code للمشاركة**: توليد QR code لمشاركة الدراسة

#### إدارة المشاريع
- [ ] **نسخ مشروع**: استنساخ كامل أو هيكلي
- [ ] **سلة المحذوفات**: soft delete مع احتفاظ 30 يوم
- [ ] **إرسال بالبريد**: مشاركة التقرير عبر EmailJS

#### Analytics والأمان
- [ ] **Google Analytics (GA4)**: تتبع الأحداث والسلوك
- [ ] **سجل تسجيلات الدخول**: مراقبة الجلسات والأجهزة

#### التكاملات الخارجية
- [ ] **Zapier Integration**: webhooks لـ 5000+ تطبيق
- [ ] **Notion Integration**: تصدير إلى Notion (مؤجل)

#### الوثائق الجديدة
- `docs/خطة_ميزات_التصدير_والتكامل_2026.md` - التخطيط الشامل
- `docs/EXPORT_FEATURES_IMPLEMENTATION.md` - الكود التفصيلي للتصدير
- `docs/INTEGRATION_FEATURES.md` - الكود التفصيلي للتكاملات
- `docs/EXPORT_INTEGRATION_STATUS.md` - حالة التنفيذ والتتبع
- `docs/DEVELOPER_QUICK_START.md` - دليل البدء السريع
- `docs/FEATURES_SUMMARY.md` - ملخص شامل

#### المكتبات المخططة
- pptxgenjs (PowerPoint)
- docx (Word)
- qrcode (QR Code)
- @emailjs/browser (Email)
- ua-parser-js (Device Detection)

**الوقت المقدر:** 21-27 يوم عمل (~1 شهر)  
**الحالة:** ✅ جاهز للتنفيذ

---

## [غير مُصدّر] — 2026-01

### معايير إضافية (5 معايير حرجة ومهمة)

- **OAuth (Google)**: تسجيل دخول بحساب Google في AuthComponent
- **المصادقة الثنائية (2FA)**: TOTP مع QR code في TwoFactorModal
- **اختبارات E2E**: Playwright config + user-journey.spec.js
- **تأكيد البريد**: `resendConfirmationEmail` في supabaseClient
- **Google Sheets**: تصدير إلى Google Sheets عبر Apps Script Web App

### المرحلة 4: التميز

- **عملات خليجية**: دعم SAR, AED, KWD, BHD, OMR, QAR في الافتراضات والتقارير
- **استيراد من CSV**: استيراد بيانات أساسية من ملف CSV بصيغة الحقل,القيمة
- **توثيق**: دليل البدء السريع، Architecture، FAQ، CONTRIBUTING

### المرحلة 3: الجودة والاستقرار

- **اختبارات**: Unit tests للمحرك المالي (engine) والتحقق (validation)
- **PWA**: manifest.json + Service Worker للتخزين المؤقت والإضافة للشاشة الرئيسية
- **إصلاح**: إضافة `validation: 0` إلى capexBreakdown في engine.js

### المرحلة 2: الميزات التنافسية

- تقارير بنكية (بنك التنمية، ريادة، كفالة)
- Pitch Deck تصدير HTML قابل للطباعة كـ PDF
- مستشار AI تفاعلي (AIChatModal)

### المرحلة 1

- نظام مصادقة أساسي (Supabase)
- حفظ سحابي + AutoSave
- تفعيل AI بدون مفتاح API
