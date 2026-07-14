/**
 * نموذج العمل (Business Model Canvas)
 * عرض وتحرير مكوّنات نموذج العمل — أداة تفكير استراتيجي وتوثيق لصاحب المشروع.
 * ملاحظة: هذا القسم لا يُغذّي حالياً محرك القرار المالي الآلي ولا الملخص التنفيذي
 * (بياناته تُقرأ وتُكتب هنا فقط)، لكنه يساعدك على توضيح نموذج عملك لنفسك وللقارئ.
 */

import { SECTIONS } from '../core/schema.js';
import { InternalAIGenerator } from '../services/InternalAIGenerator.js';
import { toast } from '../utils/toast.js';
import { escapeHtml } from '../utils/escape.js';
import Sortable from 'sortablejs';
import LeaderLine from 'leader-line-new';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11. (أيقونات بلوكات
// Business Model Canvas التسع تُترك كمجموعة دلالية متمايزة بلا مقابل sprite مفرد.)
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

// مستمع واحد على مستوى الوحدة (لا واحد لكل نسخة/تنقّل) — يمنع تراكم مستمعي
// resize يتيمين يعيدون رسم خطوط موصولة مكرَّرة عند كل عودة لهذه الخطوة.
let activeBusinessModelView = null;
if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => activeBusinessModelView?.drawLines());
}

const BLOCKS = [
    { key: 'valueProposition', label: 'عرض القيمة', icon: '💎', placeholder: 'ما الذي يقدّمه المشروع للعميل؟ ما المشكلة التي يحلها؟' },
    { key: 'customerSegments', label: 'شرائح العملاء', icon: '👥', placeholder: 'من هم العملاء المستهدفون؟ ما خصائصهم وحاجاتهم؟' },
    { key: 'channels', label: 'قنوات الوصول', icon: '📡', placeholder: 'كيف تصل للعميل؟ (متجر، إلكتروني، وكلاء، إلخ)' },
    { key: 'customerRelationships', label: 'علاقات العملاء', icon: '🤝', placeholder: 'طبيعة العلاقة: ذاتية الخدمة، مساعدة شخصية، مجتمع، اشتراك...' },
    { key: 'revenueStreams', label: 'مصادر الإيرادات', icon: '💰', placeholder: 'كيف يحقق المشروع الإيراد؟ (مبيعات، اشتراكات، إعلانات...)' },
    { key: 'keyResources', label: 'الموارد الأساسية', icon: '🏛️', placeholder: 'الأصول الحرجة: أصول مادية، بشرية، فكرية، مالية' },
    { key: 'keyActivities', label: 'الأنشطة الأساسية', icon: '⚙️', placeholder: 'أهم ما يجب أن يفعله المشروع لينجح' },
    { key: 'keyPartners', label: 'الشراكات الأساسية', icon: '🔗', placeholder: 'المورّدون، التحالفات، الشراكات الاستراتيجية' },
    { key: 'costStructure', label: 'هيكل التكاليف', icon: '📉', placeholder: 'أهم بنود التكلفة: ثابتة، متغيرة، اقتصاديات الحجم' }
];

export class BusinessModelView {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
        this.isGenerating = false;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        const bm = state[SECTIONS.BUSINESS_MODEL] || state.businessModel || {};

        this.container.innerHTML = `
            <div class="business-model-view animate-entry">
                <div class="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <h2 class="section-title flex items-center gap-2">
                            نموذج العمل
                        </h2>
                        <p class="text-muted text-sm max-w-2xl">
                            لخّص مكوّنات نموذج العمل وفق إطار Business Model Canvas. يساعدك هذا القسم على توضيح فكرة مشروعك وتوحيد رؤيتك الاستراتيجية لنفسك — ملاحظة: هذه البيانات توثيقية حالياً ولا تدخل تلقائياً في حساب القرار المالي أو الملخص التنفيذي.
                        </p>
                    </div>
                    <button type="button" class="btn btn-magic ai-bm-btn flex-shrink-0 flex items-center gap-2" title="توليد الحقول من بيانات المشروع المدخلة (بدون اتصال خارجي)">
                        <span>${icon('i-sparkle')}</span>
                        <span class="ai-bm-btn-text">توليد تلقائي من بيانات المشروع</span>
                    </button>
                </div>

                <div class="bm-grid" id="bm-sortable-grid">
                    ${BLOCKS.map(block => `
                        <div class="card bm-block" id="bm-block-${block.key}" style="cursor: move;">
                            <div class="bm-block-header">
                                <span class="bm-icon">${block.icon}</span>
                                <h4 class="bm-label">${block.label}</h4>
                            </div>
                            <textarea
                                class="input bm-textarea"
                                data-field="${block.key}"
                                placeholder="${block.placeholder}"
                                rows="3"
                                style="cursor: text;"
                            >${escapeHtml(bm[block.key])}</textarea>
                        </div>
                    `).join('')}
                </div>

                <div class="wizard-nav margin-top-lg">
                    <button type="button" class="btn btn--secondary btn-prev-step">السابق</button>
                    <button type="button" class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        this.container.querySelectorAll('.bm-textarea').forEach(ta => {
            ta.addEventListener('input', (e) => this.updateField(e));
            ta.addEventListener('blur', (e) => this.updateField(e));
        });

        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            this.clearLines();
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });

        this.container.querySelector('.ai-bm-btn')?.addEventListener('click', () => this.generateFromData());

        // Init Sortable
        const grid = this.container.querySelector('#bm-sortable-grid');
        if (grid) {
            Sortable.create(grid, {
                animation: 150,
                ghostClass: 'bg-slate-800',
                onEnd: () => {
                    this.drawLines();
                }
            });
        }

        // Draw connections after a short delay to ensure DOM is ready
        activeBusinessModelView = this;
        setTimeout(() => this.drawLines(), 500);
    }

    clearLines() {
        if (this.lines) {
            this.lines.forEach(line => { try { line.remove(); } catch(e){} });
        }
        this.lines = [];
    }

    drawLines() {
        this.clearLines();
        try {
            const vp = document.getElementById('bm-block-valueProposition');
            const cs = document.getElementById('bm-block-customerSegments');
            const rev = document.getElementById('bm-block-revenueStreams');
            
            if (vp && cs) {
                this.lines.push(new LeaderLine(vp, cs, { color: '#0ea5e9', size: 3, path: 'fluid', dash: {animation: true} }));
            }
            if (cs && rev) {
                this.lines.push(new LeaderLine(cs, rev, { color: '#10b981', size: 3, path: 'fluid', dash: {animation: true} }));
            }
        } catch (e) {
            console.warn('LeaderLine error:', e);
        }
    }

    generateFromData() {
        if (this.isGenerating) return;
        const btn = this.container.querySelector('.ai-bm-btn');
        const textEl = this.container.querySelector('.ai-bm-btn-text');
        if (!btn) return;

        this.isGenerating = true;
        btn.disabled = true;
        const origText = textEl?.textContent || '';
        if (textEl) textEl.textContent = 'جاري التوليد...';

        try {
            const state = this.store.getState();
            const parsed = InternalAIGenerator.generateBusinessModel(state);

            if (!parsed || typeof parsed !== 'object') {
                toast.error('لم يتم التوليد. تأكد من إدخال بيانات المشروع الأساسية.');
                return;
            }

            const keys = BLOCKS.map(b => b.key);
            const defaults = Object.fromEntries(keys.map(k => [k, '']));
            const merged = { ...defaults };
            for (const k of keys) {
                const v = parsed[k];
                if (v != null && String(v).trim()) merged[k] = String(v).trim();
            }

            this.store.update(SECTIONS.BUSINESS_MODEL, merged);
            this.render();
            toast.success('تم التوليد من بيانات الدراسة. يمكنك تعديل النصوص حسب الحاجة.');
        } catch (e) {
            console.error('Internal generator error:', e);
            toast.error('فشل التوليد: ' + (e?.message || 'خطأ غير متوقع'));
        } finally {
            this.isGenerating = false;
            btn.disabled = false;
            if (textEl) textEl.textContent = origText;
        }
    }

    updateField(e) {
        const field = e.target.dataset.field;
        const value = e.target.value || '';

        const state = this.store.getState();
        const section = SECTIONS.BUSINESS_MODEL;
        const defaults = Object.fromEntries(BLOCKS.map(b => [b.key, '']));
        const current = { ...defaults, ...(state[section] || state.businessModel || {}) };
        this.store.update(section, { ...current, [field]: value });
    }
}
