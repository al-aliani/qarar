/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-10: خريطة أقسام الدراسة («wizard-section-map» داخل Wizard.js renderStep())
 * كانت تعرض كل الخطوات (42) في شبكة واحدة مسطّحة بلا أي تصنيف، بعكس نمط الصفحة الرئيسية
 * (DashboardView.js — journeySections) الذي يجمّع الخطوات في <details> فرعية لكل فئة من
 * SIDEBAR_SECTIONS (بداية/تسويقية/فنية/مالية/استراتيجية/متقدمة/ملاحق/نتائج) مع عدّاد لكل فئة.
 *
 * هذا الاختبار يثبّت:
 *  1) الخريطة الآن تُرسم كمجموعات <details class="wizard-section-map__group"> — واحدة لكل
 *     فئة من SIDEBAR_SECTIONS، بعنوان مطابق ﻟ section.label وعدّاد صحيح.
 *  2) كل مجموعة تحوي فقط أزرار الخطوات (data-wizard-step-index) التي تقع فعلاً ضمن
 *     range الفئة — لا تسريب خطوات من فئة أخرى.
 *  3) لا يوجد فقدان أو تكرار: مجموع الأزرار عبر كل المجموعات = عدد كل خطوات STEPS.
 *  4) السلوك الحالي محفوظ حرفياً: التظليل is-current للخطوة الحالية، والنقر على أي زر
 *     يستدعي onNavigate بالفهرس المطلق الصحيح تماماً كما كان قبل التجميع.
 *  5) مؤشر "الخطوة السابقة بالموضع" لم يعد يوهم بأنها "✓ مكتملة" — الآن عنوان (title)
 *     صريح "زُرت هذه الخطوة" ورمز غير موحٍ بالاكتمال (لا ✓).
 */
import { describe, it, expect, vi } from 'vitest';
import { Wizard } from '../Wizard.js';
import { STEPS, SIDEBAR_SECTIONS } from '../../core/wizardSteps.js';
import { createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return {
        get: () => state,
        getState: () => state,
        update: vi.fn(),
        updatePath: vi.fn()
    };
}

function buildWizard(onNavigate = vi.fn()) {
    const state = createEmptyStudy();
    document.body.innerHTML = `<div id="c"></div>`;
    const wizard = new Wizard('c', fakeStore(state), {}, { steps: STEPS, onNavigate });
    wizard.container = document.getElementById('c');
    return wizard;
}

describe('Wizard — خريطة أقسام الدراسة مجمّعة حسب SIDEBAR_SECTIONS (لا قائمة مسطّحة)', () => {
    it('ترسم <details> فرعياً واحداً لكل فئة غير فارغة، بعنوان وعدّاد صحيحين', () => {
        const wizard = buildWizard();
        const currentStepIndex = 15; // ضمن نطاق فئة "technical" [12,19]
        wizard.renderStep(STEPS[currentStepIndex].id, STEPS[currentStepIndex], currentStepIndex);

        const groups = wizard.container.querySelectorAll('.wizard-section-map__group');
        const nonEmptySections = SIDEBAR_SECTIONS.filter(s => s.range[1] >= s.range[0]);
        expect(groups.length).toBe(nonEmptySections.length);

        groups.forEach((groupEl, i) => {
            const section = nonEmptySections[i];
            const title = groupEl.querySelector('.wizard-section-map__group-title').textContent.trim();
            expect(title).toBe(section.label);

            const expectedCount = section.range[1] - section.range[0] + 1;
            const countText = groupEl.querySelector('.wizard-section-map__group-count').textContent.trim();
            expect(countText).toBe(expectedCount.toLocaleString('ar-SA'));
        });
    });

    it('كل مجموعة تحوي فقط أزرار خطواتها (لا تسريب بين الفئات)، ومجموع الأزرار = عدد كل STEPS', () => {
        const wizard = buildWizard();
        const currentStepIndex = 3;
        wizard.renderStep(STEPS[currentStepIndex].id, STEPS[currentStepIndex], currentStepIndex);

        let totalButtons = 0;
        const groups = wizard.container.querySelectorAll('.wizard-section-map__group');
        const nonEmptySections = SIDEBAR_SECTIONS.filter(s => s.range[1] >= s.range[0]);

        groups.forEach((groupEl, i) => {
            const section = nonEmptySections[i];
            const buttons = groupEl.querySelectorAll('.wizard-map-step');
            expect(buttons.length).toBe(section.range[1] - section.range[0] + 1);
            buttons.forEach(btn => {
                const idx = Number(btn.dataset.wizardStepIndex);
                expect(idx).toBeGreaterThanOrEqual(section.range[0]);
                expect(idx).toBeLessThanOrEqual(section.range[1]);
            });
            totalButtons += buttons.length;
        });

        expect(totalButtons).toBe(STEPS.length);
    });

    it('لا وجود بعد الآن لحاوية القائمة المسطّحة القديمة (wizard-section-map__list)', () => {
        const wizard = buildWizard();
        wizard.renderStep(STEPS[0].id, STEPS[0], 0);
        expect(wizard.container.querySelector('.wizard-section-map__list')).toBeNull();
        expect(wizard.container.querySelector('.wizard-section-map__groups')).toBeTruthy();
    });

    it('يحافظ على التظليل is-current للخطوة الحالية داخل مجموعتها الصحيحة', () => {
        const wizard = buildWizard();
        const currentStepIndex = 20; // ضمن نطاق فئة "financial" [20,28]
        wizard.renderStep(STEPS[currentStepIndex].id, STEPS[currentStepIndex], currentStepIndex);

        const currentBtn = wizard.container.querySelector('.wizard-map-step.is-current');
        expect(currentBtn).toBeTruthy();
        expect(Number(currentBtn.dataset.wizardStepIndex)).toBe(currentStepIndex);

        // كل الأزرار الأخرى ليست هي المؤشّر الحالي
        const allButtons = wizard.container.querySelectorAll('.wizard-map-step');
        const currentButtons = [...allButtons].filter(b => b.classList.contains('is-current'));
        expect(currentButtons.length).toBe(1);
    });

    it('النقر على زر خطوة (من أي مجموعة) يستدعي onNavigate بنفس الفهرس المطلق كالسابق', () => {
        const onNavigate = vi.fn();
        const wizard = buildWizard(onNavigate);
        wizard.renderStep(STEPS[0].id, STEPS[0], 0);
        wizard.bindNavigationEvents();

        // نختار زراً لخطوة أخرى غير الحالية (مثلاً الفهرس المطلق 25، ضمن فئة financial)
        const targetBtn = wizard.container.querySelector('.wizard-map-step[data-wizard-step-index="25"]');
        expect(targetBtn).toBeTruthy();
        targetBtn.click();

        expect(onNavigate).toHaveBeenCalledWith(25);
    });

    it('المؤشر الموضعي "زرت" صريح ولا يوهم بالاكتمال: title="زُرت هذه الخطوة" لا رمز ✓', () => {
        const wizard = buildWizard();
        const currentStepIndex = 10;
        wizard.renderStep(STEPS[currentStepIndex].id, STEPS[currentStepIndex], currentStepIndex);

        // خطوة سابقة بالموضع (زُرناها) — الفهرس المطلق 2 أقل من الحالية 10
        const visitedBtn = wizard.container.querySelector('.wizard-map-step[data-wizard-step-index="2"]');
        expect(visitedBtn).toBeTruthy();
        expect(visitedBtn.title).toBe('زُرت هذه الخطوة');
        expect(visitedBtn.textContent).not.toContain('✓');
        expect(visitedBtn.querySelector('span').textContent.trim()).toBe('•');

        // خطوة الحالية نفسها
        const currentBtn = wizard.container.querySelector('.wizard-map-step.is-current');
        expect(currentBtn.title).toBe('الخطوة الحالية');

        // خطوة لاحقة لم تُزر بعد — تعرض رقمها فقط، بلا ادعاء اكتمال
        const upcomingBtn = wizard.container.querySelector('.wizard-map-step[data-wizard-step-index="11"]');
        expect(upcomingBtn).toBeTruthy();
        expect(upcomingBtn.title).not.toBe('زُرت هذه الخطوة');
        expect(upcomingBtn.title).not.toMatch(/مكتمل/);
    });
});
