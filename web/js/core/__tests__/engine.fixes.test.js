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

describe('الزكاة والضريبة — الوعاء النظامي (ZATCA) وفصل الحصص', () => {
    it('مشروع سعودي 100%: زكاة 2.5% من الوعاء النظامي وضريبة = 0', () => {
        const r = calculateStudy(makeStudy());
        const y1 = r.incomeStatement[0];
        expect(y1.tax).toBe(0);
        // الوعاء = max(الربح المعدل، مصادر الأموال) — والربح المعدل = EBT + إهلاك دفتري − إهلاك نظامي
        expect(y1.adjustedProfit).toBeCloseTo(y1.ebt + y1.depreciation - y1.taxDepreciation, 6);
        expect(y1.zakatBase).toBeGreaterThanOrEqual(Math.max(0, y1.adjustedProfit) - 1e-6);
        expect(y1.zakat).toBeCloseTo(y1.zakatBase * 0.025, 6);
    });

    it('الإهلاك النظامي متناقص: سنة 1 أعلى من سنة 2 (25% على المعدات)', () => {
        const r = calculateStudy(makeStudy());
        const [y1, y2] = r.incomeStatement;
        expect(y1.taxDepreciation).toBeGreaterThan(y2.taxDepreciation);
        expect(r.depreciationSchedules.tax[0]).toBeCloseTo(y1.taxDepreciation, 6);
    });

    it('ملكية أجنبية 40%: زكاة على 60% من الوعاء وضريبة 20% على 40% من الربح المعدل', () => {
        const r = calculateStudy(makeStudy({
            assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0, foreignOwnershipRate: 0.4, taxRate: 0.20 }
        }));
        const y1 = r.incomeStatement[0];
        expect(y1.zakat).toBeCloseTo(y1.zakatBase * 0.025 * 0.6, 6);
        expect(y1.tax).toBeCloseTo(Math.max(0, y1.adjustedProfit) * 0.20 * 0.4, 6);
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
        // GOSI السعودي للمشترك الجديد (النظام الجديد 2024) ≈ 12.75% — انظر SAUDI_GOSI_RATE_2026 في المحرك
        const saudiCost = salaries * 1.1275;
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

describe('حراس قرار التمويل', () => {
    it('لا يعطي GO عند وجود فجوة تمويل موجبة حتى لو كانت المؤشرات المالية جذابة', () => {
        const r = calculateStudy(makeStudy({
            [SECTIONS.TECHNICAL]: {
                equipment: [{ price: 900000, quantity: 1 }],
                buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
            },
            [SECTIONS.REVENUE]: {
                streams: [{ type: 'operating', customersPerMonth: 2500, avgPrice: 150, variableCostRate: 0.20, growthRate: 0.15 }]
            },
            [SECTIONS.FINANCING]: {
                sources: {
                    equity: { amount: 100000 },
                    bankLoan: { amount: 100000, interestRate: 0.08, termYears: 5, gracePeriodMonths: 6 }
                }
            }
        }));

        expect(r.financingCheck.fundingGap).toBeGreaterThan(0);
        expect(r.decision).not.toBe('GO');
        expect(r.decisionReasons.some(reason => reason.includes('مصادر التمويل'))).toBe(true);
    });

    it('يخفض القرار عند وجود قرض لا تغطيه EBITDA السنة الأولى حسب DSCR المستهدف', () => {
        const r = calculateStudy(makeStudy({
            [SECTIONS.REVENUE]: {
                streams: [{ type: 'operating', customersPerMonth: 300, avgPrice: 100, variableCostRate: 0.25, growthRate: 0.50 }]
            },
            [SECTIONS.HR]: {
                positions: [{ position: 'Team', count: 4, salary: 12000, months: 12, nationality: 'saudi' }]
            },
            [SECTIONS.FINANCING]: {
                targetDSCR: 1.5,
                sources: {
                    equity: { amount: 700000 },
                    bankLoan: { amount: 500000, interestRate: 0.085, termYears: 5, gracePeriodMonths: 6 }
                }
            }
        }));

        expect(r.indicators.dscr).toBeNull();
        expect(r.decision).not.toBe('GO');
        expect(r.decisionReasons.some(reason => reason.includes('تغطية خدمة الدين'))).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// تدقيق 2026-07-08 — بنود المحرك الثلاثة
// ─────────────────────────────────────────────────────────────────────────────

describe('DSCR على CFADS لا EBITDA خام (البند 1)', () => {
    const loanStudy = makeStudy({
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 120, variableCostRate: 0.30, growthRate: 0 }]
        },
        [SECTIONS.FINANCING]: {
            sources: { bankLoan: { amount: 300000, interestRate: 0.065, termYears: 5, gracePeriodMonths: 6 } }
        }
    });

    it('DSCR الجديد أقل من DSCR القديم (EBITDA/خدمة الدين) لأن CFADS < EBITDA', () => {
        const r = calculateStudy(loanStudy);
        const ls = computeLoanSchedule(300000, 0.065, 5, 6);
        const y1 = r.incomeStatement[0];
        const debtService = ls.annualSummary.find(s => s.year === 1)?.totalPayment || 0;

        // الاقتطاع النقدي فعلي: زكاة/ضريبة أو إحلال > 0 حتى يكون الفرق ملموساً
        expect((y1.levy || 0) + (y1.replacementCost || 0)).toBeGreaterThan(0);

        const oldDscr = y1.ebitda / debtService;            // البسط الخاطئ القديم
        const cfads = y1.ebitda - y1.levy - y1.replacementCost;
        const expectedNewDscr = cfads / debtService;         // البسط الصحيح CFADS

        const newDscr = r.dscrAnalysis[0].dscr;
        expect(newDscr).toBeCloseTo(Number(expectedNewDscr.toFixed(2)), 2);
        expect(newDscr).toBeLessThan(oldDscr);               // CFADS < EBITDA ⇒ تغطية أدنى
    });

    it('لا قرض ⇒ DSCR = null (لا يكسر)', () => {
        const r = calculateStudy(makeStudy());
        expect(r.indicators.dscr).toBeNull();
    });
});

describe('إطفاء التأسيس مقصوص بعمره (البند 2)', () => {
    it('أفق 10 سنوات ⇒ مجموع إطفاء التأسيس ≤ 100% من كلفته (لا 200%)', () => {
        const cost = 100000;
        const r = calculateStudy(makeStudy({
            assumptions: { projectionYears: 10, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
            // فقط تكاليف تأسيس — لا أصول أخرى — كي يساوي الإهلاك الدفتري إطفاءَ التأسيس بالضبط
            [SECTIONS.TECHNICAL]: {
                equipment: [], buildings: [], furniture: [], vehicles: [],
                establishmentCosts: [{ amount: cost, amortizationRate: 0.20 }],
                capacityUtilization: []
            }
        }));
        const totalAmort = r.incomeStatement.reduce((a, y) => a + y.depreciation, 0);
        expect(totalAmort).toBeLessThanOrEqual(cost + 1e-6);        // ≤ 100% لا 200%
        expect(totalAmort).toBeCloseTo(cost, 4);                    // بالضبط 100% (5×20%)
        // السنوات 6-10 بلا إطفاء تأسيس (استُنفد العمر)
        expect(r.incomeStatement[9].depreciation).toBeCloseTo(0, 6);
        expect(r.incomeStatement[0].depreciation).toBeCloseTo(cost * 0.20, 6);
    });
});

describe('ترابط الميزانية العمومية (articulation) + قرض بلا فوائد', () => {
    // أفق 7 سنوات مع أصل عمره 4 سنوات (25%) كي نتجاوز نقطة استنفاد الإهلاك حيث كانت تنكسر
    const artStudy = makeStudy({
        assumptions: { projectionYears: 7, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 40000, quantity: 1, depreciationRate: 0.25 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.FINANCING]: { sources: { bankLoan: { amount: 80000, interestRate: 0.06, termYears: 5 } } }
    });

    it('كل سنة من سنوات الأفق (1..7) تُنتج ميزانية متوازنة (Assets = L + E + gap)', () => {
        const r = calculateStudy(artStudy);
        expect(r.balanceSheets.length).toBe(7);
        r.balanceSheets.forEach(bs => {
            expect(bs.isBalanced, `السنة ${bs.year} غير متوازنة بفرق ${bs.imbalance}`).toBe(true);
        });
    });

    it('مجمع الإهلاك في الميزانية = مجموع إهلاك قائمة الدخل الفعلي حتى تلك السنة (لا معدل ثابت)', () => {
        const r = calculateStudy(artStudy);
        r.balanceSheets.forEach(bs => {
            const expectedAccDep = r.incomeStatement
                .slice(0, bs.year)
                .reduce((s, y) => s + (y.depreciation || 0), 0);
            expect(bs.assets.fixed.accumulatedDepreciation).toBeCloseTo(Math.round(expectedAccDep), 0);
        });
    });

    it('قرض بفائدة 0% (تمويل حكومي) لا يُفرض عليه 8% ضمنياً: إجمالي الفوائد = 0', () => {
        const zero = calculateStudy(makeStudy({
            [SECTIONS.FINANCING]: { sources: { bankLoan: { amount: 100000, interestRate: 0, termYears: 5 } } }
        }));
        const totalInterest = zero.incomeStatement.reduce((s, y) => s + (y.interest || 0), 0);
        expect(totalInterest).toBeCloseTo(0, 6);
    });
});

describe('السيناريوهات تقرأ مدخلات المستخدم (لا أرقام مثبتة)', () => {
    it('تعديل السيناريو المتفائل في المخطط ينعكس على مخرجات المحرك', () => {
        const withUserScenario = makeStudy({
            [SECTIONS.SCENARIOS]: {
                optimistic: { revenueChange: 0.50, costChange: -0.05 },
                pessimistic: { revenueChange: -0.30, costChange: 0.20 }
            }
        });
        const rUser = calculateStudy(withUserScenario);
        const rDefault = calculateStudy(makeStudy());
        // متفائل بنمو إيراد 50% يجب أن يعطي NPV أعلى من الافتراضي (25%)
        expect(rUser.scenarios.optimistic.kpis.npv).toBeGreaterThan(rDefault.scenarios.optimistic.kpis.npv);
    });
});

describe('أنواع سداد القرض (repaymentType): متناقص ودفعة أخيرة يعملان فعلياً', () => {
    const amt = 300000, rate = 0.08, years = 5;

    it('متناقص: أصل شهري ثابت وفوائد إجمالية أقل من متساوي الأقساط', () => {
        const equal = computeLoanSchedule(amt, rate, years, 0, 'equal');
        const declining = computeLoanSchedule(amt, rate, years, 0, 'declining');
        expect(declining.schedule[0].principal).toBeCloseTo(declining.schedule[30].principal, 0);
        expect(declining.totalInterest).toBeLessThan(equal.totalInterest);
        expect(declining.schedule.at(-1).balance).toBe(0);
    });

    it('دفعة أخيرة (bullet): لا أصل قبل الشهر الأخير، وكامل الأصل في الشهر الأخير', () => {
        const bullet = computeLoanSchedule(amt, rate, years, 0, 'bullet');
        expect(bullet.schedule.slice(0, -1).every(m => m.principal === 0)).toBe(true);
        expect(bullet.schedule.at(-1).principal).toBeCloseTo(amt, 0);
        expect(bullet.schedule.at(-1).balance).toBe(0);
    });

    it('متناقص مع فترة سماح: لا أصل خلال السماح، ويبدأ بعده مباشرة', () => {
        const gd = computeLoanSchedule(amt, rate, years, 6, 'declining');
        expect(gd.schedule.slice(0, 6).every(m => m.principal === 0)).toBe(true);
        expect(gd.schedule[6].principal).toBeGreaterThan(0);
        expect(gd.schedule.at(-1).balance).toBe(0);
    });

    it('المحرك يمرّر repaymentType من مصادر التمويل إلى جدول القرض', () => {
        const r = calculateStudy(makeStudy({
            [SECTIONS.FINANCING]: { sources: { bankLoan: { amount: amt, interestRate: rate, termYears: years, repaymentType: 'declining' } } }
        }));
        expect(r.loanSchedule?.repaymentType).toBe('declining');
    });
});

describe('بوابة مرونة السيناريو المتشائم: GO هش يُخفَّض إلى REVISE', () => {
    it('GO بمؤشرات جيدة لكن NPV سلبي تحت السيناريو المتشائم ⇒ REVISE بسبب واضح', () => {
        const study = makeStudy({
            [SECTIONS.TECHNICAL]: { equipment: [{ price: 400000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
            [SECTIONS.HR]: { positions: [{ position: 'موظف', count: 4, salary: 6000, months: 12, nationality: 'saudi' }] },
            [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 15000 }] },
            [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 900, avgPrice: 110, variableCostRate: 0.35, growthRate: 0.03 }] }
        });
        const r = calculateStudy(study);
        expect(r.indicators.npv).toBeGreaterThan(0);
        expect(r.scenarios?.pessimistic?.kpis?.npv).toBeLessThan(0);
        expect(r.decision).toBe('REVISE');
        expect(r.decisionReasons.some(x => x.includes('السيناريو المتشائم'))).toBe(true);
    });

    it('لا يرفع قراراً NO-GO/REVISE موجوداً أصلاً إلى GO (اتجاه واحد فقط: يخفّض لا يرفع)', () => {
        const weak = makeStudy({
            [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 10, avgPrice: 20, variableCostRate: 0.30, growthRate: 0 }] }
        });
        const r = calculateStudy(weak);
        expect(r.decision).not.toBe('GO');
    });
});
