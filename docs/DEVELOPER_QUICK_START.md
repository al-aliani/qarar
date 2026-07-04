# دليل البدء السريع - ميزات التصدير والتكامل

**للمطورين:** مرجع سريع للبدء في تنفيذ الميزات

---

## 📦 التثبيت السريع

```bash
# 1. تثبيت جميع المكتبات المطلوبة
npm install --save pptxgenjs docx qrcode @emailjs/browser ua-parser-js

# 2. التحقق من التثبيت
npm list pptxgenjs docx qrcode
```

---

## 🚀 الميزة 1: PowerPoint Export (ابدأ هنا!)

### الخطوة 1: إنشاء الملف

```bash
# إنشاء المجلد إن لم يكن موجوداً
mkdir -p web/export

# إنشاء الملف
touch web/export/pptxExporter.js
```

### الخطوة 2: نسخ الكود

```javascript
// web/export/pptxExporter.js
import pptxgen from 'pptxgenjs';

export class PPTXExporter {
  constructor(studyData) {
    this.study = studyData;
    this.pptx = new pptxgen();
  }

  async export() {
    // إعدادات أساسية
    this.pptx.layout = 'LAYOUT_16x9';
    this.pptx.rtlMode = true;
    
    // إضافة الشرائح
    this.addCoverSlide();
    // ... باقي الشرائح
    
    // الحفظ
    const fileName = `${this.study.projectInfo?.projectName || 'دراسة'}_عرض.pptx`;
    await this.pptx.writeFile({ fileName });
    
    return { success: true, fileName };
  }

  addCoverSlide() {
    const slide = this.pptx.addSlide();
    slide.addText('اسم المشروع', {
      x: 0.5,
      y: 2.5,
      w: '90%',
      fontSize: 44,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      rtlMode: true
    });
  }
}
```

**الكود الكامل:** انظر `docs/EXPORT_FEATURES_IMPLEMENTATION.md` القسم 1

### الخطوة 3: التكامل

```javascript
// web/js/ui/ExportOptions.js
import { PPTXExporter } from '../../export/pptxExporter.js';

async exportPowerPoint() {
  const studyData = Store.getState().study;
  const exporter = new PPTXExporter(studyData);
  const result = await exporter.export();
  
  if (result.success) {
    alert(`✅ تم التصدير: ${result.fileName}`);
  }
}
```

### الخطوة 4: الاختبار

```javascript
// اختبار بسيط
const testData = {
  projectInfo: { projectName: 'مقهى الرياض' },
  executiveSummary: { problem: 'نقص المقاهي الجودة' }
};
const exporter = new PPTXExporter(testData);
await exporter.export();
```

---

## 📄 الميزة 2: Word Export

### البدء السريع

```javascript
// web/export/docxExporter.js
import { Document, Packer, Paragraph } from 'docx';

export class DOCXExporter {
  constructor(studyData) {
    this.study = studyData;
  }

  async export() {
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            text: 'تقرير دراسة الجدوى',
            heading: HeadingLevel.TITLE
          })
          // ... باقي المحتوى
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    this.downloadBlob(blob, 'تقرير.docx');
    return { success: true };
  }

  downloadBlob(blob, fileName) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
```

**الكود الكامل:** انظر `docs/EXPORT_FEATURES_IMPLEMENTATION.md` القسم 2

---

## 🔗 الميزة 3: QR Code (سريع!)

### تنفيذ في 30 دقيقة

```javascript
// web/js/utils/qrGenerator.js
import QRCode from 'qrcode';

export class QRGenerator {
  static async generate(studyId) {
    const url = `${window.location.origin}/share/${studyId}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 300,
      color: { dark: '#1E40AF', light: '#FFFFFF' }
    });
    return { success: true, dataUrl, url };
  }
}
```

```javascript
// الاستخدام
const result = await QRGenerator.generate(studyId);
if (result.success) {
  // عرض في modal
  showModal(result.dataUrl, result.url);
}
```

**الكود الكامل:** انظر `docs/EXPORT_FEATURES_IMPLEMENTATION.md` القسم 3

---

## 📊 الميزة 4: Google Analytics

### الإعداد (5 دقائق)

```html
<!-- web/index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

```javascript
// web/js/utils/analytics.js
export class Analytics {
  static trackEvent(eventName, params = {}) {
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, params);
    }
  }
  
  static trackExport(format) {
    this.trackEvent(`export_${format.toLowerCase()}`, {
      format,
      event_category: 'conversion'
    });
  }
}
```

```javascript
// الاستخدام في أي مكان
Analytics.trackExport('PDF');
Analytics.trackEvent('study_created', { sector: 'مطاعم' });
```

**الكود الكامل:** انظر `docs/INTEGRATION_FEATURES.md` القسم 1

---

## 📧 الميزة 5: إرسال البريد

### الإعداد (EmailJS)

1. سجّل في [EmailJS](https://www.emailjs.com/)
2. اربط حساب Gmail
3. أنشئ Template
4. احصل على المفاتيح

```html
<!-- web/index.html -->
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
<script>
  emailjs.init("YOUR_PUBLIC_KEY");
</script>
```

```javascript
// web/js/services/EmailService.js
export class EmailService {
  static async sendSummary(email, studyData) {
    try {
      await emailjs.send(
        'service_id',
        'template_id',
        {
          to_email: email,
          project_name: studyData.projectInfo.projectName,
          summary: 'ملخص الدراسة...'
        }
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

**الكود الكامل:** انظر `docs/INTEGRATION_FEATURES.md` القسم 2

---

## 🗄️ الميزة 6: سلة المحذوفات

### إعداد Supabase

```sql
-- إضافة عمود deleted_at
ALTER TABLE feasibility_studies 
ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;

CREATE INDEX idx_deleted_at ON feasibility_studies(deleted_at);
```

```javascript
// web/js/services/DataService.js
async deleteStudy(studyId) {
  const { error } = await supabase
    .from('feasibility_studies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', studyId);
  
  return { success: !error };
}

async restoreStudy(studyId) {
  const { error } = await supabase
    .from('feasibility_studies')
    .update({ deleted_at: null })
    .eq('id', studyId);
  
  return { success: !error };
}
```

**الكود الكامل:** انظر `docs/EXPORT_FEATURES_IMPLEMENTATION.md` القسم 5

---

## 🔄 الميزة 7: نسخ مشروع

### البدء السريع

```javascript
// web/js/services/DataService.js
async duplicateStudy(studyId) {
  // 1. جلب الدراسة الأصلية
  const original = await this.getStudy(studyId);
  
  // 2. نسخ عميق
  const newStudy = JSON.parse(JSON.stringify(original));
  
  // 3. تعديل البيانات
  delete newStudy.id;
  newStudy.projectInfo.projectName = `نسخة من ${original.projectInfo.projectName}`;
  newStudy.createdAt = new Date().toISOString();
  
  // 4. حفظ
  const saved = await this.saveStudy(newStudy);
  return { success: true, study: saved };
}
```

```javascript
// الاستخدام
const result = await DataService.duplicateStudy(studyId);
if (result.success) {
  alert('✅ تم النسخ!');
  navigateToStudy(result.study.id);
}
```

**الكود الكامل:** انظر `docs/EXPORT_FEATURES_IMPLEMENTATION.md` القسم 4

---

## 📝 Checklist: قبل كل commit

- [ ] الكود يعمل بدون أخطاء
- [ ] اختبار مع بيانات عربية
- [ ] لا توجد console.log زائدة
- [ ] التعليقات واضحة
- [ ] الأسماء بالإنجليزية (متغيرات، دوال)
- [ ] النصوص بالعربية (UI, رسائل المستخدم)

---

## 🐛 حل المشاكل الشائعة

### مشكلة 1: PPTX لا يُصدّر

```javascript
// تحقق من:
1. هل pptxgenjs مثبّت؟
   npm list pptxgenjs

2. هل الاستيراد صحيح؟
   import pptxgen from 'pptxgenjs';

3. هل البيانات موجودة؟
   console.log(this.study);
```

### مشكلة 2: العربية لا تظهر صحيحة

```javascript
// تأكد من:
1. rtlMode: true
2. fontFace: 'Calibri' أو خط يدعم العربية
3. align: 'center' or 'right'
```

### مشكلة 3: QR Code لا يُفتح

```javascript
// تحقق من:
1. الرابط صحيح؟
   console.log(shareUrl);

2. الصفحة موجودة؟
   /share/:studyId route محدد؟

3. الدراسة عامة؟
   التحقق من الصلاحيات في Supabase
```

---

## 📚 المراجع السريعة

| الميزة | الكود التفصيلي | الوقت المقدر |
|-------|----------------|--------------|
| PowerPoint | `EXPORT_FEATURES_IMPLEMENTATION.md` القسم 1 | 3-4 أيام |
| Word | `EXPORT_FEATURES_IMPLEMENTATION.md` القسم 2 | 3-4 أيام |
| QR Code | `EXPORT_FEATURES_IMPLEMENTATION.md` القسم 3 | 1 يوم |
| نسخ مشروع | `EXPORT_FEATURES_IMPLEMENTATION.md` القسم 4 | 2 أيام |
| سلة المحذوفات | `EXPORT_FEATURES_IMPLEMENTATION.md` القسم 5 | 2 أيام |
| Analytics | `INTEGRATION_FEATURES.md` القسم 1 | 1-2 أيام |
| إرسال بريد | `INTEGRATION_FEATURES.md` القسم 2 | 2-3 أيام |
| سجل دخول | `INTEGRATION_FEATURES.md` القسم 3 | 2 أيام |
| Webhooks | `INTEGRATION_FEATURES.md` القسم 4 | 2-3 أيام |

---

## 🎯 الأولويات الموصى بها

### المرحلة 1 (الأسبوع 1-2)
1. ⭐⭐⭐⭐⭐ PowerPoint Export
2. ⭐⭐⭐⭐⭐ QR Code
3. ⭐⭐⭐⭐⭐ Word Export

### المرحلة 2 (الأسبوع 3)
4. ⭐⭐⭐⭐ نسخ مشروع
5. ⭐⭐⭐⭐ سلة المحذوفات
6. ⭐⭐⭐⭐ إرسال بريد

### المرحلة 3 (الأسبوع 4)
7. ⭐⭐⭐ Google Analytics
8. ⭐⭐⭐ سجل تسجيلات الدخول

### المرحلة 4 (اختياري)
9. ⭐⭐ Zapier Webhooks
10. ⭐ Notion (مؤجل)

---

## 💡 نصائح للمطورين

### 1. ابدأ صغيراً
```javascript
// بدلاً من:
addAllSlides() { /* 500 سطر */ }

// افعل:
addCoverSlide() { /* 20 سطر */ }
addSummarySlide() { /* 30 سطر */ }
// ... إلخ
```

### 2. اختبر مبكراً
```javascript
// بعد كل دالة:
const exporter = new PPTXExporter(testData);
exporter.addCoverSlide();
await exporter.pptx.writeFile({ fileName: 'test.pptx' });
// افتح الملف وتحقق
```

### 3. استخدم constants
```javascript
const COLORS = {
  primary: '1E40AF',
  success: '10B981',
  danger: 'EF4444'
};

const FONTS = {
  arabic: 'Calibri',
  english: 'Calibri'
};
```

### 4. Log everything (أثناء التطوير)
```javascript
console.log('[PPTX] Starting export...');
console.log('[PPTX] Study data:', this.study);
console.log('[PPTX] Slide 1 added');
```

### 5. التعامل مع الأخطاء
```javascript
try {
  await exporter.export();
} catch (error) {
  console.error('[Export Error]:', error);
  alert(`فشل التصدير: ${error.message}`);
  // إرسال إلى error tracking (مستقبلاً)
}
```

---

## 🚨 قواعد مهمة

### ✅ افعل
- ✅ استخدم `async/await`
- ✅ تحقق من البيانات قبل الاستخدام
- ✅ عرض loading spinner
- ✅ رسائل خطأ واضحة بالعربية
- ✅ اختبر مع بيانات حقيقية

### ❌ لا تفعل
- ❌ لا تستخدم `Promise.then()` (استخدم async/await)
- ❌ لا تترك console.log في production
- ❌ لا تفترض وجود البيانات (تحقق بـ `?.`)
- ❌ لا تنسَ RTL للعربية
- ❌ لا تُصدّر بدون تأكيد (للعمليات الكبيرة)

---

## 🔥 كود البداية الجاهز

### ملف جديد: `web/export/pptxExporter.js`

```javascript
import pptxgen from 'pptxgenjs';

export class PPTXExporter {
  constructor(studyData) {
    this.study = studyData;
    this.pptx = new pptxgen();
    this.colors = {
      primary: '1E40AF',
      success: '10B981',
      warning: 'F59E0B',
      danger: 'EF4444'
    };
  }

  async export() {
    try {
      this.pptx.layout = 'LAYOUT_16x9';
      this.pptx.rtlMode = true;
      
      this.addCoverSlide();
      // TODO: أضف باقي الشرائح
      
      const fileName = `${this.study.projectInfo?.projectName || 'دراسة'}_عرض.pptx`;
      await this.pptx.writeFile({ fileName });
      
      return { success: true, fileName };
    } catch (error) {
      console.error('[PPTX Export Error]:', error);
      return { success: false, error: error.message };
    }
  }

  addCoverSlide() {
    const slide = this.pptx.addSlide();
    slide.background = { fill: this.colors.primary };
    
    slide.addText(this.study.projectInfo?.projectName || 'دراسة جدوى', {
      x: 0.5,
      y: 2.5,
      w: '90%',
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      rtlMode: true
    });
  }
}
```

### اختباره فوراً:

```javascript
// في console المتصفح:
import { PPTXExporter } from './web/export/pptxExporter.js';
const testData = {
  projectInfo: { projectName: 'مشروع اختباري' }
};
const exporter = new PPTXExporter(testData);
await exporter.export();
// ستُحمّل ملف PPTX تلقائياً
```

---

## 📞 الدعم

**الوثائق الكاملة:**
- `docs/خطة_ميزات_التصدير_والتكامل_2026.md`
- `docs/EXPORT_FEATURES_IMPLEMENTATION.md`
- `docs/INTEGRATION_FEATURES.md`
- `docs/EXPORT_INTEGRATION_STATUS.md`

**إذا واجهت مشكلة:**
1. راجع الوثائق التفصيلية أعلاه
2. تحقق من `console.log` في المتصفح
3. ابحث عن الخطأ في GitHub Issues للمكتبة
4. اسأل في قناة التطوير

---

**آخر تحديث:** 31 يناير 2026  
**الإصدار:** 1.0  
**الحالة:** ✅ جاهز للاستخدام
