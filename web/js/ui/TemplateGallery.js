/**
 * TemplateGallery.js
 * نقطة بداية الدراسة.
 *
 * القوالب الرقمية الجاهزة أُزيلت عمداً: دراسة قطاعية كاملة يجب أن تكون من مختص
 * معروف النطاق والخبرة ومراجعة الأرقام، لا من أرقام افتراضية عامة.
 */

import { DEFAULT_STUDY_PREPARED_BY } from '../config.js';
import {
    applyExpertTemplate,
    getExpertTemplates
} from '../services/ExpertTemplateService.js';
import { HRFilesView } from './HRFilesView.js';

// أوضاع الدراسة — كانت مدفونة في خطوة القوالب؛ صارت اختياراً واضحاً عند البداية
const STUDY_MODES = [
    { id: 'mini', icon: '🌱', name: 'مصغّر (للمبتدئين)', desc: 'المشروع، التكاليف، الفريق، الإيرادات، التمويل، القرار — أقل الأسئلة للوصول لقرار سريع.' },
    { id: 'simple', icon: '📋', name: 'بسيط', desc: 'الأقسام الأساسية للدراسة دون التحليلات المتقدمة (حساسية، سيناريوهات، مونت كارلو، تقييم…).' },
    { id: 'advanced', icon: '📊', name: 'مفصل', desc: 'الدراسة الكاملة بكل الأقسام والتحليلات — جاهزة للبنك والمستثمر.' }
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
                icon: '📄',
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
        this._hrFilesView = null;
        const expertTemplates = getExpertTemplates();
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
                    <p class="template-gallery__lead">القوالب القطاعية الكاملة ستكون فقط من مختصين معتمدين. حالياً ابدأ من الصفر ببيانات مشروعك الفعلية.</p>

                    <div class="templates-grid" role="list">
                        ${this.templates.map(t => `
                            <button class="template-card" type="button" data-id="${t.id}" role="listitem">
                                <span class="t-icon" aria-hidden="true">${t.icon}</span>
                                <span class="t-info">
                                    <span class="t-name">${t.name}</span>
                                    <span class="t-desc">${t.description}</span>
                                </span>
                            </button>
                        `).join('')}
                    </div>

                    <div class="card mt-4" style="border:1px solid var(--c-border); background:rgba(255,255,255,0.03);">
                        <h4 class="card-title mb-1">قوالب المختصين المعتمدة</h4>
                        ${expertTemplates.length ? `
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                ${expertTemplates.map(t => `
                                    <button type="button" class="template-card btn-apply-expert-template" data-id="${escapeAttribute(t.id)}" style="text-align:right;">
                                        <span class="t-icon" aria-hidden="true">✓</span>
                                        <span class="t-info">
                                            <span class="t-name">${escapeHtml(t.title)}</span>
                                            <span class="t-desc">${escapeHtml(t.expertName)} — ${escapeHtml(t.specialty)} — ${Number(t.yearsExperience) || 0} سنة خبرة</span>
                                        </span>
                                    </button>
                                `).join('')}
                            </div>
                        ` : `<p class="text-sm text-muted mb-0">لا توجد قوالب معتمدة حالياً. لاحقاً يظهر هنا قالب الخبير مع اسمه، سنوات خبرته، نطاق القطاع، تاريخ التحديث، وسعر القالب أو الاستشارة.</p>`}
                    </div>

                    <div class="card mt-4" style="border:1px solid var(--c-border); background:rgba(255,255,255,0.03);">
                        <div class="flex-between" style="align-items:flex-start; gap:12px; flex-wrap:wrap;">
                            <div>
                                <h4 class="card-title mb-1">الموارد البشرية</h4>
                                <p class="text-sm text-muted mb-0">نماذج ووصف وظيفي وملفات إدارية جاهزة — هياكل تنظيمية، رواتب، تقييم أداء، وتوظيف.</p>
                            </div>
                            <button type="button" class="btn btn--ghost btn--sm" id="btnToggleHrFiles" aria-expanded="false" aria-controls="galleryHrFilesRoot">تصفّح الملفات</button>
                        </div>
                        <div id="galleryHrFilesRoot" class="mt-3" hidden></div>
                    </div>
                </div>
            </div>
        `;

        this.overlay.querySelector('.btn-close').onclick = () => this.close();
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.close(); };

        const hrToggle = this.overlay.querySelector('#btnToggleHrFiles');
        const hrRoot = this.overlay.querySelector('#galleryHrFilesRoot');
        if (hrToggle && hrRoot) {
            hrToggle.addEventListener('click', async () => {
                const willOpen = hrRoot.hidden;
                hrRoot.hidden = !willOpen;
                hrToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                hrToggle.textContent = willOpen ? 'إخفاء الملفات' : 'تصفّح الملفات';
                if (willOpen && !this._hrFilesView) {
                    this._hrFilesView = new HRFilesView('galleryHrFilesRoot');
                    await this._hrFilesView.render();
                }
            });
        }

        this.overlay.querySelectorAll('.template-card').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                if (id === 'empty') {
                    this.renderBlankAttributionForm();
                    return;
                }
                this.selectTemplate(id);
            };
        });

        this.overlay.querySelectorAll('.btn-apply-expert-template').forEach(btn => {
            btn.onclick = () => {
                const template = getExpertTemplates().find(t => t.id === btn.dataset.id);
                if (!template) return;
                if (!window.confirm(`تطبيق قالب «${template.title}» سيستبدل الدراسة الحالية بدراسة جديدة مبنية على القالب.\n\nهل تريد المتابعة؟`)) return;
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
        const currentMode = this.store.getState?.()?.appSettings?.mode || 'advanced';
        body.innerHTML = `
            <div class="blank-attribution-form">
                <p class="template-gallery__lead"><strong>ابدأ دراستك — اختر مستوى التفصيل</strong></p>
                <p class="text-sm text-muted mb-3">اختر ما يناسب خبرتك ووقتك؛ يمكنك تغييره لاحقاً في أي وقت.</p>
                <div class="mode-cards" role="radiogroup" aria-label="مستوى تفصيل الدراسة">
                    ${STUDY_MODES.map(m => `
                        <button type="button" class="mode-card ${m.id === currentMode ? 'active' : ''}" data-mode="${m.id}" role="radio" aria-checked="${m.id === currentMode}">
                            <span class="mode-card__icon" aria-hidden="true">${m.icon}</span>
                            <span class="mode-card__name">${m.name}</span>
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
        window.dispatchEvent(new CustomEvent('project-loaded', { detail: { source: 'blank', name: 'مشروع جديد' } }));
        this.close();
    }
}
