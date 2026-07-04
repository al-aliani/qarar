/**
 * Idea Assessment View (Section 44–50 / YC Startup School)
 * قسم اختياري "تقييم الفكرة": أسئلة قصيرة (المشكلة، الحل، لماذا أنتم، حجم السوق، الميزة التنافسية)
 * مع عرض نقاط أو تلميحات بناءً على أفضل الممارسات. غير إلزامي؛ لربط الجدوى بمعايير الستارت آب.
 */

import { IDEA_ASSESSMENT_HINTS } from '../config.js';
import { SECTIONS } from '../core/schema.js';
import { toast } from '../utils/toast.js';

export class IdeaAssessmentView {
    constructor(containerId, store, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onBack = options.onBack || (() => {});
    }

    render() {
        if (!this.container) return;
        const state = this.store?.getState?.() ?? this.store?.get?.() ?? {};
        const projectInfo = state.projectInfo || {};
        const idea = projectInfo.ideaAssessment || {};
        const exec = state.executiveSummary || {};
        const market = state.marketSizing || {};

        // Pre-fill from existing sections if ideaAssessment empty
        const problem = idea.problem || exec.problemStatement || '';
        const solution = idea.solution || projectInfo.concept || exec.solutionStatement || '';
        const whyUs = idea.whyUs || '';
        const marketSize = idea.marketSize || this.formatMarketSize(market);
        const competitiveAdvantage = idea.competitiveAdvantage || exec.uniqueValueProposition || '';

        const fields = [
            { key: 'problem', label: 'ما المشكلة؟ لمن؟', value: problem, placeholder: 'صف المشكلة التي يحلها مشروعك ولمن (شريحة العملاء).' },
            { key: 'solution', label: 'ما الحل؟', value: solution, placeholder: 'ما المنتج أو الخدمة التي تقدمها؟ كيف تحل المشكلة؟' },
            { key: 'whyUs', label: 'لماذا أنتم؟', value: whyUs, placeholder: 'لماذا فريقكم قادر على تنفيذ هذا الحل؟ (خبرة، شبكة، تقنية)' },
            { key: 'marketSize', label: 'حجم السوق', value: marketSize, placeholder: 'ما حجم السوق المستهدف؟ (أرقام أو وصف: TAM، SAM، SOM)' },
            { key: 'competitiveAdvantage', label: 'الميزة التنافسية', value: competitiveAdvantage, placeholder: 'ما الذي يمنع المنافسين من نسخكم؟ (ميزة دفاعية)' }
        ];

        const getHintFor = (f) => {
            const hintConfig = IDEA_ASSESSMENT_HINTS.find(h => h.key === f.key);
            const len = (f.value || '').trim().length;
            const ok = hintConfig && len >= (hintConfig.minLength || 10);
            const tip = ok ? `✓ ${hintConfig?.goodHint || 'مكتمل'}` : (hintConfig?.goodHint || 'أضف إجابة واضحة');
            return { tip, ok };
        };

        this.container.innerHTML = `
            <div class="idea-assessment-view animate-entry">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-bold">🚀 تقييم الفكرة (معايير الستارت آب)</h2>
                        <p class="text-muted text-sm mt-1">أسئلة قصيرة لربط جدواك بمعايير المستثمرين والمسرّعات. اختياري — للمشاريع الناشئة.</p>
                    </div>
                    <button type="button" class="btn btn--ghost btn-back-idea" aria-label="رجوع">← رجوع</button>
                </div>

                <div class="card glass-card p-4 mb-4">
                    <p class="text-sm text-muted mb-4">أجب باختصار؛ كل إجابة واضحة ترفع جاهزية الفكرة للمستثمر أو المسرّعة. التلميحات أدناه تعكس أفضل الممارسات (مشكلة واضحة، حل مقنع، إلخ).</p>
                </div>

                <form id="ideaAssessmentForm" class="space-y-6">
                    ${fields.map(f => {
                        const { tip, ok } = getHintFor(f);
                        return `
                        <div class="idea-field">
                            <label class="block font-medium mb-2">${f.label}</label>
                            <textarea name="${f.key}" class="input w-full min-h-[80px]" placeholder="${f.placeholder}" data-key="${f.key}">${(f.value || '').replace(/</g, '&lt;')}</textarea>
                            <div class="idea-hint text-xs mt-1 ${ok ? 'text-success' : 'text-muted'}" data-key="${f.key}">${tip}</div>
                        </div>`;
                    }).join('')}
                </form>

                <div class="flex gap-3 mt-6">
                    <button type="button" id="btnSaveIdeaAssessment" class="btn btn--primary">حفظ التقييم</button>
                    <button type="button" class="btn btn--ghost btn-back-idea">إلغاء ورجوع</button>
                </div>

                <div id="ideaScoreSummary" class="mt-6 p-4 rounded-lg border border-white/10 bg-white/5 hidden">
                    <h4 class="font-bold mb-2">ملخص النقاط</h4>
                    <p class="text-sm text-muted">يُحدّث بعد الحفظ حسب اكتمال كل بند.</p>
                </div>
            </div>
        `;

        this.container.querySelectorAll('.btn-back-idea').forEach(btn => {
            btn.addEventListener('click', () => this.onBack());
        });

        // Dynamic hints on input
        this.container.querySelectorAll('textarea[data-key]').forEach(ta => {
            ta.addEventListener('input', () => this.updateHint(ta.dataset.key));
        });

        this.container.querySelector('#btnSaveIdeaAssessment')?.addEventListener('click', () => this.save());
    }

    formatMarketSize(market) {
        if (!market || typeof market !== 'object') return '';
        const tam = market.tam?.value ?? market.tam;
        const sam = market.sam?.value ?? market.sam;
        const parts = [];
        if (Number(tam) > 0) parts.push(`TAM: ${Number(tam).toLocaleString('ar-SA')} ريال`);
        if (Number(sam) > 0) parts.push(`SAM: ${Number(sam).toLocaleString('ar-SA')} ريال`);
        return parts.join(' — ') || '';
    }

    updateHint(key) {
        const textarea = this.container.querySelector(`textarea[name="${key}"]`);
        const hintEl = this.container.querySelector(`.idea-hint[data-key="${key}"]`);
        if (!textarea || !hintEl) return;
        const config = IDEA_ASSESSMENT_HINTS.find(h => h.key === key);
        const len = (textarea.value || '').trim().length;
        const ok = config && len >= (config.minLength || 10);
        hintEl.textContent = ok ? `✓ ${config.goodHint}` : config?.goodHint || '';
        hintEl.classList.toggle('text-success', ok);
        hintEl.classList.toggle('text-muted', !ok);
    }

    save() {
        const state = this.store?.getState?.() ?? this.store?.get?.() ?? {};
        const projectInfo = { ...(state.projectInfo || {}) };
        projectInfo.ideaAssessment = projectInfo.ideaAssessment || {};

        ['problem', 'solution', 'whyUs', 'marketSize', 'competitiveAdvantage'].forEach(key => {
            const el = this.container.querySelector(`textarea[name="${key}"]`);
            if (el) projectInfo.ideaAssessment[key] = (el.value || '').trim();
        });

        this.store.update(SECTIONS.PROJECT_INFO, projectInfo);
        if (this.store.notify) this.store.notify();
        toast.success('تم حفظ تقييم الفكرة.');
        this.renderScoreSummary();
    }

    renderScoreSummary() {
        const state = this.store?.getState?.() ?? this.store?.get?.() ?? {};
        const idea = state.projectInfo?.ideaAssessment || {};
        let filled = 0;
        IDEA_ASSESSMENT_HINTS.forEach(h => {
            const len = (idea[h.key] || '').trim().length;
            if (len >= (h.minLength || 10)) filled++;
        });
        const total = IDEA_ASSESSMENT_HINTS.length;
        const pct = total ? Math.round((filled / total) * 100) : 0;
        const box = this.container.querySelector('#ideaScoreSummary');
        if (!box) return;
        box.classList.remove('hidden');
        box.innerHTML = `
            <h4 class="font-bold mb-2">ملخص النقاط</h4>
            <p class="text-sm">${filled} من ${total} بنود مكتملة — ${pct}% جاهزية الفكرة للمستثمر/المسرّعة.</p>
            ${pct >= 80 ? '<p class="text-success text-sm mt-2">✓ الفكرة موثقة جيداً — مناسب للمشاركة مع ممول أو مسرّعة.</p>' : '<p class="text-muted text-sm mt-2">أكمل الإجابات الواضحة لرفع النقاط.</p>'}
        `;
    }
}
