/**
 * @vitest-environment jsdom
 *
 * تدقيق حي 2026-07-16 (اختبار عميل: دراسة وكالة تسويق): سلايدرات النسب المئوية
 * في خطوتي «الافتراضات المالية» و«التمويل» (discountRate, taxRate, inflationRate,
 * contingencyRate...) كانت تضاعف التحويل كسر↔نسبة مرتين:
 *   - عند الرسم: renderField يحوّل الكسر المخزَّن (0.10) لرقم نسبة معروض (10) في
 *     input.value، ثم كود تهيئة السلايدر كان يضربه ×100 مجدداً (10 → 1000) فيُقصّ
 *     Slider القيمة عند سقفه (100 أو 50) ويعرض تلميحاً مضلِّلاً «100%»/«50%» بصرياً
 *     بصرف النظر عن القيمة الحقيقية.
 *   - عند السحب: updateStore يقسم القيمة المعروضة (10) على 100 لتخزينها ككسر (0.10)
 *     — لكن معالج 'change' في السلايدر كان يقسم على 100 مسبقاً قبل تمريرها لـ
 *     input.value، فتُقسَم القيمة مرتين (10% → 0.001 بدل 0.10) — تلاعب صامت بأرقام
 *     القرار المالي (معدل الخصم، الضريبة، التضخم) دون أي خطأ ظاهر للمستخدم.
 *
 * jsdom لا يهيّئ تخطيط noUiSlider الحقيقي (يعتمد قياسات DOM غير متوفرة)، فالتحقق هنا
 * يراقب مباشرة القيمة التي يُستدعى بها noUiSlider.create() ومعالج 'change' المسجَّل،
 * بدل الاعتماد على تفاعل سلايدر فعلي.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

const createSpy = vi.fn((el) => {
    el.noUiSlider = { on: vi.fn() };
});
vi.mock('nouislider', () => ({
    default: { create: (...args) => createSpy(...args) }
}));

const { Wizard } = await import('../Wizard.js');
const { SECTIONS, createEmptyStudy } = await import('../../core/schema.js');

function fakeStore(state) {
    return {
        get: () => state,
        getState: () => state,
        update: vi.fn(),
        updatePath: vi.fn()
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    createSpy.mockClear();
    document.body.innerHTML = '';
});

describe('Wizard — سلايدرات النسب المئوية في الافتراضات المالية (#slider-percent-double-conversion)', () => {
    it('discountRate=0.10 (معروض "10" في الحقل): noUiSlider.create يُستدعى بـ start=[10] لا [1000]', () => {
        const state = createEmptyStudy();
        state.assumptions.discountRate = 0.10;

        const wizard = new Wizard('c', fakeStore(state), {}, {
            steps: [{ id: SECTIONS.ASSUMPTIONS, label: 'الافتراضات المالية', isForm: true, tables: [] }]
        });
        document.body.innerHTML = `<div id="c"></div>`;
        wizard.container = document.getElementById('c');
        wizard.renderStep(SECTIONS.ASSUMPTIONS, wizard.steps[0], 0);

        const input = wizard.container.querySelector('#field-discountRate');
        expect(input.value).toBe('10'); // renderField: 0.10 → "10"

        // مطابقة العنصر نفسه (input.nextElementSibling) لا range.max — عدة حقول نسبة
        // أخرى في هذه الخطوة (taxRate, inflationRate...) تشارك نفس max=100.
        const call = createSpy.mock.calls.find(([el]) => el === input.nextElementSibling);
        expect(call).toBeTruthy();
        expect(call[1].start).toEqual([10]); // لا [1000] — كان يُقصّ عند 100 فيعرض تلميحاً "100%" مضلِّلاً
    });

    it('معالج change المسجَّل على السلايدر: قيمة 12 (لا 0.12) يجب أن تصل input.value كما هي', () => {
        const state = createEmptyStudy();
        state.assumptions.discountRate = 0.10;

        const wizard = new Wizard('c', fakeStore(state), {}, {
            steps: [{ id: SECTIONS.ASSUMPTIONS, label: 'الافتراضات المالية', isForm: true, tables: [] }]
        });
        document.body.innerHTML = `<div id="c"></div>`;
        wizard.container = document.getElementById('c');
        wizard.renderStep(SECTIONS.ASSUMPTIONS, wizard.steps[0], 0);

        const input = wizard.container.querySelector('#field-discountRate');
        // نلتقط معالج 'change' المسجَّل فعلياً عبر sliderDiv.noUiSlider.on('change', fn)
        const sliderEl = createSpy.mock.calls.map(c => c[0]).find(el => el === input.nextElementSibling);
        const onSpy = sliderEl.noUiSlider.on;
        const changeCall = onSpy.mock.calls.find(([evt]) => evt === 'change');
        expect(changeCall).toBeTruthy();
        const changeHandler = changeCall[1];

        // format.from في الكود الفعلي يحوّل "12%" إلى الرقم 12 قبل وصوله هنا
        changeHandler(['12']);

        // updateStore (غير المعدَّل هنا) هو من يقسم على 100 عند الحفظ — المعالج نفسه
        // يجب ألا يقسم مسبقاً، وإلا وصلت updateStore قيمة 0.12 فقسمتها لـ 0.0012
        expect(input.value).toBe('12');
    });
});
