/**
 * @vitest-environment jsdom
 *
 * تدقيق أداء 2026-08-25 — حزمة `autonumeric` (~30% من main بـrenderedLength) كانت
 * تُستورَد بشغف في Wizard.js من أجل فرع **ميت منطقياً**:
 *
 *     container.querySelectorAll('input[type="number"]').forEach(input => {
 *         if (…Rate…) { …noUiSlider… }
 *         else if (input.type !== 'number' && …) { new AutoNumeric(input, …) }
 *     });
 *
 * الحلقة تدور على `input[type="number"]` فقط ⟹ `input.type === 'number'` حتماً لكل
 * عنصر ⟹ شرط `input.type !== 'number'` لا يصحّ أبداً ⟹ المُنشئ لا يُستدعى ولا مرة.
 * أي أن الحزمة كانت تُنزَّل على كل زيارة دون أن تُنسّق رقماً واحداً. حُذف الفرع
 * واستيرادُه؛ الحقول تبقى `input[type=number]` بتنسيق المتصفح الأصلي — وهو ما كانت
 * عليه فعلياً طوال الوقت، فلا تغيير سلوكي.
 *
 * هذا الملف يثبّت الطرفين:
 *   1. حقول الأرقام ما زالت تعمل فعلياً بعد الحذف (رسم + تحرير + حفظ)، لا قراءة كود.
 *   2. حارس انحدار: لا عودة لاستيراد autonumeric في شجرة المصدر (وإلا عاد ~30%
 *      من الحزمة الرئيسية بصمت دون أن يفشل أي اختبار آخر).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// noUiSlider يحتاج قياسات تخطيط غير متوفرة في jsdom — يُستبدل كما في
// wizard.assumptionsSliderPercent.test.js (نفس النمط المعتمد في المشروع).
vi.mock('nouislider', () => ({
    default: { create: vi.fn((el) => { el.noUiSlider = { on: vi.fn() }; }) }
}));

const { Wizard } = await import('../Wizard.js');
const { SECTIONS, createEmptyStudy } = await import('../../core/schema.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIZARD_SRC = join(__dirname, '../Wizard.js');

function mountStep(sectionId, mutate) {
    const state = createEmptyStudy();
    if (mutate) mutate(state);
    const updatePath = vi.fn();
    const wizard = new Wizard('c', {
        get: () => state, getState: () => state, update: vi.fn(), updatePath
    }, {}, { steps: [{ id: sectionId, label: sectionId, isForm: true, tables: [] }] });
    document.body.innerHTML = `<div id="c"></div>`;
    wizard.container = document.getElementById('c');
    wizard.renderStep(sectionId, wizard.steps[0], 0);
    return { wizard, state, updatePath };
}

afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
});

describe('Wizard — حقول الأرقام تعمل بعد حذف AutoNumeric الميت', () => {
    it('خطوة الافتراضات: كل الحقول الرقمية تُرسم كـ input[type=number] سليم', () => {
        const { wizard } = mountStep(SECTIONS.ASSUMPTIONS);
        const inputs = [...wizard.container.querySelectorAll('input[type="number"]')];

        expect(inputs.length).toBeGreaterThan(0);
        // التوكيد الذي يفضح الفرع الميت: لا يوجد عنصر واحد نوعه غير 'number'،
        // فالشرط الذي كان يحرس AutoNumeric مستحيل التحقق بحكم المُحدِّد نفسه.
        expect(inputs.every((i) => i.type === 'number')).toBe(true);
        // ولا أثر لأي غلاف يُنشئه AutoNumeric على الحقول.
        expect(inputs.some((i) => i.hasAttribute('autonumeric'))).toBe(false);
    });

    it('حقل أيام رأس المال العامل (كان الهدف المزعوم للتنسيق): يُحرَّر ويُحفَظ كرقم خام', () => {
        const { wizard, updatePath } = mountStep(SECTIONS.ASSUMPTIONS);
        const input = wizard.container.querySelector('input[data-key="workingCapitalPolicy.dsoDays"]');
        expect(input).toBeTruthy();
        expect(input.type).toBe('number');

        input.value = '45';
        input.dispatchEvent(new Event('change'));

        // ليس كسراً ولا نصاً بفواصل — رقم خام كما يتوقعه محرك الحساب.
        expect(updatePath).toHaveBeenCalledWith(SECTIONS.ASSUMPTIONS, 'workingCapitalPolicy.dsoDays', 45);
        // القيمة المعروضة تبقى كما كتبها المستخدم (لا إعادة تنسيق تُفسد الإدخال).
        expect(input.value).toBe('45');
    });

    it('حقل نسبة مئوية غير مرتبط بسلايدر (thresholds.minIRR): يُخزَّن ككسر بعد القسمة على 100', () => {
        const { wizard, updatePath } = mountStep(SECTIONS.ASSUMPTIONS);
        const input = wizard.container.querySelector('input[data-key="thresholds.minIRR"]');
        expect(input).toBeTruthy();

        input.value = '18';
        input.dispatchEvent(new Event('change'));

        expect(updatePath).toHaveBeenCalledWith(SECTIONS.ASSUMPTIONS, 'thresholds.minIRR', 0.18);
    });

    it('القيم المخزَّنة تظهر في الحقول عند الرسم (الكسر يُعرض كنسبة)', () => {
        const { wizard } = mountStep(SECTIONS.ASSUMPTIONS, (s) => {
            s.assumptions.discountRate = 0.12;
            s.assumptions.workingCapitalMonths = 4;
        });
        expect(wizard.container.querySelector('#field-discountRate').value).toBe('12');
        expect(wizard.container.querySelector('input[data-key="workingCapitalMonths"]').value).toBe('4');
    });

    it('خطوة التمويل: حقولها الرقمية تُرسم وتُحفَظ أيضاً', () => {
        const { wizard, updatePath } = mountStep(SECTIONS.FINANCING);
        const input = wizard.container.querySelector('input[data-key="totalInvestment"]');
        expect(input).toBeTruthy();
        expect(input.type).toBe('number');

        input.value = '250000';
        input.dispatchEvent(new Event('change'));

        expect(updatePath).toHaveBeenCalledWith(SECTIONS.FINANCING, 'totalInvestment', 250000);
    });
});

describe('حارس الحزمة — autonumeric لا يعود للاستيراد', () => {
    it('Wizard.js لا يستورد autonumeric', () => {
        const src = readFileSync(WIZARD_SRC, 'utf8');
        // نطابق الاستيراد تحديداً، لا كلمة AutoNumeric في التعليق التوثيقي أعلاه.
        expect(
            /^\s*import[^\n]*['"]autonumeric['"]/m.test(src),
            'عاد استيراد autonumeric إلى Wizard.js — سيُضاف ~30% للحزمة الرئيسية بلا فائدة'
        ).toBe(false);
    });
});
