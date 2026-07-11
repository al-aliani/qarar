/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (تحقّق عدائي على مهمة سابقة في نفس اليوم): وجد المراجع العدائي
 * أن ScenarioAnalysis.js يحمل نفس فئة خلل "الصفر الملفَّق" التي أُصلحت للتو في
 * SensitivityAnalysis.js — عند فشل حساب أي سيناريو (استثناء أو NPV غير محقَّق)،
 * كانت getResults تُعيد {npv:0, irr:0, paybackPeriod:0} بدل حالة تعذّر محايدة،
 * فتُعرض بطاقة السيناريو "٠ ر.س."/"0.0%" كأنها نتيجة حسابية حقيقية سيئة، لا كحالة
 * "تعذّر الحساب". أُصلح ليُعيد null (نفس عقد runScenario في الملف الشقيق) وتُعرض
 * "--" محايدة. يصعب إجبار المحرك الحقيقي على الفشل بمعاملات واقعية، لذا يُحاكى
 * عبر vi.mock — تماماً كنمط sensitivityAnalysis.nullHandling.test.js.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const calculateStudyMock = vi.fn();
vi.mock('../../core/engine.js', () => ({
    calculateStudy: (...args) => calculateStudyMock(...args)
}));

const { ScenarioAnalysis } = await import('../ScenarioAnalysis.js');

function fakeStore(state) {
    return { getState: () => state, update: vi.fn() };
}

function pessCard() { return document.querySelector('.scenario-pessimistic'); }
function baseCard() { return document.querySelector('.scenario-base'); }
function optCard() { return document.querySelector('.scenario-optimistic'); }

describe('ScenarioAnalysis — تعذّر حساب سيناريو فردي: "--" محايدة لا صفر ملفَّق (خلل مُصلَح)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        calculateStudyMock.mockReset();
    });

    it('استثناء أثناء حساب المتشائم فقط: بطاقته تعرض "--" لـNPV وIRR، بينما الأساس والمتفائل يعرضان أرقاماً حقيقية طبيعية', () => {
        calculateStudyMock.mockImplementation((state, params) => {
            if (!params) return { indicators: { npv: 500000, irr: 0.30, paybackPeriod: 2.5 } }; // الأساس (بلا overrides)
            if (params.revenueChange === -0.20) throw new Error('فشل محاكاة المتشائم');
            return { indicators: { npv: 900000, irr: 0.55, paybackPeriod: 1.2 } }; // المتفائل
        });

        const view = new ScenarioAnalysis('c', fakeStore({ scenarios: {} }));
        view.render(0);

        const pessNpv = pessCard().querySelectorAll('.kpi')[0].querySelectorAll('span')[1];
        const pessIrr = pessCard().querySelectorAll('.kpi')[1].querySelectorAll('span')[1];
        expect(pessNpv.textContent).toBe('--');
        expect(pessIrr.textContent).toBe('--');
        // فترة الاسترداد كانت أصلاً تتعامل بشكل صحيح مع القيم الناقصة — تبقى "غير محقق"
        expect(pessCard().querySelectorAll('.kpi')[2].querySelectorAll('span')[1].textContent).toBe('غير محقق');

        // البطاقات الأخرى غير متأثرة — تعرض أرقاماً حقيقية طبيعية لا "--"
        const baseNpv = baseCard().querySelectorAll('.kpi')[0].querySelectorAll('span')[1];
        const optNpv = optCard().querySelectorAll('.kpi')[0].querySelectorAll('span')[1];
        expect(baseNpv.textContent).not.toBe('--');
        expect(optNpv.textContent).not.toBe('--');
    });

    it('NPV=NaN صراحة من المحرك (لا استثناء): نفس المعاملة المحايدة "--"', () => {
        calculateStudyMock.mockImplementation((state, params) => {
            if (!params) return { indicators: { npv: 500000, irr: 0.30, paybackPeriod: 2.5 } };
            if (params.revenueChange === 0.25) return { indicators: { npv: NaN, irr: NaN, paybackPeriod: null } }; // المتفائل
            return { indicators: { npv: 100000, irr: 0.10, paybackPeriod: 4.0 } };
        });

        const view = new ScenarioAnalysis('c', fakeStore({ scenarios: {} }));
        view.render(0);

        const optNpv = optCard().querySelectorAll('.kpi')[0].querySelectorAll('span')[1];
        const optIrr = optCard().querySelectorAll('.kpi')[1].querySelectorAll('span')[1];
        expect(optNpv.textContent).toBe('--');
        expect(optIrr.textContent).toBe('--');
    });

    it('فشل الحساب الأساسي بالكامل (calculateStudy بلا overrides يرمي): بطاقة الأساس تعرض "--" لا "٠ ر.س."، وبقية البطاقات (لها حساب مستقل) تعمل بشكل طبيعي', () => {
        calculateStudyMock.mockImplementation((state, params) => {
            if (!params) throw new Error('فشل النموذج الأساسي'); // render() يبتلعه بـ console.warn
            return { indicators: { npv: 300000, irr: 0.20, paybackPeriod: 3.0 } };
        });

        const view = new ScenarioAnalysis('c', fakeStore({ scenarios: {} }));
        expect(() => view.render(0)).not.toThrow();

        const baseNpv = baseCard().querySelectorAll('.kpi')[0].querySelectorAll('span')[1];
        expect(baseNpv.textContent).toBe('--');
        expect(baseNpv.textContent).not.toContain('0'); // لا "٠ ر.س." ملفَّق

        // المتشائم/المتفائل يحسبان بشكل مستقل عبر getResults (غير متأثرين بفشل الأساس)
        const pessNpv = pessCard().querySelectorAll('.kpi')[0].querySelectorAll('span')[1];
        expect(pessNpv.textContent).not.toBe('--');
    });

    // مُصحَّح 2026-07-08 (ملاحظة متوسطة #34): كان هذا الاختبار يوثّق ميلاً افتراضياً
    // لـ"تحذيري" عند تعذّر الحساب فعلياً بوصفه "fail-safe" — لكن ذلك عملياً استنتاج
    // مالي سلبي زائف (null > 0 === false)، ونفس فئة "الرقم الملفَّك" التي تمنعها
    // بطاقات NPV/IRR أعلاه (تعرض "--" محايدة لا "٠"). صُحِّح verdict-box ليعرض حالة
    // محايدة صريحة "❔" بدل الادّعاء الضمني بعدم الجدوى — راجع أيضاً
    // scenarioAnalysis.verdictAndAssumptions.test.js.
    it('فشل السيناريو المتشائم تحديداً (تعذّر حساب حقيقي) يعرض حالة محايدة "❔" لا تحذيراً مالياً زائفاً (مُصحَّح #34)', () => {
        calculateStudyMock.mockImplementation((state, params) => {
            if (!params) return { indicators: { npv: 500000, irr: 0.30, paybackPeriod: 2.5 } };
            if (params.revenueChange === -0.20) throw new Error('فشل المتشائم');
            return { indicators: { npv: 700000, irr: 0.40, paybackPeriod: 1.8 } };
        });

        const view = new ScenarioAnalysis('c', fakeStore({ scenarios: {} }));
        expect(() => view.render(0)).not.toThrow();

        const verdict = document.querySelector('.verdict-box');
        expect(verdict.className).toContain('verdict-neutral');
        // العلامة المحايدة صارت أيقونة sprite (i-info) بلا نص إيموجي — الصنف verdict-neutral
        // هو الإشارة الدلالية المُختبَرة (تدقيق تنظيف الإيموجي 2026-07-11).
        expect(verdict.textContent).toContain('تعذّر حساب السيناريو المتشائم');
        expect(verdict.querySelector('use')?.getAttribute('href')).toBe('#i-info');
        expect(verdict.textContent).not.toContain('قد لا يكون مجدياً');
    });
});
