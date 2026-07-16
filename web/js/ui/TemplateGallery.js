/**
 * TemplateGallery.js
 * نقطة بداية الدراسة.
 *
 * القوالب الرقمية الجاهزة أُزيلت عمداً: دراسة قطاعية كاملة يجب أن تكون من مختص
 * معروف النطاق والخبرة ومراجعة الأرقام، لا من أرقام افتراضية عامة.
 */

import Swal from 'sweetalert2';
import { DEFAULT_STUDY_PREPARED_BY } from '../config.js';
import {
    applyExpertTemplate,
    getExpertTemplates
} from '../services/ExpertTemplateService.js';
import { STEPS, isStepVisibleInStudyMode, STEPS_ABSORBED_IN_CATEGORY_VIEW } from '../core/wizardSteps.js';
import { trackEvent } from '../utils/analytics.js';

// عدد خطوات كل وضع — محسوب من مصدر الحقيقة الوحيد (wizardSteps.js) لا رقماً مُخمَّناً،
// ومطابق لما يراه المستخدم فعلياً في صفحة الفئات: يستبعد الخطوات المستوعَبة بصرياً داخل
// شاشة مدموجة أخرى (اللوجستيات/الإدارية داخل «المصاريف التشغيلية») في كل الأوضاع، تماماً
// كما يحسبها app.js (categoryVisibleStepIndexes) كي لا ينحرف الرقمان عن بعضهما.
const ABSORBED_STEP_IDS = new Set(STEPS_ABSORBED_IN_CATEGORY_VIEW);
const modeStepCount = (modeId) => STEPS.filter(s => !ABSORBED_STEP_IDS.has(s.id) && isStepVisibleInStudyMode(s.id, modeId)).length;

// أوضاع الدراسة — كانت مدفونة في خطوة القوالب؛ صارت اختياراً واضحاً عند البداية
const STUDY_MODES = [
    { id: 'mini', icon: '🌱', name: 'مصغّر (للمبتدئين)', desc: `المشروع، التكاليف، الفريق، الإيرادات، التمويل، القرار — أقل الأسئلة للوصول لقرار سريع (${modeStepCount('mini')} خطوات تقريباً).` },
    { id: 'simple', icon: '📋', name: 'بسيط', desc: `الأقسام الأساسية للدراسة دون التحليلات المتقدمة (حساسية، سيناريوهات، مونت كارلو، تقييم…) — ${modeStepCount('simple')} خطوة تقريباً.` },
    { id: 'advanced', icon: '📊', name: 'مفصل', desc: `الدراسة الكاملة بكل الأقسام والتحليلات — جاهزة للبنك والمستثمر (${modeStepCount('advanced')} خطوة).`, badge: 'موصى به لبنك/مستثمر' }
];

const escapeAttribute = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeHtml = (value) => escapeAttribute(value).replace(/>/g, '&gt;');

export class TemplateGallery {
    static getFullStudyTemplates() {
        return [];
    }

    constructor(overlayId, store) {
        this.overlay = document.getElementById(overlayId);
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = overlayId || 'templateGalleryOverlay';
            this.overlay.className = 'modal-overlay';
            document.body.appendChild(this.overlay);
        }
        this.store = store;
        this.templates = this.getTemplates();
    }

    getTemplates() {
        return [
            {
                id: 'empty',
                name: 'مشروع فارغ (من الصفر)',
                description: 'ابدأ دراسة جديدة ببياناتك الفعلية، ثم عدّل كل قسم حسب مشروعك.',
                data: null
            }
        ];
    }

    open() {
        this.render();
        this.overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        this._onEscape = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._onEscape);
        this.overlay.querySelector('.btn-close')?.focus();
    }

    close() {
        this.overlay.classList.remove('is-open');
        document.body.style.overflow = '';
        if (this._onEscape) {
            document.removeEventListener('keydown', this._onEscape);
            this._onEscape = null;
        }
    }

    render() {
        const expertTemplates = getExpertTemplates();
        const emptyTemplate = this.templates[0];
        this.overlay.innerHTML = `
            <div class="modal-card template-modal template-gallery animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="template-gallery-title">
                <div class="modal-header">
                    <h3 id="template-gallery-title">
                        <svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg>
                        اختر نقطة البداية
                    </h3>
                    <button class="btn-close" type="button" aria-label="إغلاق النافذة">×</button>
                </div>
                <div class="modal-body">
                    <div class="tg-hero">
                        <span class="tg-hero__icon" aria-hidden="true"><svg class="ic"><use href="#i-doc"/></svg></span>
                        <h4 class="tg-hero__title">${escapeHtml(emptyTemplate.name)}</h4>
                        <p class="tg-hero__desc">القوالب القطاعية الكاملة ستكون فقط من مختصين معتمدين لاحقاً. ${escapeHtml(emptyTemplate.description)}</p>
                        <ul class="tg-benefits">
                            <li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg> بياناتك الفعلية من أول خطوة</li>
                            <li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg> عدّل أي قسم لاحقاً بحرية</li>
                            <li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg> بلا أرقام افتراضية جاهزة</li>
                        </ul>
                        <button type="button" class="btn btn--primary tg-hero__cta" id="btnStartBlank">ابدأ الآن ←</button>
                    </div>

                    <p class="tg-rows-label">موارد إضافية</p>
                    <div class="tg-rows">
                        ${expertTemplates.length ? expertTemplates.map(t => `
                            <button type="button" class="tg-row tg-row--clickable btn-apply-expert-template" data-id="${escapeAttribute(t.id)}" aria-label="${escapeAttribute(t.title)}: ${escapeAttribute(t.expertName)} — ${escapeAttribute(t.specialty)} — ${Number(t.yearsExperience) || 0} سنة خبرة">
                                <span class="tg-row__icon" aria-hidden="true"><svg class="ic"><use href="#i-star"/></svg></span>
                                <span class="tg-row__body">
                                    <span class="tg-row__title">${escapeHtml(t.title)}</span>
                                    <span class="tg-row__desc">${escapeHtml(t.expertName)} — ${escapeHtml(t.specialty)} — ${Number(t.yearsExperience) || 0} سنة خبرة</span>
                                </span>
                            </button>
                        `).join('') : `
                            <div class="tg-row tg-row--muted">
                                <span class="tg-row__icon" aria-hidden="true"><svg class="ic"><use href="#i-star"/></svg></span>
                                <span class="tg-row__body">
                                    <span class="tg-row__title">قوالب المختصين المعتمدة</span>
                                    <span class="tg-row__desc">لا توجد قوالب معتمدة حالياً — تظهر هنا لاحقاً مع اسم الخبير وسنوات خبرته وسعرها.</span>
                                </span>
                                <span class="tg-row__tag">قريباً</span>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        this.overlay.querySelector('.btn-close').onclick = () => this.close();
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.close(); };

        this.overlay.querySelector('#btnStartBlank').onclick = () => this.renderBlankAttributionForm();

        this.overlay.querySelectorAll('.btn-apply-expert-template').forEach(btn => {
            btn.onclick = async () => {
                const template = getExpertTemplates().find(t => t.id === btn.dataset.id);
                if (!template) return;
                const result = await Swal.fire({
                    title: 'هل أنت متأكد؟',
                    text: `تطبيق قالب «${template.title}» سيستبدل الدراسة الحالية بدراسة جديدة مبنية على القالب. هل تريد المتابعة؟`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، طبّق',
                    cancelButtonText: 'إلغاء',
                    customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
                    buttonsStyling: false
                });
                if (!result.isConfirmed) return;
                applyExpertTemplate(this.store, template);
                window.dispatchEvent(new CustomEvent('project-loaded', { detail: { source: 'expert-template', name: template.title } }));
                this.close();
            };
        });
    }

    /**
     * نموذج اعتماد الدراسة باسم العميل (للمشروع الفارغ): معدّ الدراسة قد يكون مستشاراً
     * يبيعها لعميله — الاسم يظهر على غلاف التقارير («أُعدت هذه الدراسة لصالح: …»).
     */
    renderBlankAttributionForm() {
        const body = this.overlay.querySelector('.modal-body');
        if (!body) { this.selectTemplate('empty'); return; }
        // الافتراضي دائماً «مفصل» عند فتح هذه النافذة — لا تذكّر آخر اختيار يدوي (تحقّق
        // 2026-07-15: appSettings.mode هنا كان يقرأ حالة الدراسة السابقة/الحالية المتبقية
        // في المخزن قبل استدعاء store.reset() أدناه، وليس تفضيلاً متعمَّداً محفوظاً لهذه
        // النافذة تحديداً. آلية التفضيل الفعلية عبر الجلسات — localStorage['study_mode_preference']
        // المستهلكة في app.js/SimpleModeController.js — لغرض مختلف تماماً (الوضع الفعّال
        // لدراسة قائمة بالفعل) ولم تُمس هنا.
        const currentMode = 'advanced';
        body.innerHTML = `
            <div class="blank-attribution-form">
                <p class="template-gallery__lead"><strong>ابدأ دراستك — اختر مستوى التفصيل</strong></p>
                <p class="text-sm text-muted mb-3">اختر ما يناسب خبرتك ووقتك؛ يمكنك تغييره لاحقاً في أي وقت.</p>
                <div class="mode-cards" role="radiogroup" aria-label="مستوى تفصيل الدراسة">
                    ${STUDY_MODES.map(m => `
                        <button type="button" class="mode-card ${m.id === currentMode ? 'active' : ''}" data-mode="${m.id}" role="radio" aria-checked="${m.id === currentMode}" aria-label="${escapeAttribute(m.name)}: ${escapeAttribute(m.desc)}${m.badge ? ' — ' + escapeAttribute(m.badge) : ''}">
                            ${m.badge ? `<span class="mode-card__badge" style="display:block;font-size:.7rem;font-weight:700;color:var(--c-primary,#0f5132);margin-bottom:4px;">${m.badge}</span>` : ''}
                            <span class="mode-card__icon" aria-hidden="true" style="font-size:1.5rem;">${m.icon}</span>
                            <span class="mode-card__name" style="display:block;font-weight:700;font-size:1.05rem;margin-top:4px;">${m.name}</span>
                            <span class="mode-card__desc">${m.desc}</span>
                        </button>
                    `).join('')}
                </div>

                <details class="mt-3">
                    <summary style="cursor:pointer; font-size:.9rem; color:var(--c-text-muted);">اعتماد الدراسة باسم عميل (اختياري — للمستشارين)</summary>
                    <div class="mt-2">
                        <div class="form-group">
                            <label for="blankClientName">اعتماد الدراسة باسم (العميل / الجهة المالكة)</label>
                            <input type="text" id="blankClientName" class="input" placeholder="مثال: مؤسسة النخبة التجارية — أحمد العتيبي" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label for="blankPreparedBy">إعداد (اسم المستشار / الجهة المعدّة)</label>
                            <input type="text" id="blankPreparedBy" class="input" placeholder="مثال: مكتب رؤية للاستشارات" value="${escapeAttribute(DEFAULT_STUDY_PREPARED_BY)}" autocomplete="off">
                        </div>
                    </div>
                </details>

                <div class="flex-between gap-3 mt-4">
                    <button type="button" class="btn btn--ghost" id="btnBlankBack">رجوع</button>
                    <button type="button" class="btn btn--primary" id="btnBlankCreate">إنشاء الدراسة ←</button>
                </div>
            </div>
        `;
        let selectedMode = currentMode;
        body.querySelectorAll('.mode-card').forEach(card => {
            card.onclick = () => {
                selectedMode = card.dataset.mode;
                body.querySelectorAll('.mode-card').forEach(c => {
                    const on = c === card;
                    c.classList.toggle('active', on);
                    c.setAttribute('aria-checked', on ? 'true' : 'false');
                });
            };
        });
        // نضبط الوضع والاعتماد قبل بثّ project-loaded كي يُرسم التطبيق بالوضع الصحيح مباشرة
        const createBlank = async () => {
            const clientName = body.querySelector('#blankClientName')?.value.trim() || '';
            const preparedBy = body.querySelector('#blankPreparedBy')?.value.trim() || '';
            if (this.store.reset) await this.store.reset();
            this.store.update('appSettings', { mode: selectedMode });
            if (clientName || preparedBy) {
                this.store.updatePath('projectInfo', 'clientName', clientName);
                this.store.updatePath('projectInfo', 'preparedBy', preparedBy);
            }
            if (this.store.flush) await this.store.flush();
            trackEvent('study_created', { source: 'blank' });
            window.dispatchEvent(new CustomEvent('project-loaded', { detail: { source: 'blank', name: 'مشروع جديد' } }));
            this.close();
        };
        body.querySelector('#btnBlankCreate').onclick = () => createBlank();
        body.querySelector('#btnBlankBack').onclick = () => this.render();
        body.querySelector('.mode-card.active')?.focus();
    }

    async selectTemplate(id) {
        if (id !== 'empty') return;

        if (this.store.reset) await this.store.reset();
        trackEvent('study_created', { source: 'template' });
        window.dispatchEvent(new CustomEvent('project-loaded', { detail: { source: 'blank', name: 'مشروع جديد' } }));
        this.close();
    }
}
