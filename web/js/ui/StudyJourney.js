import { SIDEBAR_SECTIONS, STEPS } from '../core/wizardSteps.js';
import { escapeHtml } from '../utils/escape.js';

const arabicNumber = (value) => new Intl.NumberFormat('ar-SA-u-nu-arab', {
    maximumFractionDigits: 0
}).format(Number(value) || 0);

export function getStudyJourneyContext(activeStepIndex, steps = STEPS, stepIndexMap = null, sections = SIDEBAR_SECTIONS, masterSteps = STEPS) {
    const visibleSteps = Array.isArray(steps) && steps.length ? steps : STEPS;
    const absoluteIndices = Array.isArray(stepIndexMap) && stepIndexMap.length === visibleSteps.length
        ? stepIndexMap
        : visibleSteps.map((step, index) => {
            const absolute = masterSteps.indexOf(step);
            return absolute >= 0 ? absolute : index;
        });

    let localIndex = absoluteIndices.indexOf(activeStepIndex);
    if (localIndex < 0) localIndex = Math.min(Math.max(Number(activeStepIndex) || 0, 0), visibleSteps.length - 1);

    const absoluteIndex = absoluteIndices[localIndex] ?? localIndex;
    const section = sections.find(item => (
        absoluteIndex >= item.range[0] && absoluteIndex <= item.range[1]
    )) || sections[0];
    const total = visibleSteps.length;
    const position = localIndex + 1;

    return {
        visibleSteps,
        absoluteIndices,
        localIndex,
        absoluteIndex,
        position,
        total,
        percent: total ? Math.round((position / total) * 100) : 0,
        section
    };
}

export class StudyJourney {
    constructor(options = {}) {
        this.header = document.getElementById(options.headerId || 'headerStageBar');
        this.mobile = document.getElementById(options.mobileId || 'mobileStageIndicator');
        this.breadcrumb = document.getElementById(options.breadcrumbId || 'breadcrumbBar');
        this.openButton = document.getElementById(options.openButtonId || 'btnOpenStudyMap');
        this.dialog = document.getElementById(options.dialogId || 'studyMapDialog');
        this.onNavigate = options.onNavigate || (() => {});
        this.steps = options.steps || STEPS;
        this.masterSteps = options.masterSteps || STEPS;
        this.sections = options.sections || SIDEBAR_SECTIONS;
        this.unitLabel = options.unitLabel || 'الخطوة';
        this.mapHeading = options.mapHeading || 'انتقل إلى أي خطوة';
        this.stepIndexMap = options.stepIndexMap || null;
        this.activeStepIndex = 0;
        this.bindEvents();
    }

    setSteps(steps, stepIndexMap = null) {
        this.steps = Array.isArray(steps) && steps.length ? steps : STEPS;
        this.stepIndexMap = Array.isArray(stepIndexMap) ? stepIndexMap : null;
        this.update(this.activeStepIndex);
    }

    update(activeStepIndex = 0) {
        this.activeStepIndex = Number.isInteger(activeStepIndex) ? activeStepIndex : 0;
        const context = getStudyJourneyContext(this.activeStepIndex, this.steps, this.stepIndexMap, this.sections, this.masterSteps);
        const position = arabicNumber(context.position);
        const total = arabicNumber(context.total);
        const stepText = `${this.unitLabel} ${position} من ${total}`;

        if (this.header) {
            this.header.innerHTML = `
                <span class="stage-badge">
                    <span class="stage-badge__meta">${stepText}</span>
                    <span class="stage-badge__label">${escapeHtml(context.section.label)}</span>
                </span>`;
            this.header.setAttribute('aria-label', `${stepText} — ${context.section.label}`);
        }

        if (this.mobile) {
            this.mobile.textContent = `${position}/${total} · ${context.section.label}`;
            this.mobile.setAttribute('aria-label', `${stepText} — ${context.section.label}`);
        }

        if (this.breadcrumb) {
            this.breadcrumb.style.setProperty('--journey-progress', `${context.percent}%`);
            this.breadcrumb.setAttribute('aria-label', `مسار التنقل — ${stepText}`);
        }

        if (this.openButton) {
            const mapLabel = this.unitLabel === 'التصنيف' ? 'تصنيفات الدراسة' : 'كل خطوات الدراسة';
            this.openButton.setAttribute('aria-label', `عرض ${mapLabel} — ${stepText}`);
        }

        this.renderDialog(context);
        return context;
    }

    renderDialog(context) {
        if (!this.dialog) return;

        const groups = this.unitLabel === 'التصنيف'
            ? `<section class="study-map__group"><div class="study-map__steps study-map__steps--categories">${context.visibleSteps.map((step, localIndex) => {
                const absoluteIndex = context.absoluteIndices[localIndex];
                const isCurrent = absoluteIndex === context.absoluteIndex;
                return `<button type="button" class="study-map__step ${isCurrent ? 'is-current' : ''}" data-study-step="${absoluteIndex}" ${isCurrent ? 'aria-current="step"' : ''}><span class="study-map__number">${arabicNumber(localIndex + 1)}</span><span>${escapeHtml(step.label)}</span></button>`;
            }).join('')}</div></section>`
            : this.sections.map(section => {
            const items = context.visibleSteps.map((step, localIndex) => ({
                step,
                localIndex,
                absoluteIndex: context.absoluteIndices[localIndex]
            })).filter(item => (
                item.absoluteIndex >= section.range[0] && item.absoluteIndex <= section.range[1]
            ));

            if (!items.length) return '';
            return `
                <section class="study-map__group" aria-labelledby="study-map-${section.id}">
                    <h3 id="study-map-${section.id}" class="study-map__group-title">${escapeHtml(section.label)}</h3>
                    <div class="study-map__steps">
                        ${items.map(item => {
                            const isCurrent = item.absoluteIndex === context.absoluteIndex;
                            return `
                                <button type="button"
                                    class="study-map__step ${isCurrent ? 'is-current' : ''}"
                                    data-study-step="${item.absoluteIndex}"
                                    ${isCurrent ? 'aria-current="step"' : ''}>
                                    <span class="study-map__number">${arabicNumber(item.localIndex + 1)}</span>
                                    <span>${escapeHtml(item.step.label)}</span>
                                </button>`;
                        }).join('')}
                    </div>
                </section>`;
        }).join('');

        this.dialog.innerHTML = `
            <div class="study-map__header">
                <div>
                    <p class="study-map__eyebrow">مسار الدراسة</p>
                    <h2>${escapeHtml(this.mapHeading)}</h2>
                </div>
                <button type="button" class="study-map__close" data-study-map-close aria-label="إغلاق">×</button>
            </div>
            <div class="study-map__groups">${groups}</div>`;
    }

    bindEvents() {
        this.openButton?.addEventListener('click', () => {
            if (!this.dialog) return;
            if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
            else this.dialog.setAttribute('open', '');
        });

        this.dialog?.addEventListener('click', (event) => {
            const closeButton = event.target.closest('[data-study-map-close]');
            if (closeButton) {
                this.close();
                return;
            }

            const stepButton = event.target.closest('[data-study-step]');
            if (!stepButton) return;
            const target = Number(stepButton.dataset.studyStep);
            if (!Number.isInteger(target) || target < 0) return;
            this.close();
            this.onNavigate(target);
        });
    }

    close() {
        if (!this.dialog) return;
        if (typeof this.dialog.close === 'function' && this.dialog.open) this.dialog.close();
        else this.dialog.removeAttribute('open');
    }
}
