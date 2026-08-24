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
import { FIELD_OPTIONS } from '../fieldOptions.js';

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

describe('قائمة «نوع النشاط» تُطابق قطاعات المحرك (لا خيار غذائي فقط)', () => {
    // بعد توسيع CONCEPT_OPTIONS للقطاعات غير الغذائية: كل خيار (عدا «أخرى») يجب أن
    // يكشفه detectSectorBenchmark لقطاع حقيقي، وإلا تضيع مقارنات المدقق لذلك النشاط.
    const options = FIELD_OPTIONS.concept.options.filter(o => o.value !== 'أخرى');

    it('كل خيار نشاط يُطابق قطاعاً معيارياً معروفاً', () => {
        const unmatched = options.filter(o => !detectSectorBenchmark(o.value));
        expect(unmatched.map(o => o.value)).toEqual([]);
    });

    it('تغطّي القائمة قطاعات غير غذائية (تجزئة/خدمي/صناعي/لوجستي/تقني)', () => {
        const labels = new Set(options.map(o => detectSectorBenchmark(o.value)?.label));
        expect(labels.has('تجزئة')).toBe(true);
        expect(labels.has('خدمي')).toBe(true);
        expect(labels.has('صناعي')).toBe(true);
        expect(labels.has('لوجستي')).toBe(true);
        expect(labels.has('منصة رقمية/SaaS')).toBe(true);
    });
});

describe('WACC and VAT launch fixes', () => {
    // تصحيح 2026-08-24: التدفق النقدي المحسوب هو FCFE (بعد خدمة الدين)، فخصمه بـWACC
    // (مصمَّم لتدفق غير مرفوع FCFF) كان يزدوج أثر عبء الدين. useWaccAsDiscountRate يستخدم
    // الآن تكلفة حقوق الملكية (financing.costOfEquity) مباشرة بدل calculateFinancingWACC.
    // الرقم القديم 0.14875 كان WACC = (0.5×0.20)+(0.5×0.10×(1-0.025))=0.14875 (أوزان
    // 50/50، تكلفة دين 10% بعد ضريبة/زكاة فعّالة 2.5%). الرقم الجديد الصحيح = costOfEquity
    // مباشرة = 0.20 (من financing.costOfEquity في بيانات هذا الاختبار نفسها).
    it('keeps manual discount rate by default and uses cost of equity only when explicitly enabled', () => {
        const study = makeStudy({
            assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0, hiddenOverheadsRate: 0 },
            [SECTIONS.FINANCING]: {
                costOfEquity: 0.20,
                sources: {
                    equity: { amount: 50000 },
                    bankLoan: { amount: 50000, interestRate: 0.10, termYears: 5, gracePeriodMonths: 0 }
                }
            }
        });

        const manual = calculateStudy(study);
        expect(manual.assumptionsApplied.discountRateSource).toBe('assumptions');
        expect(manual.assumptionsApplied.baseDiscountRate).toBeCloseTo(0.10, 6);

        const costOfEquity = calculateStudy({
            ...study,
            assumptions: { ...study.assumptions, useWaccAsDiscountRate: true }
        });
        expect(costOfEquity.assumptionsApplied.discountRateSource).toBe('costOfEquity');
        expect(costOfEquity.assumptionsApplied.baseDiscountRate).toBeCloseTo(0.20, 6);
    });

    it('exposes VAT liquidity impact beside the original cash flow without silently changing NPV cash flows', () => {
        const result = calculateStudy(makeStudy());
        const year1Vat = result.vat.years[0];
        const year1Cash = result.cashFlow.find(r => r.year === 1);

        expect(year1Vat.netPayable).toBeGreaterThan(0);
        expect(year1Cash.vatNetPayable).toBeCloseTo(year1Vat.netPayable, 4);
        expect(year1Cash.cashFlowAfterVat).toBeCloseTo(year1Cash.cashFlow - year1Vat.netPayable, 4);
        expect(result.assumptionDisclosures.join(' ')).toContain('VAT');
    });
});

describe('حارس IRR: مشروع خاسر لا يُظهر عائداً داخلياً مرتفعاً زائفاً', () => {
    // اختبار انحدار لخلل «IRR=1000% رغم NPV سالب واسترداد غير محقق» (تقرير ٢٠٢٦-٠٧-٠٦).
    // استثمار ضخم مقابل إيراد ضئيل ⇒ NPV سالب بعمق ⇒ يجب أن يكون IRR = null (غير قابل للحساب)
    // لا رقماً خارقاً ناتجاً عن تباعُد نيوتن المقصوص سابقاً عند 1000%.
    const losing = makeStudy({
        [SECTIONS.TECHNICAL]: {
            equipment: [{ name: 'معدات باهظة', price: 5000000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.REVENUE]: {
            streams: [{ service: 'مبيعات ضئيلة', type: 'operating', customersPerMonth: 10, avgPrice: 5, variableCostRate: 0.32, growthRate: 0.0 }]
        }
    });

    it('NPV سالب ⇒ IRR ليس رقماً موجباً مرتفعاً (لا 1000%)', () => {
        const r = calculateStudy(losing);
        expect(r.indicators.npv).toBeLessThan(0);
        // القيمة إمّا null (غير قابلة للحساب) أو ≤ 0 — لكنها قطعاً ليست عائداً موجباً مرتفعاً
        const irr = r.indicators.irr;
        expect(irr == null || irr <= 0).toBe(true);
        expect(irr === 10).toBe(false); // القيمة الزائفة القديمة (1000%)
    });

    it('مشروع رابح يحتفظ بـ IRR موجب صالح', () => {
        const r = calculateStudy(makeStudy());
        expect(r.indicators.npv).toBeGreaterThan(0);
        expect(typeof r.indicators.irr).toBe('number');
        expect(r.indicators.irr).toBeGreaterThan(0);
        expect(r.indicators.irr).toBeLessThan(5); // ضمن نطاق واقعي (<500%)
    });

    // إصلاح الحارس الأعمى: NPV<0 لا يعني IRR غير موجود. عائد صحيح أقل من معدل الخصم
    // (IRR≈6% وخصم 10%) ينتج NPV سالباً وهو وضع متسق — يجب ألا يُمحى إلى null.
    // معدات 1.2M بنفس مدخلات makeStudy ⇒ NPV≈−146k وIRR≈6.1% (تحقق حيّ على 5199).
    it('عائد داخلي صحيح أقل من معدل الخصم يبقى رغم NPV سالب (لا يُمسح كالسابق)', () => {
        const discountRate = 0.10;
        const r = calculateStudy(makeStudy({
            [SECTIONS.TECHNICAL]: {
                equipment: [{ name: 'معدات مرتفعة', price: 1200000, quantity: 1 }],
                buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
            }
        }));
        expect(r.indicators.npv).toBeLessThan(0);
        expect(typeof r.indicators.irr).toBe('number'); // لم يُمحَ إلى null
        expect(r.indicators.irr).toBeGreaterThan(0);
        expect(r.indicators.irr).toBeLessThan(discountRate); // على الجانب الصحيح من الخصم
    });
});

describe('القيمة النهائية على أساس حقوق الملكية: تطرح الدين المتبقي عند نهاية الأفق', () => {
    // قيمة المنشأة (unlevered NOPAT) كانت تُضاف إلى NPV الملكية دون طرح رصيد الدين
    // المتبقي عند نهاية الأفق ⇒ تضخيم حين loanTerm>projectionYears. نفس EBIT في السيناريوهين
    // ⇒ نفس قيمة المنشأة؛ الفرق الوحيد هو الدين المتبقي المطروح (تحقق حيّ على 5199).
    const mkLoan = (termYears) => makeStudy({
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0, terminalValue: { method: 'gordon', growthRate: 0.02 } },
        [SECTIONS.TECHNICAL]: { equipment: [{ name: 'معدات', price: 500000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        [SECTIONS.FINANCING]: { sources: { bankLoan: { amount: 400000, interestRate: 0.08, termYears } } }
    });

    it('قرض أطول من الأفق ⇒ قيمة نهائية أقل (الدين المتبقي يُطرح)', () => {
        const shortL = calculateStudy(mkLoan(5));   // يُسدَّد عند نهاية الأفق ⇒ لا دين متبقٍّ
        const longL = calculateStudy(mkLoan(20));   // رصيد كبير متبقٍّ عند نهاية الأفق
        expect(shortL.indicators.terminalValue).toBeGreaterThan(0);
        expect(longL.indicators.terminalValue).toBeGreaterThan(0);
        expect(longL.indicators.terminalValue).toBeLessThan(shortL.indicators.terminalValue);
        expect(longL.indicators.npvWithTerminal).toBeLessThan(shortL.indicators.npvWithTerminal);
    });
});

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
        // مبيعات مستحيلة مادياً لا يمكن أن تكون GO مهما كانت المؤشرات
        expect(r.decision).not.toBe('GO');
        expect(r.decisionReasons.join(' ')).toContain('الطاقة القصوى');
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
        // معادلة Gordon على تدفق معياري (NOPAT غير مرفوع بالدين) لا التدفق الأخير الخام
        // — بعد إصلاح تدقيق ٢٠٢٦-٠٧-٠٦ #2: normalizedFCF × (1+g) ÷ (r−g) مخصومة للسنوات.
        const last = r.incomeStatement[4];
        const effLevy = last.ebt > 0 ? Math.min(1, (last.zakat + last.tax) / last.ebt) : 0;
        const normFCF = last.ebit * (1 - effLevy);
        const expected = (normFCF * 1.02) / (0.10 - 0.02) / Math.pow(1.10, 5);
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
