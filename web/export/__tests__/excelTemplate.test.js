/**
 * اختبار تكامل: تصدير Excel بالقالب المعياري ثم إعادة قراءته والتحقق من
 * فحوصات الاتساق التي فشل فيها ملف «النرجس» (تدقيق 2026-07-04):
 * كمية×سعر = الإجمالي، بنود قائمة الدخل تُجمع، IRR كنسبة لا كسر خام،
 * مصفوفة الحساسية معبأة فعلياً، ولا ورقة مراجعة داخلية تصل للعميل.
 */
import { vi, describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

let capturedBlob = null;
vi.mock('../utils.js', async (importOriginal) => {
    const orig = await importOriginal();
    return {
        ...orig,
        downloadBlob: (blob) => { capturedBlob = blob; }
    };
});

import { exportExcel } from '../excel.js';
import { calculateStudy } from '../../js/core/engine.js';
import { SECTIONS } from '../../js/core/schema.js';

const TEMPLATE_PATH = path.resolve(process.cwd(), 'assets/templates/excel/قالب_دراسة_الجدوى_المعياري.xlsx');

function makeCafeStudy() {
    return {
        id: 'test-cafe',
        [SECTIONS.PROJECT_INFO]: { id: 'test-cafe', name: 'كافيه اختبار الاتساق', businessModel: 'Independent', city: 'الرياض' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 5 },
        [SECTIONS.TECHNICAL]: {
            buildings: [{ name: 'تجهيز موقع', price: 300000, quantity: 1 }],
            equipment: [{ name: 'ماكينة قهوة', price: 85000, quantity: 1 }],
            furniture: [{ name: 'جلسات', price: 60000, quantity: 1 }],
            establishmentCosts: [{ name: 'تأسيس', amount: 20000 }],
            capacityUtilization: []
        },
        [SECTIONS.HR]: {
            positions: [
                { position: 'مدير', count: 1, salary: 8000, months: 12, nationality: 'saudi' },
                { position: 'باريستا', count: 2, salary: 4500, months: 12, nationality: 'expat' }
            ],
            healthInsurancePerHead: 1200,
            govtFees: { workCard: 9600, ticket: 2500, iqama: 650 }
        },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 15000 }] },
        [SECTIONS.MARKETING]: { campaigns: [{ name: 'تسويق', type: 'operating', monthly: 4000 }] },
        [SECTIONS.REVENUE]: {
            streams: [
                { service: 'مشروبات', type: 'operating', customersPerMonth: 4000, avgPrice: 22, variableCostRate: 0.30, growthRate: 0.05 },
                { service: 'حلويات', type: 'operating', customersPerMonth: 1500, avgPrice: 18, variableCostRate: 0.35, growthRate: 0.05 }
            ]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: {
            sources: { bankLoan: { amount: 300000, interestRate: 0.065, termYears: 5, gracePeriodMonths: 6 } }
        },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [{ name: 'رخصة بلدية', price: 5000, quantity: 1 }] }
    };
}

describe('تصدير Excel — اتساق الملف المُسلَّم للعميل', () => {
    let wb;
    let results;

    beforeAll(async () => {
        const templateBuf = fs.readFileSync(TEMPLATE_PATH);
        vi.stubGlobal('fetch', async () => ({
            ok: true,
            arrayBuffer: async () => templateBuf.buffer.slice(templateBuf.byteOffset, templateBuf.byteOffset + templateBuf.byteLength)
        }));

        const study = makeCafeStudy();
        results = calculateStudy(study);
        expect(results?.incomeStatement?.length).toBe(5);

        await exportExcel(study, results);
        expect(capturedBlob).toBeTruthy();

        const ExcelJS = (await import('exceljs')).default;
        wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await capturedBlob.arrayBuffer());
    }, 60000);

    const cellNum = (ws, addr) => {
        const v = ws.getCell(addr).value;
        if (v == null) return 0;
        if (typeof v === 'object' && v.result !== undefined) return Number(v.result) || 0;
        return Number(v) || 0;
    };

    it('الاستثمار الأولي: كمية × سعر = الإجمالي في كل صف (كان 1×500,000 = 380,000)', () => {
        const ws = wb.getWorksheet('الاستثمار_الأولي');
        [5, 6, 7, 8, 9, 12, 13, 14, 17].forEach(row => {
            const qty = cellNum(ws, `B${row}`);
            const unit = cellNum(ws, `C${row}`);
            const total = cellNum(ws, `D${row}`);
            expect(Math.abs(qty * unit - total)).toBeLessThanOrEqual(1);
        });
    });

    it('الاستثمار الأولي: مجموع الصفوف = إجمالي الاستثمار المطبوع', () => {
        const ws = wb.getWorksheet('الاستثمار_الأولي');
        const sum = [5, 6, 7, 8, 9, 12, 13, 14, 17].reduce((a, r) => a + cellNum(ws, `D${r}`), 0);
        expect(Math.abs(sum - cellNum(ws, 'D19'))).toBeLessThanOrEqual(2);
        expect(Math.abs(cellNum(ws, 'D19') - results.capex.total)).toBeLessThanOrEqual(1);
    });

    it('قائمة الدخل: بنود الثابتة تُجمع إلى الإجمالي (كانت أصفاراً بجانب إجمالي 425 ألفاً)', () => {
        const ws = wb.getWorksheet('قائمة_الدخل');
        ['B', 'C', 'D', 'E', 'F'].forEach(col => {
            const parts = [10, 11, 12, 13, 14, 15].reduce((a, r) => a + cellNum(ws, `${col}${r}`), 0);
            expect(Math.abs(parts - cellNum(ws, `${col}16`))).toBeLessThanOrEqual(1);
        });
    });

    it('قائمة الدخل: مجمل الربح − الثابتة − الفوائد = صافي قبل الزكاة، والزكاة تُخصم للصافي', () => {
        const ws = wb.getWorksheet('قائمة_الدخل');
        ['B', 'C', 'D', 'E', 'F'].forEach(col => {
            const gross = cellNum(ws, `${col}7`);
            const fixedTotal = cellNum(ws, `${col}16`);
            const interest = cellNum(ws, `${col}17`);
            const ebt = cellNum(ws, `${col}18`);
            const levy = cellNum(ws, `${col}19`);
            const net = cellNum(ws, `${col}20`);
            expect(Math.abs(gross - fixedTotal - interest - ebt)).toBeLessThanOrEqual(1);
            expect(Math.abs(ebt - levy - net)).toBeLessThanOrEqual(1);
        });
    });

    it('بند الزكاة/الضريبة في الملف يطابق زكاة المحرك (الوعاء النظامي) تماماً', () => {
        const ws = wb.getWorksheet('قائمة_الدخل');
        const levy = cellNum(ws, 'B19');
        const y1 = results.incomeStatement[0];
        expect(Math.abs(levy - (y1.zakat + y1.tax))).toBeLessThanOrEqual(1);
        // ولمشروع سعودي 100%: الزكاة = 2.5% من الوعاء النظامي المُصدَّر من المحرك
        expect(y1.tax).toBe(0);
        expect(y1.zakat).toBeCloseTo(y1.zakatBase * 0.025, 4);
    });

    it('المؤشرات: IRR كسر بتنسيق مئوي (لا يُقرأ 1.02%)', () => {
        const ws = wb.getWorksheet('مؤشرات_التقييم');
        const c = ws.getCell('B16');
        expect(String(c.numFmt)).toContain('%');
        expect(Number(c.value)).toBeCloseTo(results.indicators.irr, 4);
    });

    it('فائدة قائمة الدخل = فائدة جدول السداد المرفق (كانا يتناقضان)', () => {
        const wsIS = wb.getWorksheet('قائمة_الدخل');
        const wsLoan = wb.getWorksheet('جدول_سداد_القرض');
        expect(wsLoan).toBeTruthy();
        // فوائد السنة الأولى في القائمة (صف 17 يشمل الفوائد فقط هنا — لا امتياز/شراكة)
        const isInterestY1 = cellNum(wsIS, 'B17');
        const loanInterestY1 = cellNum(wsLoan, 'D9');
        expect(Math.abs(isInterestY1 - loanInterestY1)).toBeLessThanOrEqual(1);
    });

    it('تحليل الحساسية معبأ فعلياً (كان يصل فارغاً مع «يُملأ يدوياً»)', () => {
        const ws = wb.getWorksheet('تحليل_الحساسية');
        // الخلية المركزية (إيراد 0%، تكاليف 0%) = NPV الأساسي
        expect(cellNum(ws, 'D8')).toBeCloseTo(Math.round(results.indicators.npv), 0);
        // كل خلايا المصفوفة معبأة
        for (let r = 6; r <= 10; r++) {
            for (const c of ['B', 'C', 'D', 'E', 'F']) {
                expect(ws.getCell(`${c}${r}`).value).not.toBeNull();
            }
        }
        expect(String(ws.getCell('A13').value)).not.toContain('يجب ملء');
    });

    it('ورقة المراجعة الداخلية (خانات ☐ غير مؤشَّرة) لا تصل للعميل', () => {
        expect(wb.getWorksheet('قائمة_المراجعة')).toBeFalsy();
    });

    it('الافتراضات: نسب بتنسيق مئوي ولا كسور خام بضجيج عائم', () => {
        const ws = wb.getWorksheet('الافتراضات');
        ['B5', 'B6', 'B7', 'B18', 'B19'].forEach(addr => {
            expect(String(ws.getCell(addr).numFmt)).toContain('%');
        });
        // معدل الزكاة الفعلي لمشروع سعودي 100% = 2.5%
        expect(Number(ws.getCell('B6').value)).toBeCloseTo(0.025, 6);
    });

    it('الميزانية العمومية المرفقة متوازنة', () => {
        const ws = wb.getWorksheet('الميزانية_العمومية');
        expect(ws).toBeTruthy();
        for (let i = 0; i < 5; i++) {
            const col = String.fromCharCode(66 + i); // B..F
            const assets = cellNum(ws, `${col}6`);
            const liab = cellNum(ws, `${col}8`);
            const equity = cellNum(ws, `${col}11`);
            expect(Math.abs(assets - (liab + equity))).toBeLessThanOrEqual(2);
        }
    });
});
