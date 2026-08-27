/**
 * @vitest-environment jsdom
 *
 * مسح ليلة 2026-08-26: صف «مصاريف التأسيس والتراخيص» في جدول CAPEX بالتقرير PDF كان
 * يقرأ results.capex.items — مفتاح لا ينتجه calculateStudy() إطلاقاً — فيطبع ٠ دائماً،
 * بينما المبلغ الحقيقي (capex.breakdown.licenses) مندسّ داخل subtotal المُعنون خطأً
 * «التجهيزات والمعدات». نفس الدراسة تعرض التراخيص صحيحة في Excel (excelExporter يسقط
 * عمداً إلى cap.breakdown عند غياب items).
 */
import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../ReportGenerator.js';
import { calculateStudy } from '../../core/engine.js';

/** يحوّل نص خلية بالأرقام العربية-الهندية إلى عدد. */
function cellToNumber(text) {
    const ascii = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
    const digits = ascii.replace(/[^\d-]/g, '');
    return digits === '' ? NaN : Number(digits);
}

/** يقرأ صفوف جدول التكاليف الاستثمارية بالترتيب: [{ label, value }, …]. */
function capexRows(html) {
    const host = document.createElement('div');
    host.innerHTML = html;
    return Array.from(host.querySelector('table').querySelectorAll('tbody tr')).map((tr) => {
        const [label, value] = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
        return { label, value: cellToNumber(value) };
    });
}

// دراسة البلاغ حرفياً: رخصتان (15,000 + 8,000) ومعدات 200,000.
function studyWithLicenses() {
    return {
        projectInfo: { name: 'دراسة التراخيص', businessModel: 'Independent' },
        assumptions: { projectionYears: 3, discountRate: 0.10, inflationRate: 0.02 },
        marketSizing: {},
        technical: { equipment: [{ price: 200000, quantity: 1 }], buildings: [], furniture: [], vehicles: [], establishmentCosts: [], capacityUtilization: [] },
        hr: { positions: [] },
        logistics: { logistics: [] },
        administrative: { administrative: [] },
        marketing: { campaigns: [] },
        revenue: { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.3, growthRate: 0 }] },
        services: { items: [] },
        financing: { sources: { equity: { amount: 300000, percentage: 100 } } },
        techResources: { techResources: [] },
        legal: { licenses: [{ name: 'رخصة بلدية', price: 15000, quantity: 1 }, { name: 'سجل تجاري', price: 8000, quantity: 1 }] }
    };
}

function renderCapex(study) {
    const results = calculateStudy(study);
    const section = ReportGenerator._renderSection('capex', study, results, {}, 1, 'ar');
    return { results, rows: capexRows(section.html) };
}

describe('ReportGenerator — جدول التكاليف الاستثمارية في PDF', () => {
    it('شرط البلاغ: المحرك يُنتج تراخيص 23,000 داخل subtotal ولا يُنتج capex.items إطلاقاً', () => {
        const results = calculateStudy(studyWithLicenses());
        expect(results.capex.items).toBeUndefined();
        expect(results.capex.breakdown.licenses).toBe(23000);
        expect(results.capex.subtotal).toBe(243000);
    });

    it('صف «مصاريف التأسيس والتراخيص» يطبع 23,000 لا ٠', () => {
        const { rows } = renderCapex(studyWithLicenses());
        const licenses = rows.find((r) => r.label.includes('التأسيس والتراخيص'));
        expect(licenses.value).toBe(23000);
    });

    it('صف الأصول الأول يطبع 220,000 لا 243,000 — التراخيص لم تعد مندسّة فيه', () => {
        const { rows } = renderCapex(studyWithLicenses());
        expect(rows[0].value).toBe(220000);
    });

    it('بنود الجدول تجمع إلى «إجمالي الاستثمار المطلوب» المطبوع', () => {
        const { rows } = renderCapex(studyWithLicenses());
        const total = rows[rows.length - 1];
        expect(total.label).toContain('إجمالي الاستثمار');
        const sum = rows.slice(0, -1).reduce((s, r) => s + r.value, 0);
        expect(sum).toBe(total.value);
    });

    it('التوازن يصمد مع مخزون افتتاحي — كان صف رأس المال العامل يُسقطه', () => {
        const study = studyWithLicenses();
        study.technical.openingInventory = 60000;
        const { results, rows } = renderCapex(study);
        expect(results.capex.openingInventory).toBe(60000);
        const total = rows[rows.length - 1];
        const sum = rows.slice(0, -1).reduce((s, r) => s + r.value, 0);
        expect(sum).toBe(total.value);
    });
});
