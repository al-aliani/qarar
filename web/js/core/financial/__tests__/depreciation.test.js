/**
 * إهلاك أصول الإحلال + مواءمة أساس الإهلاك مع المبلغ المُرسمَل — 2026-08-25
 * ═══════════════════════════════════════════════════════════════════════════
 * عيبان حرجان كان هذا الملف يُنشأ لتثبيت إصلاحهما:
 *
 * (1) الأصل البديل يُشترى ويُرسمَل ولا يُهلَك أبداً.
 *     replaceableItems كانت تُبنى مرة واحدة من المدخلات الأصلية، وitemDepAtYear يُعيد صفراً
 *     لكل yr > life. لكن getReplacementCostAtYear يُحمِّل ثمن أصل بديل جديد في السنوات
 *     k·life + 1 ويُرسمَله في الأصول الثابتة (fixedAssetsGross في lib/calc/balanceSheet.js:45).
 *     النتيجة: أصل على الدفاتر بلا أي إهلاك حتى نهاية الأفق.
 *
 * (2) أساس إهلاك المعدات كان مضروباً في 1.10 مصمتة، بينما المحرك يُرسمِلها بـ
 *     (1 + computedContingencyRate). عند نسبة طوارئ أقل من 10% يصير أساس الإهلاك أكبر من
 *     المبلغ المُرسمَل، فيتجاوز التراكم الأصل ويُفعِّل قصّ Math.max(0, …) في
 *     lib/calc/balanceSheet.js:46 ⇒ isBalanced = false. أي أن (2) شرط لازم لسلامة (1).
 *
 * الثابت الحاكم المُختبَر هنا: «المُهلَك ≤ المُرسمَل» في كل سنة —
 *     Σ_{1..i} depreciation ≤ capex.subtotal + Σ_{1..i} replacementCost
 * وهو بالضبط شرط عدم تفعيل ذلك القصّ.
 *
 * الدفعة الثانية (نفس اليوم) — عيبان أُغلقا بعد تحقّق عدائي:
 *
 * (ع-1) تسريب التقريب صار يتكرر كل جيل. life = Math.round(1/rate) تقريب ذو اتجاهين،
 *     والسقف القديم min(dep, remaining) يمنع التجاوز فقط. عند life × rate < 1
 *     (rate = 0.30 ⇒ 0.90، rate = 0.80 ⇒ life = 1 ⇒ 0.80) يبقى جزء من كل جيل بلا إهلاك
 *     إلى الأبد ⇒ صافي الأصول الثابتة ينمو خطياً بلا سقف. الإصلاح: السنة الأخيرة من كل
 *     جيل تستوعب المتبقي كاملاً ⇒ Σ إهلاك الجيل = أساسه بالضبط.
 *
 * (ع-2) أساس الإحلال كان خاماً (cost*qty) بينما أساس الأصل الأصلي مُقيَّس
 *     (cost*qty*(1-saving)*scale). مشروع Outsourcing (مضاعِف 0.3) كان يُرسمِل 66,000 معدات
 *     ثم يُنفق 200,000 «إحلالاً» لنفس الأصل — 3×. الإصلاح: replacementBase = base ⇒ كل
 *     الأجيال متطابقة، فلا قفزة إهلاك (ولا قفزة EBIT) في سنة الإحلال، وينخفض نقد الإحلال
 *     لمشاريع Outsourcing/Pilot_Phase وللأصول ذات الخصم المؤسسي.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../../engine.js';
import { replaceableItemDepAtYear } from '../depreciation.js';
import { SECTIONS } from '../../schema.js';

function makeStudy({ years = 6, technical, assumptions = {}, launchStrategy } = {}) {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: {
            projectionYears: years,
            discountRate: 0.10,
            inflationRate: 0.02,
            hiddenOverheadsRate: 0,
            ...assumptions
        },
        [SECTIONS.TECHNICAL]: {
            equipment: [], buildings: [], furniture: [], vehicles: [],
            establishmentCosts: [], capacityUtilization: [],
            ...technical
        },
        [SECTIONS.HR]: { positions: [{ position: 'موظف', count: 3, salary: 6000, months: 12, nationality: 'saudi' }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 8000 }] },
        [SECTIONS.MARKETING]: { campaigns: [], ...(launchStrategy ? { marketAnalysis: { launchStrategy } } : {}) },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 800, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

/** الثابت الحاكم: المُهلَك التراكمي لا يتجاوز المُرسمَل التراكمي في أي سنة. */
function expectDepNeverExceedsCapitalized(r) {
    let accDep = 0;
    let accRepl = 0;
    r.incomeStatement.forEach((st) => {
        accDep += st.depreciation;
        accRepl += st.replacementCost;
        // هامش ريال واحد لانحرافات الفاصلة العائمة فقط
        expect(accDep).toBeLessThanOrEqual(r.capex.subtotal + accRepl + 1);
    });
}

describe('replaceableItemDepAtYear — دالة خالصة من yr', () => {
    // عنصر مُصطنع بنفس شكل مخرجات buildReplaceable بعد ع-2: أساس الأصل البديل = أساس الأصل
    // الأصلي (330,000) — الأصل البديل هو نفس الأصل بنفس نمذجته.
    const item = { life: 3, base: 330000, dep: 110000, replacementBase: 330000, replacementDep: 110000 };

    it('لا حالة متراكمة: نفس القيمة تصاعدياً وتنازلياً ومكرَّراً', () => {
        const asc = [];
        for (let yr = 1; yr <= 10; yr++) asc.push(replaceableItemDepAtYear(item, yr));
        const desc = [];
        for (let yr = 10; yr >= 1; yr--) desc.unshift(replaceableItemDepAtYear(item, yr));
        const repeated = asc.map((_, i) => replaceableItemDepAtYear(item, i + 1));
        expect(desc).toEqual(asc);
        expect(repeated).toEqual(asc);
        // استدعاء نفس السنة عشر مرات لا يغيّر الناتج
        for (let n = 0; n < 10; n++) expect(replaceableItemDepAtYear(item, 5)).toBe(asc[4]);
    });

    it('المثال المرجعي (L=3، أفق 10): 110k كل سنة — كل الأجيال متطابقة بعد ع-2', () => {
        // الاشتقاق: الجيل k يغطي السنوات k·3+1 .. (k+1)·3 (لا تداخل بين الأجيال)، وكل
        // الأجيال على نفس الأساس 330,000 (110,000/سنة) — نفس المبلغ الذي يُرسمَل نقداً
        // عند الإحلال. هنا 3 × (1/3) = 1 بالضبط فلا متبقي تستوعبه السنة الأخيرة.
        const vec = Array.from({ length: 10 }, (_, i) => replaceableItemDepAtYear(item, i + 1));
        expect(vec).toEqual(Array(10).fill(110000));
        expect(vec.reduce((a, b) => a + b, 0)).toBe(1100000);
    });

    it('rate > 1 (life = 1): الإهلاك = المُرسمَل بالضبط كل سنة (السقف يمنع التجاوز)', () => {
        // rate = 1.5 ⇒ life = round(1/1.5) = 1؛ dep = base×1.5 لكن السقف يقصّه عند base.
        const fast = { life: 1, base: 100000, dep: 150000, replacementBase: 100000, replacementDep: 150000 };
        for (let yr = 1; yr <= 5; yr++) expect(replaceableItemDepAtYear(fast, yr)).toBe(100000);
    });

    it('rate ≤ 0 (life = 0): صفر دائماً — مطابق لغياب أي إحلال', () => {
        const dead = { life: 0, base: 100000, dep: 0, replacementBase: 100000, replacementDep: 0 };
        for (let yr = 1; yr <= 5; yr++) expect(replaceableItemDepAtYear(dead, yr)).toBe(0);
    });

    // ══ (ع-1) تسريب التقريب — حالات life × rate < 1 ══
    it('ع-1: life × rate < 1 (rate = 0.30 ⇒ life = 3) — السنة الأخيرة تستوعب المتبقي', () => {
        // base = 330,000، rate = 0.30 ⇒ dep = 99,000، life = round(1/0.30) = 3.
        // 3 × 99,000 = 297,000 = 90% فقط ⇒ التسريب القديم 33,000 لكل جيل.
        // بعد الإصلاح: [99,000 ، 99,000 ، 330,000 − 198,000 = 132,000] ⇒ المجموع 330,000.
        const it30 = { life: 3, base: 330000, dep: 99000, replacementBase: 330000, replacementDep: 99000 };
        const vec = Array.from({ length: 9 }, (_, i) => replaceableItemDepAtYear(it30, i + 1));
        expect(vec).toEqual([99000, 99000, 132000, 99000, 99000, 132000, 99000, 99000, 132000]);
        // مجموع كل جيل = أساسه بالضبط (لا نقص ولا تجاوز)
        for (let k = 0; k < 3; k++) {
            expect(vec.slice(k * 3, k * 3 + 3).reduce((a, b) => a + b, 0)).toBe(330000);
        }
    });

    it('ع-1: rate = 0.80 ⇒ life = 1 — الجيل الواحد يُهلَك كامل أساسه في سنته', () => {
        // rate = 0.80 ⇒ life = round(1.25) = 1، dep = 80,000 لأساس 100,000: نقص 20,000/سنة.
        // كان يتراكم بلا سقف (الأصل يُستبدل كل سنة بكامل ثمنه ويُهلَك 80% فقط).
        const it80 = { life: 1, base: 100000, dep: 80000, replacementBase: 100000, replacementDep: 80000 };
        for (let yr = 1; yr <= 15; yr++) expect(replaceableItemDepAtYear(it80, yr)).toBe(100000);
    });

    it('ع-1: حالات التجاوز لم تتغيّر — rate = 0.15 ⇒ life = 7 ⇒ السنة السابعة 0.10×base', () => {
        // 7 × 0.15 = 1.05 (تجاوز): remaining في السنة 7 = base − 6 × 0.15 × base = 0.10 × base
        // وهو أصغر من dep، فالنتيجة نفسها قبل الإصلاح وبعده.
        const it15 = { life: 7, base: 100000, dep: 15000, replacementBase: 100000, replacementDep: 15000 };
        const vec = Array.from({ length: 7 }, (_, i) => replaceableItemDepAtYear(it15, i + 1));
        expect(vec).toEqual([15000, 15000, 15000, 15000, 15000, 15000, 10000]);
        expect(vec.reduce((a, b) => a + b, 0)).toBe(100000);
    });
});

describe('(أ) أصل بعمر 3 وأفق 10 — لا أصل مُرسمَل يبقى بلا إهلاك، ولا تراكم يتجاوز المُرسمَل', () => {
    // معدة 300,000 بنسبة 1/3 ⇒ life = 3، بلا أصول أخرى.
    // equipmentScale = 1.0 × (1 + 0.10) ⇒ base = 330,000 = capex.breakdown.equipment.
    const r = calculateStudy(makeStudy({
        years: 10,
        technical: { equipment: [{ price: 300000, quantity: 1, depreciationRate: 1 / 3 }] }
    }));

    it('متجه الإهلاك يطابق الاشتقاق التحليلي، والإحلال يقع في السنوات 4 و7 و10', () => {
        // بعد ع-2: أساس كل جيل = 330,000 ⇒ إهلاك ثابت 110,000 كل سنة (3 × 1/3 = 1 بالضبط)،
        // ونقد الإحلال = 330,000 لا 300,000 الخام (يساوي capex.breakdown.equipment).
        expect(r.capex.subtotal).toBeCloseTo(330000, 6);
        expect(r.incomeStatement.map(s => Math.round(s.depreciation)))
            .toEqual(Array(10).fill(110000));
        expect(r.incomeStatement.map(s => Math.round(s.replacementCost)))
            .toEqual([0, 0, 0, 330000, 0, 0, 330000, 0, 0, 330000]);
        // (ع-2) نقد الإحلال = ما هو مُرسمَل فعلاً، لا الثمن الخام قبل مضاعِف/طوارئ/خصم
        r.incomeStatement.filter(s => s.replacementCost > 0)
            .forEach(s => expect(s.replacementCost).toBeCloseTo(r.capex.breakdown.equipment, 6));
    });

    it('إجمالي المُهلَك = إجمالي المُرسمَل ناقص الذيل غير المستنفد بالضبط', () => {
        const totalDep = r.incomeStatement.reduce((s, y) => s + y.depreciation, 0);
        const totalRepl = r.incomeStatement.reduce((s, y) => s + y.replacementCost, 0);
        const capitalized = r.capex.subtotal + totalRepl; // 330,000 + 990,000 = 1,320,000
        expect(totalDep).toBeCloseTo(1100000, 6);   // 10 × 110,000
        expect(capitalized).toBeCloseTo(1320000, 6);
        // الفرق 220,000 = ذيل الجيل الثالث (اشتُري في السنة 10، بقيت له سنتان بعد الأفق
        // بواقع 110,000 لكل سنة). أي: لا أصل بلا إهلاك، ولا تراكم يتجاوز المُرسمَل.
        expect(capitalized - totalDep).toBeCloseTo(220000, 6);
    });

    it('(ع-3) assetSchedule.byYear يطابق قائمة الدخل — لا أصفار بعد الجيل الأول', () => {
        // كان byYear يُبنى بـ itemDepAtYear فيطبع [110k×3, 0×7] (مجموع 330,000) بينما
        // قائمة الدخل تشحن 1,100,000 — جدول مُصدَّر يناقض القوائم في نفس الملف.
        const row = r.assetSchedule.find(a => a.category === 'Equipment');
        expect(row.byYear).toEqual(Array(10).fill(110000));
        expect(row.byYear.reduce((a, b) => a + b, 0)).toBeCloseTo(1100000, 6);
        // وهو نفس ما تشحنه قائمة الدخل سنة بسنة (لا أصل قابل للإحلال غيره في هذا المُعطى)
        r.incomeStatement.forEach((s, i) => expect(row.byYear[i]).toBeCloseTo(s.depreciation, 6));
    });

    it('(ع-4) «الإهلاك السنوي الرسمي» المعروض = إهلاك السنة الأولى الفعلي', () => {
        // العيب: equipmentTotal × 0.15 مصمتة تتجاهل نسبة العميل (1/3 هنا) ⇒ البطاقة كانت
        // تعرض 330,000 × 0.15 = 49,500 بينما قائمة الدخل تشحن 110,000.
        expect(r.depreciation).toBeCloseTo(110000, 6);
        expect(r.depreciation).toBeCloseTo(r.incomeStatement[0].depreciation, 6);
        expect(r.depreciation).not.toBeCloseTo(330000 * 0.15, 0);
        expect(r.depreciationSchedules.book[0]).toBeCloseTo(110000, 6);
    });

    it('(ع-4b) depreciationSchedules.book يطابق قائمة الدخل في *كل* سنة — على شحن مُتباين عمداً', () => {
        // تدقيق 2026-08-25: كان `book` خطاً مسطّحاً `map(() => annualDepreciation)` يكرّر شحن
        // السنة الأولى لكل السنوات. الفخ: فيكستشر هذه الكتلة (نسبة 1/3) شحنه ثابت 110,000
        // في كل سنة، فالخط المسطّح يطابقه صدفةً ويمرّ الاختبار — تغطية كاذبة تُخفي المسار
        // الموازي بدل كشفه (وهو ما وقع فعلاً في أول صياغة لهذا الاختبار).
        // لذا نستخدم هنا نسبة 0.30 ⇒ life = 3 ونمط جيل [99,000 ، 99,000 ، 132,000] متكرر —
        // السنة الثالثة تستوعب متبقي التقريب فيختلف الشحن بين السنوات، فأي عودة للخط
        // المسطّح تفشل فوراً عند الفهرس 2.
        const varying = calculateStudy(makeStudy({
            years: 9,
            technical: { equipment: [{ price: 300000, quantity: 1, depreciationRate: 0.3 }] }
        }));

        const perYear = varying.incomeStatement.map(s => Math.round(s.depreciation));
        expect(perYear).toEqual([99000, 99000, 132000, 99000, 99000, 132000, 99000, 99000, 132000]);
        // شرط جدوى الاختبار: الشحن متباين فعلاً (وإلا كان الخط المسطّح سيمرّ)
        expect(new Set(perYear).size).toBeGreaterThan(1);

        expect(varying.depreciationSchedules.book).toHaveLength(varying.incomeStatement.length);
        varying.incomeStatement.forEach((s, i) => {
            expect(varying.depreciationSchedules.book[i]).toBeCloseTo(s.depreciation, 6);
        });
    });

    it('(ج) accumulatedDepreciation لا يتجاوز fixedAssetsGross في أي سنة', () => {
        expectDepNeverExceedsCapitalized(r);
        r.balanceSheets.forEach(bs => {
            expect(bs.assets.fixed.accumulatedDepreciation).toBeLessThanOrEqual(bs.assets.fixed.gross);
            // net = gross − acc بلا قصّ (القصّ يعني أن الإهلاك تجاوز المُرسمَل)
            expect(bs.assets.fixed.net).toBe(bs.assets.fixed.gross - bs.assets.fixed.accumulatedDepreciation);
        });
    });
});

describe('(ب) الميزانية تبقى متوازنة عبر عدة دورات إحلال', () => {
    // ثلاث فئات قابلة للإحلال بأعمار مختلفة (2 و5 و4) + مبنى دائم، أفق 10 ⇒ دورات إحلال
    // متعددة ومتداخلة زمنياً بين الفئات.
    const study = makeStudy({
        years: 10,
        technical: {
            equipment: [{ price: 200000, quantity: 1, depreciationRate: 0.5 }],
            furniture: [{ price: 50000, quantity: 1 }],   // 20% ⇒ life = 5
            buildings: [{ price: 300000, quantity: 1 }]   // 5%  ⇒ life = 20 (دائم، لا إحلال)
        }
    });
    study[SECTIONS.TECH_RESOURCES] = { techResources: [{ price: 40000, quantity: 1 }] }; // 25% ⇒ life = 4
    const r = calculateStudy(study);

    it('يقع إحلال فعلي في أكثر من سنة (شرط عدم-عبثية)', () => {
        const replYears = r.incomeStatement.filter(s => s.replacementCost > 0).map(s => s.year);
        // معدات (L=2): 3،5،7،9 | أثاث (L=5): 6 | موارد تقنية (L=4): 5،9
        expect(replYears).toEqual([3, 5, 6, 7, 9]);
    });

    it('isBalanced صحيح و|imbalance| ≤ 5 في كل السنوات', () => {
        expect(r.balanceSheets).toHaveLength(10);
        r.balanceSheets.forEach(bs => {
            expect(bs.isBalanced).toBe(true);
            expect(Math.abs(bs.imbalance)).toBeLessThanOrEqual(5);
        });
    });

    it('(ج) الثابت الحاكم: المُهلَك التراكمي ≤ المُرسمَل التراكمي في كل سنة', () => {
        expectDepNeverExceedsCapitalized(r);
    });
});

describe('(د) أساس إهلاك المعدات يتبع contingencyRate — لا معامل مصمت', () => {
    // قبل 2026-08-25 كان أساس الإهلاك = cost × 1.10 دائماً بينما المُرسمَل = cost × (1+cCR).
    // عند cCR = 0 يصير الأساس (220,000) أكبر من المُرسمَل (200,000) فينكسر التوازن؛
    // وعند cCR = 0.25 يصير أصغر (220,000 مقابل 250,000) فيبقى جزء من الأصل بلا إهلاك.
    const cases = [
        { cCR: 0, capex: 200000, year1Dep: 100000 },
        { cCR: 0.25, capex: 250000, year1Dep: 125000 }
    ];

    cases.forEach(({ cCR, capex, year1Dep }) => {
        it(`contingencyRate = ${cCR}: أساس الإهلاك = capex.breakdown.equipment (${capex})`, () => {
            // معدة 200,000 بنسبة 0.5 ⇒ life = 2. بلا سجل مخاطر ⇒ riskPremium = 0 ⇒
            // computedContingencyRate = cCR بالضبط ⇒ equipmentScale = 1.0 × (1 + cCR).
            const r = calculateStudy(makeStudy({
                years: 6,
                assumptions: { contingencyRate: cCR },
                technical: { equipment: [{ price: 200000, quantity: 1, depreciationRate: 0.5 }] }
            }));

            expect(r.capex.breakdown.equipment).toBeCloseTo(capex, 6);
            expect(r.capex.subtotal).toBeCloseTo(capex, 6);
            // إهلاك السنة 1 = 200,000 × (1 + cCR) × 0.5 — يتحرك مع النسبة، لا يبقى عند 110,000
            expect(r.incomeStatement[0].depreciation).toBeCloseTo(year1Dep, 6);

            // الأصل الأصلي يُستنفد بالضبط خلال عمره (life = 2): لا فائض ولا عجز غير مبرر
            const gen0Dep = r.incomeStatement[0].depreciation + r.incomeStatement[1].depreciation;
            expect(gen0Dep).toBeCloseTo(capex, 6);

            // ولا يتجاوز التراكم المُرسمَل في أي سنة، والميزانية متوازنة
            expectDepNeverExceedsCapitalized(r);
            r.balanceSheets.forEach(bs => expect(bs.isBalanced).toBe(true));
        });
    });
});

describe('(هـ) netFixedStart للوعاء الزكوي = fixed.net في ميزانية السنة السابقة', () => {
    const r = calculateStudy(makeStudy({
        years: 8,
        technical: {
            equipment: [{ price: 200000, quantity: 1, depreciationRate: 0.5 }],
            buildings: [{ price: 300000, quantity: 1 }]
        }
    }));

    it('الصيغتان موحّدتان: capex.subtotal + Σ إحلال سابق − Σ إهلاك سابق = صافي أصول السنة السابقة', () => {
        let accDep = 0;
        let accRepl = 0;
        for (let i = 1; i <= r.incomeStatement.length; i++) {
            // نفس ترتيب المحرك: يُحسب netFixedStart قبل ترحيل إهلاك/إحلال السنة الجارية
            const netFixedStart = Math.max(0, r.capex.subtotal + accRepl - accDep);
            if (i > 1) {
                // ميزانية السنة i−1 = نهاية السنة i−1 = بداية السنة i
                expect(r.balanceSheets[i - 2].assets.fixed.net).toBeCloseTo(netFixedStart, 0);
            }
            accDep += r.incomeStatement[i - 1].depreciation;
            accRepl += r.incomeStatement[i - 1].replacementCost;
        }
    });

    it('الوعاء الزكوي المُصدَّر مبنيّ فعلاً على هذا الرقم (لا على totalCapex بلا إحلال)', () => {
        // سنة 6 (index 5): الإحلال المتراكم قبلها = 220,000×2 (السنتان 3 و5) ⇒ لو استُبعد
        // لانحرف صافي الأصول 440,000 وانحرف الوعاء بنفس المقدار.
        // (220,000 = 200,000 × 1.10 بعد ع-2 — أساس البديل صار نفس أساس الأصل الأصلي.)
        const idx = 5;
        let accDep = 0;
        let accRepl = 0;
        let retained = 0;
        for (let j = 0; j < idx; j++) {
            accDep += r.incomeStatement[j].depreciation;
            accRepl += r.incomeStatement[j].replacementCost;
            retained += r.incomeStatement[j].netIncome;
        }
        expect(accRepl).toBeCloseTo(440000, 6);
        const y = r.incomeStatement[idx];
        const fundingSourcesBase = r.capex.total + retained + 0
            - Math.max(0, r.capex.subtotal + accRepl - accDep);
        // الوعاء = max(الربح المعدل، وعاء مصادر الأموال) — هنا الثاني هو الأكبر
        expect(y.zakatBase).toBeCloseTo(Math.max(y.adjustedProfit, fundingSourcesBase), 4);
        expect(fundingSourcesBase).toBeGreaterThan(y.adjustedProfit);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// (و) ع-1 — تسريب التقريب لم يعد يتكرر كل جيل: صافي الأصول الثابتة محدود على أفق طويل
// ═══════════════════════════════════════════════════════════════════════════
describe('(و) ع-1: life × rate < 1 على أفق 20 سنة — لا نموّ بلا سقف في صافي الأصول', () => {
    /**
     * الثابت الحاكم: صافي الأصول الثابتة لا يتجاوز أبداً أساس جيل واحد (= capex.subtotal
     * هنا، إذ لا أصل آخر في المُعطى). كل جيل مُستنفَد يساهم بصفر صافٍ، والجيل الجاري
     * يساهم بذيله غير المستنفد فقط. قبل الإصلاح كان الفارق المُسرَّب يتراكم لكل جيل فينمو
     * الصافي خطياً بلا حد.
     */
    const netFixedNeverExceedsOneGeneration = (r) => {
        r.balanceSheets.forEach(bs => {
            expect(bs.assets.fixed.net).toBeLessThanOrEqual(r.capex.subtotal + 1);
        });
    };

    it('rate = 0.80 ⇒ life = 1: إحلال كل سنة، وصافي الأصول الثابتة صفر في كل السنوات', () => {
        // الاشتقاق: base = 100,000 × 1.10 (طوارئ 0.10) = 110,000، dep الاسمي = 88,000،
        // life = round(1/0.80) = 1. بعد ع-1 تستوعب السنة الوحيدة للجيل كامل 110,000.
        // الإحلال في كل سنة yr > 1 ((yr−1) % 1 === 0) بمبلغ 110,000 (= base بعد ع-2).
        // ⇒ gross(i) = 110,000 × i و accDep(i) = 110,000 × i ⇒ net = 0 دائماً.
        // قبل الإصلاح: يُهلَك 88,000 فقط سنوياً بينما يُرسمَل 100,000 خاماً ⇒ نموّ بلا سقف
        // (302,000 في السنة 15 لآلة واحدة قيمتها 100,000).
        const r = calculateStudy(makeStudy({
            years: 20,
            technical: { equipment: [{ price: 100000, quantity: 1, depreciationRate: 0.8 }] }
        }));
        expect(r.capex.subtotal).toBeCloseTo(110000, 6);
        expect(r.incomeStatement.map(s => Math.round(s.depreciation))).toEqual(Array(20).fill(110000));
        expect(r.incomeStatement.map(s => Math.round(s.replacementCost)))
            .toEqual([0, ...Array(19).fill(110000)]);
        r.balanceSheets.forEach(bs => expect(bs.assets.fixed.net).toBeCloseTo(0, 6));
        netFixedNeverExceedsOneGeneration(r);
        expectDepNeverExceedsCapitalized(r);
    });

    it('rate = 0.30 ⇒ life = 3: مجموع إهلاك كل جيل = أساسه بالضبط، والصافي محدود بذيل جيل واحد', () => {
        // الاشتقاق: base = 300,000 × 1.10 = 330,000، dep الاسمي = 99,000، life = round(3.33) = 3.
        // 3 × 99,000 = 297,000 (90% فقط) ⇒ التسريب القديم 33,000 لكل جيل. بعد ع-1:
        // نمط الجيل = [99,000 ، 99,000 ، 132,000] ومجموعه 330,000 بالضبط.
        // الإحلال في السنوات 4، 7، 10، 13، 16، 19 (ستّ مرات × 330,000 = 1,980,000)
        // ⇒ gross(20) = 330,000 + 1,980,000 = 2,310,000
        // accDep(20) = 6 أجيال مكتملة (6 × 330,000 = 1,980,000) + جيل السنة 19 (99,000 × 2)
        //            = 2,178,000  ⇒  net(20) = 132,000 = ذيل الجيل الأخير غير المستنفد.
        const r = calculateStudy(makeStudy({
            years: 20,
            technical: { equipment: [{ price: 300000, quantity: 1, depreciationRate: 0.3 }] }
        }));
        expect(r.capex.subtotal).toBeCloseTo(330000, 6);
        const dep = r.incomeStatement.map(s => Math.round(s.depreciation));
        expect(dep.slice(0, 6)).toEqual([99000, 99000, 132000, 99000, 99000, 132000]);
        // مجموع كل جيل مكتمل (6 أجيال × 3 سنوات = السنوات 1..18) = أساسه بالضبط
        for (let k = 0; k < 6; k++) {
            expect(dep.slice(k * 3, k * 3 + 3).reduce((a, b) => a + b, 0)).toBe(330000);
        }
        expect(r.incomeStatement.filter(s => s.replacementCost > 0).map(s => s.year))
            .toEqual([4, 7, 10, 13, 16, 19]);
        const last = r.balanceSheets[19];
        expect(last.assets.fixed.gross).toBeCloseTo(2310000, 0);
        expect(last.assets.fixed.accumulatedDepreciation).toBeCloseTo(2178000, 0);
        expect(last.assets.fixed.net).toBeCloseTo(132000, 0);
        // الحارس الأهم: لا نموّ بلا سقف — الصافي لا يتجاوز أساس جيل واحد في أي سنة
        netFixedNeverExceedsOneGeneration(r);
        expectDepNeverExceedsCapitalized(r);
        r.balanceSheets.forEach(bs => expect(bs.isBalanced).toBe(true));
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// (ز) ع-2 — نقد الإحلال يتناسب مع المُرسمَل فعلاً (استراتيجية Outsourcing)
// ═══════════════════════════════════════════════════════════════════════════
describe('(ز) ع-2: Outsourcing — نقد الإحلال = capex.breakdown.equipment، ولا قفزة إهلاك', () => {
    // معدة 200,000 بنسبة 0.5 ⇒ life = 2، واستراتيجية Outsourcing ⇒ مضاعِف 0.3.
    // equipmentScale = 0.3 × (1 + 0.10) = 0.33 ⇒ base = capex.breakdown.equipment = 66,000.
    // قبل ع-2: يُرسمَل 66,000 ثم يُنفق 200,000 «إحلالاً» لنفس الأصل — 3.03× ما يملكه.
    const r = calculateStudy(makeStudy({
        years: 6,
        launchStrategy: 'Outsourcing',
        technical: { equipment: [{ price: 200000, quantity: 1, depreciationRate: 0.5 }] }
    }));

    it('نقد الإحلال يساوي المعدات المُرسمَلة، لا الثمن الخام', () => {
        expect(r.capex.breakdown.equipment).toBeCloseTo(66000, 6);
        const repl = r.incomeStatement.filter(s => s.replacementCost > 0);
        expect(repl.map(s => s.year)).toEqual([3, 5]);   // life = 2 ⇒ (yr−1) % 2 === 0، yr > 1
        repl.forEach(s => {
            expect(s.replacementCost).toBeCloseTo(r.capex.breakdown.equipment, 6);
            expect(s.replacementCost).toBeCloseTo(66000, 6);
            expect(s.replacementCost).not.toBeCloseTo(200000, 0); // السلوك المعطوب السابق
        });
    });

    it('الإهلاك ثابت 33,000 ⇒ لا قفزة (سالبة أو موجبة) عند سنة الإحلال', () => {
        // 2 × 0.5 = 1 بالضبط ⇒ لا متبقٍ تستوعبه السنة الأخيرة، وكل الأجيال على نفس الأساس
        // ⇒ 66,000 × 0.5 = 33,000 كل سنة.
        expect(r.incomeStatement.map(s => Math.round(s.depreciation))).toEqual(Array(6).fill(33000));
        expectDepNeverExceedsCapitalized(r);
        r.balanceSheets.forEach(bs => expect(bs.isBalanced).toBe(true));
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// (ح) ع-2 — مسح: لا Δ EBIT موجب بسبب الإهلاك في سنة الإحلال، لأي طوارئ × استراتيجية
// ═══════════════════════════════════════════════════════════════════════════
describe('(ح) ع-2: مسح طوارئ × استراتيجية — الإهلاك لا يهبط في سنة الإحلال', () => {
    // ebit = ebitda − builderSuccessFee − depreciation، وbuilderSuccessFee = 0 هنا
    // (لا ventureBuilder) ⇒ مساهمة الإهلاك في Δ EBIT = −(dep_t − dep_{t−1})،
    // فـ«Δ EBIT موجب بسبب الإهلاك» ⇔ dep_t < dep_{t−1}. قبل ع-2 كان هذا يقع في سنة الإحلال
    // كلما كان أساس البديل الخام (cost×qty) أصغر من الأساس المُقيَّس — أي عند أي مضاعِف
    // استراتيجية < 1 أو أي خصم مؤسسي.
    // نسبة 0.5 ⇒ life = 2 و2 × 0.5 = 1 بالضبط، فلا متبقي تقريب يشوّش على المُختبَر هنا.
    // ملاحظة: نموذج العمل في الفيكستشر Independent أصلاً؛ المسح هنا على استراتيجية الإطلاق
    // (المضاعِف)، وFull_Launch هو حالة المضاعِف 1.0.
    const strategies = ['Full_Launch', 'Pilot_Phase', 'Outsourcing'];
    const contingencies = [0, 0.10, 0.25, 0.50];
    const multiplier = { Full_Launch: 1.0, Pilot_Phase: 0.5, Outsourcing: 0.3 };

    strategies.forEach(strategy => contingencies.forEach(cCR => {
        it(`${strategy} × طوارئ ${cCR}: dep ثابت، Δ EBIT من الإهلاك = 0 في سنتَي الإحلال (3 و5)`, () => {
            const r = calculateStudy(makeStudy({
                years: 6,
                launchStrategy: strategy,
                assumptions: { contingencyRate: cCR },
                technical: { equipment: [{ price: 200000, quantity: 1, depreciationRate: 0.5 }] }
            }));
            // الاشتقاق: base = 200,000 × multiplier × (1 + cCR) = capex.breakdown.equipment
            const expectedBase = 200000 * multiplier[strategy] * (1 + cCR);
            expect(r.capex.breakdown.equipment).toBeCloseTo(expectedBase, 6);

            const dep = r.incomeStatement.map(s => s.depreciation);
            const ebit = r.incomeStatement.map(s => s.ebit);
            const ebitda = r.incomeStatement.map(s => s.ebitda);
            dep.forEach(d => expect(d).toBeCloseTo(expectedBase * 0.5, 6));

            [2, 4].forEach(idx => { // مؤشرا السنتين 3 و5 — سنتا الإحلال
                expect(r.incomeStatement[idx].replacementCost).toBeCloseTo(expectedBase, 6);
                // مساهمة الإهلاك في Δ EBIT ليست موجبة
                expect(dep[idx - 1] - dep[idx]).toBeLessThanOrEqual(1e-6);
                // وΔ EBIT الفعلي = Δ EBITDA بالكامل (الإهلاك لا يساهم بشيء)
                expect(ebit[idx] - ebit[idx - 1]).toBeCloseTo(ebitda[idx] - ebitda[idx - 1], 6);
            });
        });
    }));
});

// ═══════════════════════════════════════════════════════════════════════════
// الدفعة الثالثة (2026-08-25) — ثلاثة عيوب كشفها تحقّق عدائي بعد الدفعة الثانية
// ═══════════════════════════════════════════════════════════════════════════

/**
 * (ط) ع-5 (D3): «نسبة التوفير» المؤسسية بلا حدّ ⇒ تدفق نقدي داخل وهمي.
 *
 * الحقل كسر عشري (labels.js: «نسبة التوفير (0.1 - 1.0)») يدخل المحرك كـ (1 − saving).
 * بلا تقييد، مُدخَل «40» (بنيّة 40%) يُنتج معامل (1 − 40) = −39:
 *     base = 200,000 × (−39) × 1.10 = −8,580,000
 * وبعد الدفعة الثانية صار أساس الإحلال = base نفسه، فوصل السالب إلى سطر التدفق النقدي:
 *     repl = [0, 0, −8,580,000, 0, −8,580,000, 0]   ⇒  NPV = 12,897,050 (مقابل 721,352
 * بالمدخل الصحيح 0.4) وIRR = null. أي: خطأ كتابة واحد يقلب دراسة إلى «فرصة ذهبية».
 *
 * الإصلاح: getSaving تُقيَّد إلى [0, 1] مع Number.isFinite guard (engine.js)، وqaChecks.js
 * (فحص CORPORATE_SAVING_OUT_OF_RANGE) يُنبّه المستخدم صراحة قبل التقييد. عمداً لا نقسم
 * على 100 نيابةً عنه — تخمين النية صامتاً يُنتج رقماً خاطئاً بثقة.
 */
describe('(ط) ع-5: نسبة التوفير المؤسسية مُقيَّدة إلى [0, 1]', () => {
    // معدة 200,000 بنسبة استهلاك 0.5 ⇒ life = 2، طوارئ افتراضية 0.10 ⇒
    // base = 200,000 × (1 − saving) × 1.10 = capex.breakdown.equipment.
    const withSaving = (savingPercentage) => calculateStudy({
        ...makeStudy({
            years: 6,
            technical: { equipment: [{ price: 200000, quantity: 1, depreciationRate: 0.5 }] }
        }),
        [SECTIONS.PROJECT_INFO]: {
            businessModel: 'Corporate_Venture',
            corporateAssets: [{ name: 'خط إنتاج الشركة الأم', costSavingType: 'Equipment', savingPercentage }]
        }
    });

    it('المدخلات الصحيحة [0, 1] لم تتغيّر إطلاقاً — التقييد محايد عليها', () => {
        // الاشتقاق: base = 200,000 × (1 − s) × 1.10 لكل s، وإهلاك السنة = base × 0.5.
        [0, 0.1, 0.4, 0.75, 1].forEach(s => {
            const r = withSaving(s);
            const expectedBase = 200000 * (1 - s) * 1.10;
            expect(r.capex.breakdown.equipment).toBeCloseTo(expectedBase, 6);
            expect(r.incomeStatement[0].depreciation).toBeCloseTo(expectedBase * 0.5, 6);
        });
        // القيمة المرجعية الكاملة للمدخل الصحيح 0.4 (هي نفسها قبل الإصلاح وبعده)
        const r04 = withSaving(0.4);
        expect(r04.capex.breakdown.equipment).toBeCloseTo(132000, 6);
        expect(r04.incomeStatement.map(s => Math.round(s.replacementCost)))
            .toEqual([0, 0, 132000, 0, 132000, 0]);
        expect(r04.indicators.npv).toBeCloseTo(721351.789, 2);
    });

    // 40 و1.5 يُقيَّدان إلى 1 (توفير كامل ⇒ الأصل مُقدَّم من الشركة الأم ⇒ لا رسملة ولا
    // إحلال)، و−0.2 يُقيَّد إلى 0 (لا توفير ⇒ الأصل بكامل ثمنه). لا سالب في أي مسار.
    const clampCases = [
        { raw: 40, clampedTo: 1 },
        { raw: 1.5, clampedTo: 1 },
        { raw: -0.2, clampedTo: 0 }
    ];

    clampCases.forEach(({ raw, clampedTo }) => {
        it(`saving = ${raw} ⇒ نتيجة مطابقة تماماً لـ saving = ${clampedTo}`, () => {
            const r = withSaving(raw);
            const ref = withSaving(clampedTo);
            expect(r.capex.breakdown.equipment).toBe(ref.capex.breakdown.equipment);
            expect(r.incomeStatement.map(s => s.replacementCost))
                .toEqual(ref.incomeStatement.map(s => s.replacementCost));
            expect(r.incomeStatement.map(s => s.depreciation))
                .toEqual(ref.incomeStatement.map(s => s.depreciation));
            expect(r.indicators.npv).toBe(ref.indicators.npv);
            expect(r.indicators.irr).toBe(ref.indicators.irr);
        });

        it(`saving = ${raw} ⇒ لا تدفق إحلال سالب ولا أصل سالب`, () => {
            const r = withSaving(raw);
            expect(r.capex.breakdown.equipment).toBeGreaterThanOrEqual(0);
            expect(r.capex.subtotal).toBeGreaterThanOrEqual(0);
            r.incomeStatement.forEach(s => {
                expect(s.replacementCost).toBeGreaterThanOrEqual(0);
                expect(s.depreciation).toBeGreaterThanOrEqual(0);
            });
        });
    });

    it('saving = 40: لا NPV منتفخ — محكوم بسقف حالة «الأصل مجاناً»، لا 12.9 مليون', () => {
        // السلوك المعطوب: repl = [0,0,−8,580,000,0,−8,580,000,0] ⇒ NPV = 12,897,050 وIRR = null.
        // الحدّ الأعلى المشروع = NPV عند saving = 1 (لا شيء يُرسمَل ولا يُستبدَل إطلاقاً)؛
        // أي قيمة تتجاوزه مصدرها تدفق داخل وهمي لا وفر حقيقي.
        const r = withSaving(40);
        expect(r.indicators.npv).toBeLessThanOrEqual(withSaving(1).indicators.npv);
        expect(r.indicators.npv).toBeLessThan(2000000);
        expect(r.indicators.irr).not.toBeNull();
    });

    it('قيم غير عددية (نص/فارغ/غياب الحقل) ⇒ صفر توفير، لا NaN', () => {
        [undefined, null, '', 'أربعون', NaN].forEach(bad => {
            const r = withSaving(bad);
            // 200,000 × 1.10 = 220,000 — نفس حالة «لا توفير»
            expect(r.capex.breakdown.equipment).toBeCloseTo(220000, 6);
            expect(Number.isFinite(r.indicators.npv)).toBe(true);
        });
    });
});

/**
 * (ي) ع-6 (D1): إطفاء التأسيس كان بلا سقف إطلاقاً.
 *
 * الشرط اليدوي `yr <= life ? dep : 0` بلا حقل base وبلا استيعاب للمتبقي يُطفئ
 * life × rate من الأصل، وهي ≠ 1 عموماً لأن life = Math.round(1/rate):
 *   • rate = 0.15 ⇒ life = round(6.667) = 7 ⇒ 7 × 15,000 = 105,000 على أصل 100,000.
 *   • rate = 0.40 ⇒ life = round(2.5)   = 3 ⇒ 3 × 40,000 = 120,000.
 * كلاهما يكسر هوية الميزانية (isBalanced = false) داخل آفاق متاحة بأزرار جاهزة.
 * الإصلاح: نفس itemDepAtYear المستخدمة للمسارين الآخرين ⇒ Σ الإطفاء = amount بالضبط.
 */
describe('(ي) ع-6: إطفاء التأسيس مسقوف عند 100% من كلفة البند', () => {
    const withEstablishment = (amortizationRate, years) => calculateStudy(makeStudy({
        years,
        technical: { establishmentCosts: [{ name: 'رخص وتأسيس', amount: 100000, amortizationRate }] }
    }));

    const cases = [
        {
            rate: 0.15, years: 7,
            // life = 7؛ السنوات 1..6 بالقسط الاسمي 15,000، والسابعة تستوعب المتبقي
            // 100,000 − 6 × 15,000 = 10,000. (قبل الإصلاح: 15,000 × 7 = 105,000.)
            expected: [15000, 15000, 15000, 15000, 15000, 15000, 10000]
        },
        {
            rate: 0.40, years: 5,
            // life = round(2.5) = 3؛ 40,000 ثم 40,000 ثم المتبقي 100,000 − 80,000 = 20,000،
            // ثم صفر بعد استنفاد العمر. (قبل الإصلاح: 40,000 × 3 = 120,000.)
            expected: [40000, 40000, 20000, 0, 0]
        },
        {
            rate: 0.20, years: 5,
            // حارس عدم-انحدار: النسبة الافتراضية 5 × 0.20 = 1 بالضبط ⇒ لا تغيّر إطلاقاً.
            expected: [20000, 20000, 20000, 20000, 20000]
        }
    ];

    cases.forEach(({ rate, years, expected }) => {
        it(`amortizationRate = ${rate} وأفق ${years}: مجموع الإطفاء = 100,000 بالضبط`, () => {
            const r = withEstablishment(rate, years);
            expect(r.capex.breakdown.establishment).toBeCloseTo(100000, 6);
            const dep = r.incomeStatement.map(s => Math.round(s.depreciation));
            expect(dep).toEqual(expected);
            expect(dep.reduce((a, b) => a + b, 0)).toBe(100000);
        });

        it(`amortizationRate = ${rate} وأفق ${years}: الميزانية متوازنة في كل السنوات`, () => {
            const r = withEstablishment(rate, years);
            r.balanceSheets.forEach(bs => {
                expect(bs.isBalanced).toBe(true);
                expect(Math.abs(bs.imbalance)).toBeLessThanOrEqual(1);
            });
            expectDepNeverExceedsCapitalized(r);
        });
    });

    it('أفق أطول من العمر لا يُطفئ شيئاً إضافياً (0.20 وأفق 10 ⇒ 5 سنوات ثم صفر)', () => {
        const r = withEstablishment(0.20, 10);
        expect(r.incomeStatement.map(s => Math.round(s.depreciation)))
            .toEqual([20000, 20000, 20000, 20000, 20000, 0, 0, 0, 0, 0]);
    });
});

/**
 * (ك) ع-7 (D2): «الإهلاك السنوي الرسمي» المعروض كان يُحسب بمسار موازٍ.
 *
 * الدفعة الثانية أصلحت مكوّن المعدات وحده (اشتُقّ من replaceableItemDepAtYear(it, 1))،
 * بينما الأثاث والموارد التقنية والمباني والمركبات وإطفاء التأسيس بقيت على Σ base × rate.
 * ولأن الدفعة الثانية جعلت السنة الأولى تستوعب كامل الأساس عند life = 1، انفتحت فجوة
 * أحدثتها هي نفسها. الآن كل المكوّنات مشتقّة من شحن السنة الأولى الفعلي.
 */
describe('(ك) ع-7: result.depreciation = إهلاك السنة الأولى الفعلي في قائمة الدخل', () => {
    // أربع فئات كلها بنسب تُعطي life = Math.round(1/rate) = 1، زائد بند تأسيس:
    //   أثاث        100,000 @ 0.70 ⇒ life = round(1.429) = 1  (قابل للإحلال، مضاعِف 1)
    //   موارد تقنية  80,000 @ 0.80 ⇒ life = round(1.250) = 1  (قابل للإحلال، مضاعِف 1)
    //   مبنى         50,000 @ 0.80 ⇒ life = 1                 (دائم)
    //   مركبة        60,000 @ 0.90 ⇒ life = round(1.111) = 1  (دائم)
    //   تأسيس       100,000 @ 0.80 ⇒ life = 1                 (إطفاء)
    const study = makeStudy({
        years: 5,
        technical: {
            furniture: [{ price: 100000, quantity: 1, depreciationRate: 0.7 }],
            buildings: [{ price: 50000, quantity: 1, depreciationRate: 0.8 }],
            vehicles: [{ price: 60000, quantity: 1, depreciationRate: 0.9 }],
            establishmentCosts: [{ name: 'تأسيس', amount: 100000, amortizationRate: 0.8 }]
        }
    });
    study[SECTIONS.TECH_RESOURCES] = { techResources: [{ price: 80000, quantity: 1, depreciationRate: 0.8 }] };
    const r = calculateStudy(study);

    it('البطاقة المعروضة = 390,000 = مجموع الأسس (لا 308,000 من المسار الموازي)', () => {
        // الشحن الفعلي للسنة الأولى: كل بند life = 1 ⇒ يستوعب كامل أساسه.
        //   100,000 + 80,000 + 50,000 + 60,000 + 100,000 = 390,000
        // المسار الموازي القديم (Σ base × rate + Σ amount × rate):
        //   70,000 + 64,000 + 40,000 + 54,000 + 80,000 = 308,000 — تبخيس 21%.
        expect(r.depreciation).toBeCloseTo(390000, 6);
        expect(r.depreciation).not.toBeCloseTo(308000, 0);
        expect(r.incomeStatement[0].depreciation).toBeCloseTo(390000, 6);
        expect(r.depreciation).toBeCloseTo(r.incomeStatement[0].depreciation, 6);
    });

    it('depreciationSchedules.book (المُصدَّر) يتبع نفس الرقم', () => {
        expect(r.depreciationSchedules.book[0]).toBeCloseTo(390000, 6);
    });

    it('كل فئة على حدة: البطاقة = إهلاك السنة الأولى في قائمة الدخل', () => {
        // مسح فئة-بفئة يمنع «تصحيحاً» يوازن الفئات بعضها ببعض صدفةً.
        const perCategory = [
            { label: 'أثاث', build: (s) => { s[SECTIONS.TECHNICAL].furniture = [{ price: 100000, quantity: 1, depreciationRate: 0.7 }]; }, year1: 100000 },
            { label: 'مبانٍ', build: (s) => { s[SECTIONS.TECHNICAL].buildings = [{ price: 50000, quantity: 1, depreciationRate: 0.8 }]; }, year1: 50000 },
            { label: 'مركبات', build: (s) => { s[SECTIONS.TECHNICAL].vehicles = [{ price: 60000, quantity: 1, depreciationRate: 0.9 }]; }, year1: 60000 },
            { label: 'موارد تقنية', build: (s) => { s[SECTIONS.TECH_RESOURCES] = { techResources: [{ price: 80000, quantity: 1, depreciationRate: 0.8 }] }; }, year1: 80000 },
            { label: 'تأسيس', build: (s) => { s[SECTIONS.TECHNICAL].establishmentCosts = [{ name: 'ت', amount: 100000, amortizationRate: 0.8 }]; }, year1: 100000 },
            // معدات: base = 200,000 × 1.10 (طوارئ) = 220,000 وlife = round(1.25) = 1
            { label: 'معدات', build: (s) => { s[SECTIONS.TECHNICAL].equipment = [{ price: 200000, quantity: 1, depreciationRate: 0.8 }]; }, year1: 220000 }
        ];
        perCategory.forEach(({ label, build, year1 }) => {
            const s = makeStudy({ years: 4 });
            build(s);
            const res = calculateStudy(s);
            expect(res.depreciation, label).toBeCloseTo(year1, 6);
            expect(res.depreciation, label).toBeCloseTo(res.incomeStatement[0].depreciation, 6);
        });
    });

    it('الميزانية تبقى متوازنة على هذا المُعطى المركّب', () => {
        r.balanceSheets.forEach(bs => expect(bs.isBalanced).toBe(true));
        expectDepNeverExceedsCapitalized(r);
    });
});
