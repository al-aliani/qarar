/**
 * Shared export utilities: sanitization, XLSX loader, date/num helpers.
 * Used by excelExporter, sectionExporter, csvExporter, and other export modules.
 */
import { formatIrrPct } from '../js/utils/indicatorFormat.js';


/**
 * @param {string} [name]
 * @returns {string} Excel-safe sheet name (max 31 chars, no \\ / * ? : [ ])
 */
export function sanitizeSheetName(name) {
    return String(name || 'Sheet')
        .replace(/[\\/*?:\[\]]/g, '')
        .substring(0, 31)
        .trim() || 'Sheet';
}

/** @returns {string} تاريخ ووقت التصدير بتنسيق ar-SA (متوسط + قصير) */
export function formatExportDateTime() {
    try {
        return new Date().toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        const d = new Date();
        return d.toLocaleDateString('ar-SA') + ' ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    }
}

/** @returns {string} تاريخ التصدير بصيغة YYYY-MM-DD (التاريخ المحلي) لاستخدامه في أسماء الملفات */
export function exportDateISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * @param {unknown} v
 * @returns {number} قيمة رقمية آمنة (0 عند NaN/undefined)
 */
export function safeNum(v) {
    return v != null && Number.isFinite(Number(v)) ? Number(v) : 0;
}

/**
 * كسر (من المحرك: 0.155 = 15.5%) → نسبة للنشر.
 * لا «تخمين ذكي»: التخمين القديم (n > 1 ? n/100 : n) كان يحوّل IRR حقيقياً
 * قدره 1.3 (أي 130%) إلى «1.3%» في ملف Excel المُسلَّم للعميل.
 * كل مؤشرات المحرك كسور دائماً — نضرب في 100 فقط.
 * @param {unknown} v
 * @returns {number} نسبة للنشر (0.155 → 15.5)
 */
export function safePct(v) {
    const n = v != null && Number.isFinite(Number(v)) ? Number(v) : 0;
    return n * 100;
}

/**
 * فترة الاسترداد للنشر: null/0/Infinity = غير قابل للاسترداد — لا «0.0 سنة» أبداً.
 * @param {unknown} v
 * @returns {string}
 */
export function safePayback(v) {
    const n = v != null && Number.isFinite(Number(v)) ? Number(v) : null;
    if (n == null || n <= 0) return 'غير قابل للاسترداد خلال فترة الدراسة';
    return n.toFixed(1) + ' سنة';
}

/**
 * نصّ النسبة الأمين: كسر → «15.5%»، لكن null/غير منتهٍ → «غير محقق» (لا «0.0%» كاذبة).
 * تدقيق جولة الموقع 2026-07-20 (بند #1/#13): safePct تُرجع 0 للغائب فتُظهر IRR غير
 * محقّق كأنه عائد حقيقي 0%. يفوّض للمصدر الموحّد formatIrrPct. صفر حقيقي يبقى «0.0%».
 */
export function safePctText(v, digits = 1) {
    return formatIrrPct(v, digits);
}

/**
 * نقطة تعادل بالريال للنشر: تفرّق بين صفرَين متعاكسين بعلَمَي المحرك الصريحين
 * (engine.js) بدل طباعة رقم مبهم — نمط موحّد كان مطبَّقاً في excelExporter.js
 * فقط (السطور 555-559) بينما تقارير Bank/ProfessionalReview/Monshaat استمرت
 * تطبع `fmt(ind.breakEvenPointValue || 0)` الساذجة: مشروع يخسر على كل وحدة
 * (هامش مساهمة سالب، لا نقطة تعادل له أصلاً) كان يظهر «0 ريال» — أفضل قراءة
 * ممكنة لأسوأ مشروع ممكن.
 * @param {{breakEvenAchievable?: boolean, breakEvenReason?: string, breakEvenPointValue?: unknown}} ind مؤشرات المحرك
 * @param {(v: unknown) => string} fmt مُنسِّق العملة الخاص بالتقرير (formatCurrency المُقيَّد بعملته)
 * @param {() => string} [onMissing] بديل عند غياب breakEvenPointValue فعلياً (لا 0/سالب — غياب حقيقي)؛ الافتراضي fmt(0) كالسلوك السابق
 * @returns {string}
 */
export function formatBreakEvenValue(ind, fmt, onMissing) {
    if (ind?.breakEvenAchievable === false) return 'غير قابل للتعادل — هامش المساهمة سالب';
    if (ind?.breakEvenReason === 'covered_by_non_operating') {
        return 'محقق عند صفر وحدات — الإيراد غير التشغيلي يغطي كل التكاليف الثابتة';
    }
    if (ind?.breakEvenPointValue == null) return onMissing ? onMissing() : fmt(0);
    return fmt(Number(ind.breakEvenPointValue));
}

/** {@see safeNum} {@see safePct} {@see safePayback} {@see safePctText} {@see formatBreakEvenValue} */
export const SAFE = { num: safeNum, pct: safePct, payback: safePayback, pctText: safePctText, breakeven: formatBreakEvenValue };

/**
 * @param {unknown} v
 * @returns {string} تنسيق DSCR: رقم خانتين أو "—" عند الغياب
 */
export function formatDscr(v) {
    return v != null && Number.isFinite(Number(v)) ? safeNum(v).toFixed(2) : '—';
}

/**
 * القالب المعياري (xlsx) الموزَّع فعلياً مُقيَّد فيزيائياً: صفحة تقدير_الإيرادات
 * فيها 3 صفوف منتج/خدمة فقط (بمعادلة SUM ثابتة النطاق)، وكل صفحة (تقدير_الإيرادات/
 * قائمة_الدخل/مؤشرات_التقييم) فيها 5 أعمدة سنوات فقط، مع معادلات NPV/IRR بنطاق
 * ثابت مكتوب داخل الملف الثنائي نفسه. إدراج صفوف/أعمدة إضافية برمجياً لا يُمدِّد
 * هذه المعادلات تلقائياً — لذا عند تجاوز الدراسة لهذه السعة يجب التحويل لمسار
 * التصدير الديناميكي (excelExporter.js) بدل قصّ البيانات صامتاً في القالب الثابت.
 * @param {{incomeStatement?: unknown[]}} [results]
 * @param {{revenue?: {streams?: unknown[]}}} [state]
 * @returns {{exceedsTemplateCapacity: boolean, yearsCount: number, streamsCount: number}}
 */
export function selectExcelExportPath(results, state) {
    const yearsCount = results?.incomeStatement?.length || 0;
    const streamsCount = (state?.revenue?.streams || []).length;
    const exceedsTemplateCapacity = yearsCount > 5 || streamsCount > 3;
    return { exceedsTemplateCapacity, yearsCount, streamsCount };
}

/**
 * @param {string} [s]
 * @returns {string} Safe filename (no path chars, spaces → underscores, متتالية الشرطات → شرطة واحدة)
 */
export function sanitizeFilename(s) {
    return String(s || '')
        .replace(/[\\/*?:"<>|\s]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .trim() || 'export';
}

/**
 * تنزيل Blob كملف (إلحاق <a>، نقر، إزالة، إبطال الرابط بعد 200ms).
 * @param {Blob} blob - المحتوى المراد تنزيله
 * @param {string} filename - اسم الملف المُقترح
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    try {
        window.dispatchEvent(new CustomEvent('feasibility:download', {
            detail: {
                filename,
                mimeType: blob?.type || '',
                size: blob?.size || 0
            }
        }));
    } catch (_) {
        // Non-browser test runners may not expose CustomEvent/window fully.
    }
    setTimeout(() => URL.revokeObjectURL(url), 200);
}

/** بيانات تعريف موحّدة لكل صيغ التصدير. */
export function getExportMetadata(state, exportedAt = new Date()) {
    const project = state?.projectInfo || {};
    const dateText = (value) => {
        if (!value) return 'غير محدد';
        try { return new Date(value).toLocaleDateString('ar-SA'); } catch (_) { return 'غير محدد'; }
    };
    return {
        projectName: String(project.name || project.projectName || 'دراسة جدوى').trim(),
        studyId: state?.id || project.id || '',
        studyVersion: String(state?.version || '4.0.0'),
        exportVersion: '1.0',
        createdAt: dateText(state?.createdAt),
        updatedAt: dateText(state?.updatedAt),
        exportedAt: exportedAt instanceof Date ? exportedAt.toLocaleString('ar-SA') : String(exportedAt || ''),
    };
}

let _xlsxLoadPromise = null;

/**
 * تأكيد جاهزية واجهة Excel المتوافقة مع SheetJS على window.XLSX — عبر استيراد
 * ديناميكي، ولا يُحمَّل إلا عند أول استدعاء فعلي للتصدير (lazy) حتى لا يُثقِل الحزمة
 * الأساسية. الاسم القديم أُبقي عليه للتوافق مع كل استدعاءات excelExporter.js/
 * sectionExporter.js التي تستخدم المتغيّر العام `XLSX` مباشرة.
 * تدقيق 2026-07-08 (ملاحظة أمنية عالية #45): كانت تستورد حزمة `xlsx` مباشرة —
 * بها ثغرة Prototype Pollution عالية الخطورة (CVSS 7.8) بلا إصلاح متاح عبر سجل
 * npm. استُبدلت بـ xlsxShim.js (مبني على exceljs الآمنة، بنفس واجهة الاستخدام
 * الفعلية هنا فقط: book_new/aoa_to_sheet/book_append_sheet/writeFile).
 * @returns {Promise<void>}
 */
export function loadXLSX() {
    if (typeof globalThis.XLSX !== 'undefined') return Promise.resolve();
    if (_xlsxLoadPromise) return _xlsxLoadPromise;
    _xlsxLoadPromise = import('./xlsxShim.js')
        .then(({ utils, writeFile }) => { globalThis.XLSX = { utils, writeFile }; })
        .catch((e) => {
            _xlsxLoadPromise = null; // اسمح بإعادة المحاولة عند فشل التحميل
            throw new Error('تعذّر تحميل مكتبة Excel (XLSX): ' + (e?.message || e));
        });
    return _xlsxLoadPromise;
}
