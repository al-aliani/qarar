/**
 * استيراد بيانات أساسية من ملف CSV
 * المرحلة 4 — تكاملات متقدمة
 * الصيغة: الحقل,القيمة (UTF-8 with BOM)
 *
 * أمثلة على الحقول المدعومة:
 * projectInfo.name,اسم المشروع
 * projectInfo.city,الرياض
 * revenue.streams.0.customersPerMonth,500
 * revenue.streams.0.avgPrice,100
 */
const SUPPORTED_PATHS = [
    'projectInfo.name', 'projectInfo.city', 'projectInfo.description', 'projectInfo.concept',
    'projectInfo.district', 'projectInfo.areaSize',
    'assumptions.discountRate', 'assumptions.inflationRate', 'assumptions.taxRate',
    'assumptions.projectionYears', 'assumptions.currency',
    'revenue.streams.0.customersPerMonth', 'revenue.streams.0.avgPrice', 'revenue.streams.0.variableCostRate',
    'revenue.streams.0.type', 'revenue.streams.1.customersPerMonth', 'revenue.streams.1.avgPrice',
    'financing.sources.equity.amount', 'financing.sources.bankLoan.amount',
    'financing.sources.bankLoan.interestRate', 'financing.sources.bankLoan.termYears',
];

function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
    return lines.map(line => {
        const idx = line.indexOf(',');
        if (idx < 0) return [line.trim(), ''];
        const field = line.slice(0, idx).replace(/^"|"$/g, '').trim();
        const value = line.slice(idx + 1).replace(/^"|"$/g, '').replace(/""/g, '"').trim();
        return [field, value];
    });
}

/**
 * @param {string} csvText - محتوى CSV
 * @param {object} baseState - الحالة الأساسية (تُدمج معها)
 * @returns {{ success: boolean, data?: object, errors?: string[] }}
 */
export function importFromCSV(csvText, baseState = {}) {
    const errors = [];
    const updates = {};

    try {
        const rows = parseCSV(csvText);
        if (rows.length === 0) {
            return { success: false, errors: ['الملف فارغ أو بصيغة غير صحيحة'] };
        }

        for (let i = 0; i < rows.length; i++) {
            const [path, value] = rows[i];
            if (!path || path.trim() === '') continue;

            const cleanPath = path.trim();
            const cleanValue = value !== undefined ? String(value).replace(/^"|"$/g, '') : '';

            if (cleanPath.startsWith('#')) continue;

            const baseSection = cleanPath.split('.')[0];
            if (!['projectInfo', 'assumptions', 'revenue', 'financing', 'technical', 'hr', 'marketing', 'services'].includes(baseSection)) {
                continue;
            }

            try {
                const parts = cleanPath.split('.');
                let cur = updates;
                for (let j = 0; j < parts.length - 1; j++) {
                    const k = parts[j];
                    const next = parts[j + 1];
                    const isIdx = /^\d+$/.test(next);
                    if (!cur[k]) cur[k] = isIdx ? [] : {};
                    cur = cur[k];
                }
                const last = parts[parts.length - 1];
                const num = Number(cleanValue);
                cur[last] = (cleanValue !== '' && !Number.isNaN(num)) ? num : cleanValue;
            } catch (e) {
                errors.push(`سطر ${i + 1}: ${e.message}`);
            }
        }

        const merged = deepMerge(JSON.parse(JSON.stringify(baseState)), updates);
        return { success: errors.length === 0, data: merged, errors: errors.length ? errors : undefined };
    } catch (e) {
        return { success: false, errors: [e.message || 'فشل قراءة الملف'] };
    }
}

function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    Object.keys(source).forEach(k => {
        if (Array.isArray(source[k])) {
            target[k] = source[k];
        } else if (typeof source[k] === 'object' && source[k] !== null && typeof target[k] === 'object' && target[k] !== null) {
            target[k] = deepMerge({ ...target[k] }, source[k]);
        } else {
            target[k] = source[k];
        }
    });
    return target;
}

/**
 * إنشاء قالب CSV للاستيراد
 */
export function getCSVTemplate() {
    const rows = [
        ['# قالب استيراد بيانات دراسة الجدوى', ''],
        ['# احذف الأسطر التي تبدأ بـ # قبل الاستيراد', ''],
        ['# الحقل', 'القيمة'],
        ['projectInfo.name', 'مشروعي'],
        ['projectInfo.city', 'الرياض'],
        ['projectInfo.concept', 'مقهى'],
        ['assumptions.currency', 'SAR'],
        ['assumptions.discountRate', '0.1'],
        ['assumptions.projectionYears', '5'],
        ['revenue.streams.0.customersPerMonth', '500'],
        ['revenue.streams.0.avgPrice', '50'],
        ['revenue.streams.0.variableCostRate', '0.3'],
    ];
    return '\uFEFF' + rows.map(r => r.map(c => /[,"\n]/.test(c) ? `"${String(c).replace(/"/g, '""')}"` : c).join(',')).join('\r\n');
}
