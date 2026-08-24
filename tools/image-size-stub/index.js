'use strict'

/*
 * ============================================================================
 * حزمة بديلة (stub) محلية عن `image-size` — أُضيفت بتاريخ 2026-08-24
 * ============================================================================
 *
 * لماذا وُجد هذا البديل؟
 * ----------------------
 * `npm audit` كان يبلّغ عن ثغرتين خطيرتين (high) في حزمة `image-size`:
 *
 *   - GHSA-w3rx-r6r6-pgpr — حجب خدمة (DoS) عبر حلقة لا نهائية في محلّل ICNS
 *   - GHSA-5p2g-fcmc-qvqq — حجب خدمة (DoS) عبر حلقات لا نهائية في محلّلَي JXL و HEIF
 *
 * نطاق الثغرتين هو `<=2.0.2`، وأحدث إصدار منشور من `image-size` على npm هو
 * 2.0.2 بالضبط ⟹ لا يوجد إصدار مُرقَّع upstream أصلاً، فالترقية لا تُغلق الثغرة.
 * كذلك أحدث pptxgenjs (4.0.1) ما زال يعلن `image-size` في تبعياته، فترقية
 * pptxgenjs لا تحل شيئاً أيضاً. الاقتراح الوحيد من npm كان تنزيل pptxgenjs إلى
 * 1.1.5 وهو كسر major غير مقبول. لذا: استبدال محلي عبر `overrides`.
 *
 * كيف رُبِط؟ (مهم — لا تُبسِّطه)
 * -----------------------------
 * في package.json الجذري:
 *   "dependencies": { "image-size": "file:./tools/image-size-stub" }
 *   "overrides":    { "image-size": "$image-size" }
 *
 * الصيغة المباشرة `"overrides": { "image-size": "file:./tools/..." }` تبدو أبسط
 * لكنها **مكسورة فعلياً** مع npm 11.6.1: يكتب في package-lock.json مساراً
 * محلولاً نسبةً إلى الحزمة الأب لا إلى جذر المشروع
 * (`node_modules/pptxgenjs/tools/image-size-stub`)، فيفشل `npm ci` بالخطأ
 * `Missing: image-size@ from lock file` ⟹ ينكسر النشر على CI/Vercel.
 * لذا الحل: إعلان البديل تبعيةً مباشرة (فيُحَل الـ`file:` نسبةً إلى الجذر
 * كما يجب) ثم توجيه الـoverride إليه بصيغة `$image-size` الموثَّقة من npm.
 * (نعم، هذا يجعل `image-size` تبعية مباشرة معلنة رغم أن كودنا لا يستوردها —
 *  هذا مقصود وهو ثمن جعل `npm ci` يعمل.)
 *
 * لماذا الاستبدال آمن هنا؟
 * ------------------------
 * المستهلك الوحيد لـ`image-size` في المشروع هو `pptxgenjs` (تبعية عابرة، لا
 * استيراد مباشر في أي مكان من كودنا)، وقد ثبت بالفحص والقياس أن:
 *
 *   1. pptxgenjs يُعلن صراحةً `"image-size": false` في حقل `browser` من
 *      package.json الخاص به ⟹ الحزمة مستبعَدة كلياً من أي بناء للمتصفح.
 *   2. ملفات التوزيع المشحونة مع pptxgenjs@3.12.0 (cjs / es / bundle / min)
 *      لا تحتوي أي `require('image-size')` ولا أي إشارة إليها إطلاقاً —
 *      أسقطها rollup عند البناء وبقيت مجرد إعلان تبعية يتيم.
 *   3. قياس فعلي تحت vitest (اعتراض `Module._load` حول تصدير PPTX كامل)
 *      أثبت أن `image-size` لا تُطلب ولا تدخل `require.cache` إطلاقاً.
 *   4. الاستخدام الوحيد لـpptxgenjs في المشروع هو `web/export/pptxExporter.js`
 *      وهو لا يستدعي `addImage()`/`addMedia()`/`addChart()` — أي أن مسار
 *      الصور في pptxgenjs (وهو المسار الوحيد الذي قد يحتاج image-size) ميت.
 *
 * لماذا يرمي بدل أن يُرجع أصفاراً؟
 * --------------------------------
 * إرجاع `{ width: 0, height: 0 }` بصمت سينتج شرائح PPTX بصور مشوّهة الأبعاد
 * دون أي إشارة. الوصول إلى هنا يعني مساراً غير متوقع يحتاج مراجعة بشرية،
 * فالفشل الصريح أفضل من مخرجات معطوبة صامتة.
 * ملاحظة: مجرد الاستيراد (require/import) لا يرمي شيئاً — الرمي عند الاستدعاء فقط.
 *
 * متى يُحذف هذا البديل؟
 * ---------------------
 * عند صدور إصدار مُرقَّع من `image-size` upstream (أي إصدار > 2.0.2 يعالج
 * GHSA-w3rx-r6r6-pgpr و GHSA-5p2g-fcmc-qvqq). حينها:
 *   1. احذف `"image-size"` من `dependencies` **و** من `overrides` في
 *      package.json الجذري (المدخلان معاً — انظر قسم "كيف رُبِط؟" أعلاه).
 *   2. احذف مجلد `tools/image-size-stub/` بالكامل.
 *   3. شغّل `npm install` ثم `npm audit --omit=dev` للتأكد، ثم `npm ci`
 *      (أو `npm ci --omit=dev`) للتأكد أن مسار النشر النظيف ما زال يعمل.
 *
 * ⚠️ عند أي ترقية لـ`pptxgenjs`: أعِد التحقق من النقطتين (2) و(4) أعلاه
 *    (`grep -r "image-size" node_modules/pptxgenjs/dist/`)، فقد يُعيد إصدار
 *    لاحق استيراد الحزمة فعلياً ويصبح هذا البديل يرمي في مسار حقيقي.
 * ============================================================================
 */

const REASON = [
  'image-size معطَّلة عمداً في هذا المشروع (حزمة بديلة محلية في tools/image-size-stub).',
  'السبب: ثغرتا DoS بلا إصدار مُرقَّع upstream — GHSA-w3rx-r6r6-pgpr و GHSA-5p2g-fcmc-qvqq.',
  'قياس أبعاد الصور غير مدعوم في هذا المسار.',
  'الوصول إلى هنا يعني مساراً غير متوقع (pptxgenjs لا يستورد image-size في المتصفح ولا في التوزيع المشحون) ويحتاج مراجعة.',
  'راجع التعليق في tools/image-size-stub/index.js.'
].join(' ')

function imageSize() {
  throw new Error(REASON)
}

module.exports = exports = imageSize // نفس شكل الأصل: كائن التصدير هو الدالة
exports.default = imageSize
exports.imageSize = imageSize
exports.disableFS = function disableFS() {}
exports.disableTypes = function disableTypes() {}
exports.setConcurrency = function setConcurrency() {}
exports.types = [
  'bmp',
  'cur',
  'dds',
  'gif',
  'heif',
  'icns',
  'ico',
  'j2c',
  'jp2',
  'jpg',
  'jxl',
  'jxl-stream',
  'ktx',
  'png',
  'pnm',
  'psd',
  'svg',
  'tga',
  'tiff',
  'webp'
]
