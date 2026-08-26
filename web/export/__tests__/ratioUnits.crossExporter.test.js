/**
 * @vitest-environment jsdom
 *
 * مسح ليلة 2026-08-26: نسبة الدين إلى حقوق الملكية بوحدتين مختلفتين لنفس الدراسة.
 *
 * `debtToEquity` مضاعف بحكم تعريفه (core/financial/ratios.js: إجمالي الخصوم ÷ حقوق
 * الملكية)، فطبعه التقرير PDF «1.85x» بينما طبعته ورقة «المؤشرات» في Excel وجدول
 * النسب في Word «185.0%» — العميل يفتح الملفات الثلاثة معاً أمام جهة تمويل فيرى
 * رقمين تحت التسمية نفسها. السبب: كل مصدِّر كان يختار مُنسّقه محلياً.
 *
 * ما يثبّته الاختبار هو التطابق عبر المصدّرات لا قيمة مفردة: لكل نسبة، النص المطبوع
 * في PDF وWord وExcel واحد، وهو بالضبط ما يُنتجه المصدر الوحيد `formatRatio`؛ وكل
 * مفتاح ينتجه المحرك له وحدة معلَنة (فمصدِّر رابع لا يجد موضعاً يختلف فيه).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { RATIO_UNITS, formatRatio } from '../ratioUnits.js';
import { ExcelExporter } from '../excelExporter.js';
import { WordExporter } from '../wordExporter.js';
import { ReportGenerator } from '../../js/services/ReportGenerator.js';
import { calculateStudy } from '../../js/core/engine.js';
import { t } from '../../js/i18n/reportStrings.js';

const RATIO_LABELS = {
    currentRatio: 'current_ratio',
    quickRatio: 'quick_ratio',
    cashRatio: 'cash_ratio',
    debtRatio: 'debt_ratio',
    debtToEquity: 'debt_to_equity',
    assetTurnover: 'asset_turnover',
    fixedAssetTurnover: 'fixed_asset_turnover',
    roa: 'roa',
    roe: 'roe'
};

/** دراسة بقرض بنكي — حالة البلاغ: خصوم موجبة فـdebtToEquity رقم حقيقي. */
function leveragedStudy() {
    return {
        projectInfo: { name: 'مشروع بقرض بنكي', businessModel: 'Independent' },
        assumptions: { projectionYears: 3, discountRate: 0.1, inflationRate: 0 },
        technical: { equipment: [{ price: 900000, quantity: 1, life: 7 }], buildings: [], furniture: [], vehicles: [], establishmentCosts: [], capacityUtilization: [] },
        hr: { positions: [{ position: 'موظف', count: 2, salary: 6000, months: 12, nationality: 'saudi' }] },
        logistics: { logistics: [] },
        administrative: { administrative: [{ name: 'إيجار', monthly: 15000 }] },
        marketing: { campaigns: [] },
        revenue: { streams: [{ type: 'operating', customersPerMonth: 1500, avgPrice: 120, variableCostRate: 0.3, growthRate: 0 }] },
        services: { items: [] },
        financing: {
            sources: {
                equity: { amount: 400000, percentage: 40 },
                bankLoan: { amount: 600000, percentage: 60, interestRate: 0.08, termYears: 5, gracePeriodMonths: 0 }
            }
        },
        techResources: { techResources: [] },
        legal: { licenses: [] }
    };
}

let capturedBlob = null;

/** خلايا صفوف جدول docx نصّياً. */
function docxRows(table) {
    return table.root
        .filter((node) => node?.constructor?.name === 'TableRow')
        .map((row) => (row.root || []).slice(1).map((cell) => (collectText(cell)[0] || '').trim()));
}

function collectText(node, out = []) {
    if (node == null) return out;
    if (typeof node === 'string') { out.push(node); return out; }
    if (Array.isArray(node)) { node.forEach((n) => collectText(n, out)); return out; }
    if (typeof node === 'object') {
        if (typeof node.text === 'string') out.push(node.text);
        for (const key of ['root', 'children', 'options']) {
            if (node[key] !== undefined) collectText(node[key], out);
        }
    }
    return out;
}

/** خلية السنة الأولى في جدول النسب داخل تقرير PDF (HTML). */
function pdfRatioCell(html, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = html.match(new RegExp(`<tr><td>${escaped}</td>((?:<td>[^<]*</td>)+)</tr>`));
    if (!row) throw new Error(`لا صف «${label}» في جدول نسب تقرير PDF`);
    return [...row[1].matchAll(/<td>([^<]*)<\/td>/g)].map((m) => m[1].trim())[0];
}

describe('وحدة النسب المالية — تطابق PDF وWord وExcel', () => {
    beforeEach(() => {
        capturedBlob = null;
        global.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; });
        global.URL.revokeObjectURL = vi.fn();
    });

    it('كل مفتاح نسبة ينتجه المحرك له وحدة معلَنة في ratioUnits', () => {
        const results = calculateStudy(leveragedStudy());
        const engineKeys = Object.keys(results.ratios[0]).filter((k) => k !== 'year');
        expect(engineKeys.length).toBeGreaterThan(0);
        expect(engineKeys.filter((k) => !(k in RATIO_UNITS))).toEqual([]);
    });

    it('نفس الدراسة: كل نسبة تُطبع بالنص نفسه في المصدّرات الثلاثة', async () => {
        const study = leveragedStudy();
        const results = calculateStudy(study);
        const r1 = results.ratios[0];
        // شرط الحالة كما في البلاغ: قرض بنكي ⟶ debtToEquity مضاعف موجب
        expect(Number.isFinite(r1.debtToEquity)).toBe(true);
        expect(r1.debtToEquity).toBeGreaterThan(0);

        const pdfHtml = ReportGenerator.generateHTML({ getState: () => study });

        const wordRows = docxRows(new WordExporter({ getState: () => study }).createRatiosTable());

        const exporter = new ExcelExporter(study, results, { lang: 'ar' });
        await exporter.export('test');
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await capturedBlob.arrayBuffer());
        const excelRows = [];
        wb.getWorksheet('المؤشرات').eachRow((row) => excelRows.push(row.values.slice(1)));

        for (const key of Object.keys(RATIO_UNITS)) {
            const label = t(RATIO_LABELS[key], 'ar');
            const expected = formatRatio(key, r1[key]);

            const wordRow = wordRows.find((cells) => cells[0] === label);
            const excelRow = excelRows.find((cells) => cells[0] === label);
            expect(wordRow, `Word — ${label}`).toBeTruthy();
            expect(excelRow, `Excel — ${label}`).toBeTruthy();

            expect(pdfRatioCell(pdfHtml, label), `PDF — ${label}`).toBe(expected);
            expect(wordRow[1], `Word — ${label}`).toBe(expected);
            expect(String(excelRow[1]), `Excel — ${label}`).toBe(expected);
        }
    });

    it('نسبة الدين إلى حقوق الملكية مضاعف (x) في الثلاثة — لا نسبة مئوية', () => {
        const study = leveragedStudy();
        const de = calculateStudy(study).ratios[0].debtToEquity;
        expect(formatRatio('debtToEquity', de)).toBe(Number(de).toFixed(2) + 'x');
        expect(RATIO_UNITS.debtToEquity).toBe('multiple');
    });
});
