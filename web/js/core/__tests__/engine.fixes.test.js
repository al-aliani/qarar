/**
 * اختبارات إصلاحات تدقيق 2026-07-04 (engine v5.0)
 * تثبّت: فصل الزكاة عن الضريبة، فائدة PMT، الاسترداد غير المحقق = null،
 * نمو لكل مصدر، الإيرادات غير التشغيلية، GOSI حسب الجنسية، تعادل الوحدات.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';
import { computeLoanSchedule } from '../../../../lib/calc/loanSchedule.js';

function makeStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: {
            projectionYears: 5,
            discountRate: 0.10,
            inflationRate: 0.02,
            hiddenOverheadsRate: 0
        },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 100000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

describe('الزكاة والضريبة — فصل الحصص', () => {
    it('مشروع سعودي 100%: زكاة 2.5% من EBT بالضبط وضريبة = 0', () => {
        const r = calculateStudy(makeStudy());
        const y1 = r.incomeStatement[0];
        expect(y1.tax).toBe(0);
        expect(y1.zakat).toBeCloseTo(Math.max(0, y1.ebt) * 0.025, 6);
    });

    it('ملكية أجنبية 40%: زكاة على 60% وضريبة 20% على 40%', () => {
        const r = calculateStudy(makeStudy({
            assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0, foreignOwnershipRate: 0.4, taxRate: 0.20 }
        }));
        const y1 = r.incomeStatement[0];
        const base = Math.max(0, y1.ebt);
        expect(y1.zakat).toBeCloseTo(base * 0.025 * 0.6, 6);
        expect(y1.tax).toBeCloseTo(base * 0.20 * 0.4, 6);
    });

    it('الاقتطاع السعودي 100% أقل بكثير من نظام الازدواج القديم (~17%)', () => {
        const r = calculateStudy(makeStudy());
        const y1 = r.incomeStatement[0];
        const totalLevy = y1.zakat + y1.tax;
        expect(totalLevy / Math.max(1, y1.ebt)).toBeLessThan(0.03);
    });
});

describe('القرض — جدول PMT موحّد', () => {
    const loanStudy = makeStudy({
        [SECTIONS.FINANCING]: {
            sources: { bankLoan: { amount: 300000, interestRate: 0.065, termYears: 5, gracePeriodMonths: 6 } }
        }
    });

    it('فائدة قائمة الدخل = فائدة جدول السداد المصدَّر لكل سنة', () => {
        const r = calculateStudy(loanStudy);
        const ls = computeLoanSchedule(300000, 0.065, 5, 6);
        r.incomeStatement.forEach((y, idx) => {
            const expected = ls.annualSummary.find(s => s.year === idx + 1)?.totalInterest || 0;
            expect(y.interest).toBeCloseTo(expected, 4);
        });
    });

    it('أقساط الأصل في التدفق = أصل جدول السداد', () => {
        const r = calculateStudy(loanStudy);
        const ls = computeLoanSchedule(300000, 0.065, 5, 6);
        r.incomeStatement.forEach((y, idx) => {
            const expected = ls.annualSummary.find(s => s.year === idx + 1)?.totalPrincipal || 0;
            expect(y.loanPrincipalPaid).toBeCloseTo(expected, 4);
        });
    });
});

describe('فترة الاسترداد غير المحققة', () => {
    it('مشروع خاسر: paybackPeriod = null وليس 0، والقرار NO-GO', () => {
        const r = calculateStudy(makeStudy({
            [SECTIONS.REVENUE]: {
                streams: [{ type: 'operating', customersPerMonth: 10, avgPrice: 10, variableCostRate: 0.9, growthRate: 0 }]
            },
            [SECTIONS.HR]: { positions: [{ position: 'مدير', count: 1, salary: 10000, months: 12, nationality: 'saudi' }] }
        }));
        expect(r.indicators.paybackPeriod).toBeNull();
        expect(r.decision).toBe('NO-GO');
    });
});

describe('نمو الإيرادات لكل مصدر', () => {
    it('growthRate = 0.15 يرفع إيراد السنة الثانية 15% (كان 5% مصمتاً)', () => {
        const r = calculateStudy(makeStudy({
            [SECTIONS.REVENUE]: {
                streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.30, growthRate: 0.15 }]
            }
        }));
        const [y1, y2] = r.incomeStatement;
        expect(y2.revenue / y1.revenue).toBeCloseTo(1.15, 3);
    });
});

describe('الإيرادات غير التشغيلية مع وجود خدمات', () => {
    it('إيجار غير تشغيلي يُحسب حتى مع امتلاء قسم الخدمات (كان يُهمل)', () => {
        const withNonOp = calculateStudy(makeStudy({
            [SECTIONS.SERVICES]: {
                items: [{ name: 'قهوة', pricePerUnit: 20, variableCostPerUnit: 6, customersPerMonth: 2000, growthRate: 0 }]
            },
            [SECTIONS.REVENUE]: {
                streams: [{ type: 'non-operating', customersPerMonth: 1, avgPrice: 60000, growthRate: 0 }]
            }
        }));
        const without = calculateStudy(makeStudy({
            [SECTIONS.SERVICES]: {
                items: [{ name: 'قهوة', pricePerUnit: 20, variableCostPerUnit: 6, customersPerMonth: 2000, growthRate: 0 }]
            },
            [SECTIONS.REVENUE]: { streams: [] }
        }));
        const diff = withNonOp.incomeStatement[0].revenue - without.incomeStatement[0].revenue;
        expect(diff).toBeCloseTo(60000 * 12, 0);
    });
});

describe('GOSI حسب الجنسية + رسوم الوافدين', () => {
    it('موظف سعودي أغلى تأمينات من وافد لكن الوافد يحمل رسوماً حكومية', () => {
        const saudi = calculateStudy(makeStudy({
            [SECTIONS.HR]: {
                positions: [{ position: 'شيف', count: 1, salary: 5000, months: 12, nationality: 'saudi' }],
                healthInsurancePerHead: 0,
                govtFees: { workCard: 9600, ticket: 2500, iqama: 650 }
            }
        }));
        const expat = calculateStudy(makeStudy({
            [SECTIONS.HR]: {
                positions: [{ position: 'شيف', count: 1, salary: 5000, months: 12, nationality: 'expat' }],
                healthInsurancePerHead: 0,
                govtFees: { workCard: 9600, ticket: 2500, iqama: 650 }
            }
        }));
        const salaries = 5000 * 12;
        const saudiCost = salaries * 1.1175;
        const expatCost = salaries * 1.02 + (9600 + 2500 + 650);
        // opex.fixedAnnual يشمل +2500 رسوماً حكومية تقديرية للمنشأة (ثابتة في الحالتين)
        expect(saudi.opex.fixedAnnual - expat.opex.fixedAnnual).toBeCloseTo(saudiCost - expatCost, 0);
    });
});

describe('تعادل الوحدات — أساس موحد', () => {
    it('استغلال 50% في السنة الأولى لا يغيّر هامش المساهمة للوحدة', () => {
        const full = calculateStudy(makeStudy());
        const half = calculateStudy(makeStudy({
            [SECTIONS.TECHNICAL]: {
                equipment: [{ price: 100000, quantity: 1 }],
                buildings: [], furniture: [], establishmentCosts: [],
                capacityUtilization: [{ year: 1, rate: 0.5 }]
            }
        }));
        // نقطة التعادل بالوحدات (ثابتة/هامش الوحدة) يجب ألا تتضاعف بمجرد خفض الاستغلال
        expect(half.indicators.breakEvenUnits).toBeCloseTo(full.indicators.breakEvenUnits, 0);
    });
});

describe('نسبة التوطين (السعودة) — مخرج جديد للمحرك', () => {
    it('تُحسب من جنسيات الوظائف وتُعاد في النتائج', () => {
        const r = calculateStudy(makeStudy({
            [SECTIONS.HR]: {
                positions: [
                    { position: 'مدير', count: 1, salary: 8000, months: 12, nationality: 'saudi' },
                    { position: 'باريستا', count: 3, salary: 4500, months: 12, nationality: 'expat' }
                ]
            }
        }));
        expect(r.saudization).toEqual({ saudiHeads: 1, totalHeads: 4, rate: 0.25 });
    });

    it('بلا موظفين: rate = null (لا قسمة على صفر)', () => {
        const r = calculateStudy(makeStudy());
        expect(r.saudization.rate).toBeNull();
    });
});

describe('استيفاء استغلال الطاقة', () => {
    it('سنة غير معرفة بين سنتين تُستوفى خطياً (كانت تقفز إلى 100%)', () => {
        const r = calculateStudy(makeStudy({
            [SECTIONS.TECHNICAL]: {
                equipment: [{ price: 100000, quantity: 1 }],
                buildings: [], furniture: [], establishmentCosts: [],
                capacityUtilization: [{ year: 1, rate: 0.5 }, { year: 3, rate: 0.9 }]
            }
        }));
        expect(r.incomeStatement[1].utilizationRate).toBeCloseTo(0.7, 6);
    });
});
