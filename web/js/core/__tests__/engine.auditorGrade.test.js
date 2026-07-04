/**
 * اختبارات ترقية «درجة المدقق» (البنود أ–ط):
 * مصالحة الطاقة، منحنى التصاعد، القيمة النهائية، الدورة النقدية،
 * الإهلاك النظامي، ضريبة القيمة المضافة، Tornado، ومعايير السائقين.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';
import { runQAChecks } from '../../utils/qaChecks.js';
import { detectSectorBenchmark, checkDriversAgainstBenchmarks } from '../sectorBenchmarks.js';

function makeStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { name: 'كافيه', sector: 'مقهى', businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ name: 'معدات', price: 100000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [{ position: 'مدير', count: 1, salary: 6000, months: 12, nationality: 'saudi' }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 10000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ service: 'مشروبات', type: 'operating', customersPerMonth: 3000, avgPrice: 22, variableCostRate: 0.32, growthRate: 0.05 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

const qaCodes = async (study, results) => {
    const qa = await runQAChecks(study, results);
    return [...(qa.softWarnings || []), ...(qa.hardErrors || [])].map(w => w.code);
};

describe('أ. مصالحة الطاقة', () => {
    it('خطة تتجاوز الطاقة القصوى = خطأ مانع', async () => {
        const study = makeStudy({
            [SECTIONS.TECHNICAL]: {
                equipment: [{ name: 'معدات', price: 100000, quantity: 1 }],
                buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [],
                capacityModel: [{ seats: 20, turnsPerDay: 3, daysPerMonth: 26 }] // = 1560 عميل/شهر
            }
        });
        const r = calculateStudy(study);
        expect(r.capacityCheck.maxUnitsPerMonth).toBe(1560);
        expect(r.capacityCheck.exceeded).toBe(true); // الخطة 3000 > 1560
        const qa = await runQAChecks(study, r);
        expect(qa.hardErrors.map(e => e.code)).toContain('CAPACITY_EXCEEDED');
        expect(qa.passed).toBe(false);
    });

    it('خطة ضمن الطاقة تمر بلا خطأ طاقة', async () => {
        const study = makeStudy({
            [SECTIONS.TECHNICAL]: {
                equipment: [{ name: 'معدات', price: 100000, quantity: 1 }],
                buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [],
                capacityModel: [{ seats: 40, turnsPerDay: 4, daysPerMonth: 26 }] // = 4160
            }
        });
        const r = calculateStudy(study);
        expect(r.capacityCheck.exceeded).toBe(false);
        expect(await qaCodes(study, r)).not.toContain('CAPACITY_EXCEEDED');
    });

    it('مبيعات كبيرة بلا نموذج طاقة أصلاً = تنبيه', async () => {
        const study = makeStudy();
        const r = calculateStudy(study);
        expect(await qaCodes(study, r)).toContain('CAPACITY_MODEL_MISSING');
    });
});

describe('ط. منحنى التصاعد (Ramp-Up)', () => {
    it('تصاعد 6 أشهر يخفض إيراد السنة الأولى دون سنة كاملة الخطة', () => {
        const full = calculateStudy(makeStudy());
        const ramped = calculateStudy(makeStudy({
            assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0, rampUpMonths: 6 }
        }));
        // معامل التصاعد الخطي لـ6 أشهر = (1/6+2/6+...+1+1×7)/12 ≈ 0.7917
        const expectedFactor = ramped.incomeStatement[0].revenue / full.incomeStatement[0].revenue;
        expect(expectedFactor).toBeCloseTo(0.7917, 3);
        // السنة الثانية لا تتأثر
        expect(ramped.incomeStatement[1].revenue).toBeCloseTo(full.incomeStatement[1].revenue, 4);
    });

    it('بلا تصاعد وبلا استغلال جزئي = تنبيه واقعية', async () => {
        const study = makeStudy();
        const r = calculateStudy(study);
        expect(await qaCodes(study, r)).toContain('NO_RAMP_UP');
    });
});

describe('ج. القيمة النهائية (Gordon)', () => {
    it('تُحسب استرشادياً ولا تغيّر NPV الأساسي', () => {
        const r = calculateStudy(makeStudy());
        expect(r.indicators.terminalValue).toBeGreaterThan(0);
        expect(r.indicators.npvWithTerminal).toBeCloseTo(r.indicators.npv + r.indicators.terminalValue, 4);
        // معادلة Gordon: آخر تدفق × (1+g) ÷ (r−g) مخصومة لسنوات الدراسة
        const lastCF = r.incomeStatement[4].cashFlow;
        const expected = (lastCF * 1.02) / (0.10 - 0.02) / Math.pow(1.10, 5);
        expect(r.indicators.terminalValue).toBeCloseTo(expected, 2);
    });

    it('method: none يعطّلها', () => {
        const r = calculateStudy(makeStudy({
            assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0, terminalValue: { method: 'none' } }
        }));
        expect(r.indicators.terminalValue).toBe(0);
        expect(r.indicators.npvWithTerminal).toBeCloseTo(r.indicators.npv, 6);
    });
});

describe('و. رأس المال العامل بالدورة النقدية (DSO/DIO/DPO)', () => {
    it('B2B بتحصيل آجل 60 يوماً يرفع رأس المال العامل عن نشاط الكاش', () => {
        const cash = calculateStudy(makeStudy());
        const b2b = calculateStudy(makeStudy({
            assumptions: {
                projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0,
                workingCapitalPolicy: { dsoDays: 60, dpoDays: 30, dioDays: 15 }
            }
        }));
        expect(b2b.cashCycle).toBeTruthy();
        // AR = إيراد×60/365، مخزون = متغيرة×15/365، موردون = متغيرة×30/365
        const rev1 = 3000 * 12 * 22;
        const vc1 = rev1 * 0.32;
        const expectedNet = Math.max(0, rev1 * 60 / 365 + vc1 * 15 / 365 - vc1 * 30 / 365);
        expect(b2b.cashCycle.net).toBeCloseTo(expectedNet, 0);
        expect(b2b.capex.workingCapital).toBeGreaterThan(cash.capex.workingCapital);
    });
});

describe('ز. ضريبة القيمة المضافة — توقيت نقدي', () => {
    it('صافي المستحق = 15% × (الإيراد − المدخلات الخاضعة)', () => {
        const r = calculateStudy(makeStudy());
        const v1 = r.vat.years[0];
        const y1 = r.incomeStatement[0];
        const bd = y1.fixedCostsBreakdown;
        expect(v1.outputVat).toBeCloseTo(y1.revenue * 0.15, 4);
        expect(v1.inputVat).toBeCloseTo((y1.variableCosts + bd.rentAndAdmin + bd.marketing) * 0.15, 4);
        expect(v1.netPayable).toBeCloseTo(Math.max(0, v1.outputVat - v1.inputVat), 4);
    });
});

describe('ح. Tornado — عزل المتغير المهيمن', () => {
    it('خمسة محاور مرتبة تنازلياً بحجم الأثر، والسعر أعنف من الثابتة', () => {
        const r = calculateStudy(makeStudy());
        expect(r.tornado.length).toBe(5);
        for (let i = 1; i < r.tornado.length; i++) {
            expect(r.tornado[i - 1].swing).toBeGreaterThanOrEqual(r.tornado[i].swing);
        }
        const byKey = Object.fromEntries(r.tornado.map(t => [t.key, t]));
        // السعر يضرب الإيراد كاملاً بلا تكلفة مقابلة → أثره أكبر من الثابتة
        expect(byKey.priceChange.swing).toBeGreaterThan(byKey.fixedChange.swing);
        // اتجاهات سليمة: رفع السعر يحسّن NPV ورفع الثابتة يضرّه
        expect(byKey.priceChange.npvHigh).toBeGreaterThan(byKey.priceChange.npvLow);
        expect(byKey.fixedChange.npvHigh).toBeLessThan(byKey.fixedChange.npvLow);
    });
});

describe('د. معايير السائقين القطاعية', () => {
    it('يكتشف قطاع المقاهي ويقبل tokens متعددة', () => {
        expect(detectSectorBenchmark('مقهى')).toBeTruthy();
        expect(detectSectorBenchmark('مشروع مطعم برجر')).toBeTruthy();
        expect(detectSectorBenchmark('')).toBeNull();
    });

    it('تكلفة متغيرة 10% لمقهى (خارج 28–45%) = تنبيه سائق منخفض', () => {
        const study = makeStudy({
            [SECTIONS.REVENUE]: {
                streams: [{ service: 'مشروبات', type: 'operating', customersPerMonth: 3000, avgPrice: 22, variableCostRate: 0.10, growthRate: 0.05 }]
            }
        });
        const r = calculateStudy(study);
        const warns = checkDriversAgainstBenchmarks(study, r);
        expect(warns.map(w => w.code)).toContain('BENCH_VC_RATE_LOW');
    });

    it('سائقون ضمن النطاق = لا تنبيهات معايير', () => {
        const study = makeStudy(); // VC 32%، إيجار 120k/792k≈15%، عمالة ضمن النطاق
        const r = calculateStudy(study);
        const warns = checkDriversAgainstBenchmarks(study, r);
        expect(warns.map(w => w.code)).not.toContain('BENCH_VC_RATE_LOW');
        expect(warns.map(w => w.code)).not.toContain('BENCH_VC_RATE_HIGH');
    });
});
