/**
 * فرضية المشروع — خطوة تشغيلية مختصرة.
 * المنتجات والخدمات والموقع والأهداف والأدلة لها خطوات مستقلة، لذلك لا تُعاد هنا.
 */

import Swal from 'sweetalert2';
import { InternalAIGenerator } from '../services/InternalAIGenerator.js';
import { escapeHtml } from '../utils/escape.js';
import { toast } from '../utils/toast.js';

const FIELDS = [
    {
        id: 'hypothesis-problem',
        key: 'problem',
        label: 'المشكلة التي تستحق الحل',
        placeholder: 'من يعاني المشكلة؟ وما أثرها عليه؟'
    },
    {
        id: 'hypothesis-solution',
        key: 'solution',
        label: 'الحل الذي سيقدمه المشروع',
        placeholder: 'ماذا سيحصل عليه العميل؟ وكيف يحل مشكلته؟'
    },
    {
        id: 'hypothesis-insight',
        key: 'insight',
        label: 'لماذا سيختارك العميل؟',
        placeholder: 'اذكر سبباً واقعياً واحداً يصعب على المنافس تقليده.'
    }
];

export class IntroductionView {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        if (!this.container) return;

        const hypothesis = this.store.getState().projectInfo?.startupHypothesis || {};
        this.container.innerHTML = `
            <div class="introduction-view">
                <h2 class="section-title">فرضية المشروع</h2>
                <div class="card analysis-card mb-4">
                    <h3 class="card-title">المشكلة والحل وسبب الفوز</h3>
                    <p class="text-muted text-sm mb-3">اكتب إجابة قصيرة ومباشرة في كل خانة. ستُستخدم تلقائياً في نموذج العمل والملخص التنفيذي.</p>
                    ${FIELDS.map(field => `
                        <div class="form-group relative">
                            <div class="flex-between mb-1">
                                <label for="${field.id}">${field.label}</label>
                                <button type="button" class="btn-xs btn-magic btn-ai-suggest" data-target="${field.id}" aria-label="اقتراح صياغة ${field.label}">اقتراح</button>
                            </div>
                            <textarea id="${field.id}" class="input" rows="2" placeholder="${field.placeholder}">${escapeHtml(hypothesis[field.key] || '')}</textarea>
                        </div>
                    `).join('')}
                </div>

                <details class="card analysis-card version-history-panel">
                    <summary class="card-title" style="cursor:pointer;">سجل التغييرات</summary>
                    <div class="text-sm" style="margin-top:var(--s-2);">
                        ${this.renderHistoryPanel()}
                    </div>
                </details>

                <div class="wizard-nav margin-top-lg">
                    <button type="button" class="btn btn--secondary btn-prev-step">السابق</button>
                    <button type="button" class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;
        this.bindEvents();
    }

    /**
     * سجل التغييرات مبني على سجل الإصدارات العام في store.js (آخر 10 حفظات للدراسة كاملة)،
     * لكن يُستخرَج منه هنا فقط حقل الفرضية — عرض فرق كامل للدراسة كلها سيكون ضجيجاً لا فائدة منه هنا.
     */
    renderHistoryPanel() {
        const history = this.store.getVersionHistory?.() || [];
        if (!history.length) {
            return `<p class="text-muted">لا يوجد سجل تغييرات بعد. سيظهر هنا بعد أول حفظ للدراسة.</p>`;
        }
        return history.map((entry, index) => {
            const h = entry.state?.projectInfo?.startupHypothesis || {};
            const when = entry.timestamp ? new Date(entry.timestamp).toLocaleString('ar-SA') : '—';
            return `
                <div class="version-history-entry" data-history-index="${index}" style="padding:8px 0;border-top:1px solid var(--c-border);">
                    <div class="flex-between mb-1">
                        <span class="text-xs text-muted">${when}</span>
                        <button type="button" class="btn-xs btn--secondary btn-restore-hypothesis" data-history-index="${index}">استرجع هذه النسخة</button>
                    </div>
                    <p class="mb-1"><strong>المشكلة:</strong> ${escapeHtml(h.problem || '—')}</p>
                    <p class="mb-1"><strong>الحل:</strong> ${escapeHtml(h.solution || '—')}</p>
                    <p class="mb-1"><strong>سبب الاختيار:</strong> ${escapeHtml(h.insight || '—')}</p>
                </div>
            `;
        }).reverse().join('');
    }

    bindEvents() {
        FIELDS.forEach(field => {
            this.container.querySelector(`#${field.id}`)?.addEventListener('blur', () => this.save());
        });
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            this.save();
            this.onNavigate?.(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            this.save();
            this.onNavigate?.(this.stepIndex + 1);
        });
        this.container.querySelectorAll('.btn-ai-suggest').forEach(button => {
            button.addEventListener('click', () => this.suggest(button));
        });
        this.container.querySelectorAll('.btn-restore-hypothesis').forEach(button => {
            button.addEventListener('click', () => this.restoreHypothesisVersion(button));
        });
    }

    save() {
        const projectInfo = { ...(this.store.getState().projectInfo || {}) };
        const current = { ...(projectInfo.startupHypothesis || {}) };
        FIELDS.forEach(field => {
            const element = this.container.querySelector(`#${field.id}`);
            if (element) current[field.key] = element.value.trim();
        });
        projectInfo.startupHypothesis = current;
        this.store.update('projectInfo', projectInfo);
    }

    async restoreHypothesisVersion(button) {
        const index = parseInt(button.dataset.historyIndex, 10);
        const history = this.store.getVersionHistory?.() || [];
        const entry = history[index];
        if (!entry) return;
        const snapshotHypothesis = entry.state?.projectInfo?.startupHypothesis || {};

        const result = await Swal.fire({
            title: 'استرجاع هذه النسخة؟',
            text: 'سيتم استبدال المشكلة والحل وسبب الاختيار الحاليين بنص هذه النسخة. باقي بيانات الدراسة (المنتجات، الأرقام المالية، ...) لن تتأثر.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'نعم، استرجع',
            cancelButtonText: 'إلغاء',
            customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
            buttonsStyling: false
        });
        if (!result.isConfirmed) return;

        const projectInfo = { ...(this.store.getState().projectInfo || {}) };
        projectInfo.startupHypothesis = { ...snapshotHypothesis };
        this.store.update('projectInfo', projectInfo);
        toast.success('تم استرجاع النسخة المحددة.');
        this.render(this.stepIndex);
    }

    async suggest(button) {
        const targetId = button.dataset.target;
        const element = this.container.querySelector(`#${targetId}`);
        if (!element) return;

        if (element.value.trim().length > 20) {
            const result = await Swal.fire({
                title: 'هل أنت متأكد؟',
                text: 'يوجد نص مكتوب في هذه الخانة. هل تريد استبداله بالاقتراح؟',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، استبدل',
                cancelButtonText: 'إلغاء',
                customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
                buttonsStyling: false
            });
            if (!result.isConfirmed) return;
        }

        const originalLabel = button.textContent;
        button.disabled = true;
        button.textContent = 'جارٍ الاقتراح…';
        try {
            element.value = InternalAIGenerator.generateFieldSuggestion(targetId, element.value, this.store.getState());
            this.save();
            toast.success('تم اقتراح صياغة يمكنك تعديلها.');
        } catch (error) {
            console.error(error);
            toast.error('تعذر إنشاء الاقتراح حالياً.');
        } finally {
            button.disabled = false;
            button.textContent = originalLabel;
        }
    }
}
