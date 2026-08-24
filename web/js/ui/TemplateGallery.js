/**
 * TemplateGallery.js
 * نقطة بداية الدراسة.
 *
 * القوالب الرقمية الجاهزة أُزيلت عمداً: دراسة قطاعية كاملة يجب أن تكون من مختص
 * معروف النطاق والخبرة ومراجعة الأرقام، لا من أرقام افتراضية عامة.
 */

import Swal from 'sweetalert2';
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
    { id: 'mini', icon: 'bolt', name: 'مصغّر (للمبتدئين)', desc: `المشروع، التكاليف، الفريق، الإيرادات، التمويل، القرار — أقل الأسئلة للوصول لقرار سريع (${modeStepCount('mini')} خطوات تقريباً).`, badge: 'نقطة بداية جيدة' },
    { id: 'simple', icon: 'clipboard', name: 'بسيط', desc: `الأقسام الأساسية للدراسة دون التحليلات المتقدمة (حساسية، سيناريوهات، مونت كارلو، تقييم…) — ${modeStepCount('simple')} خطوة تقريباً.` },
    { id: 'advanced', icon: 'chart', name: 'مفصل', desc: `الدراسة الكاملة بكل الأقسام والتحليلات — جاهزة للبنك والمستثمر (${modeStepCount('advanced')} خطوة).`, badge: 'موصى به لبنك/مستثمر' }
];

const escapeAttribute = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeHtml = (value) => escapeAttribute(value).replace(/>/g, '&gt;');

function parseProductNames(value) {
    const normalized = String(value || '')
        .replace(/\\n/g, '\n')
        .replace(/\r\n?/g, '\n');
    return normalized
        .split(/\n+/)
        .flatMap((line) => line.split(/[,،]\s*(?=\d+\s*[.)-])/u))
        .map((line) => line.replace(/^\s*(?:\d+\s*[.)-]|[-•])\s*/u, '').trim())
        .filter(Boolean);
}

function applyProjectTypeDrafts(store, projectType) {
    if (projectType !== 'restaurant') return;
    const state = store?.getState?.() || {};
    if (!Array.isArray(state.revenue?.streams) || state.revenue.streams.length === 0) {
        store.updatePath('revenue', 'streams', [{ service: 'مبيعات الأغذية والمشروبات', customersPerMonth: 0, avgPrice: 0, growthRate: 0, type: 'operating', suggestedDraft: true }]);
    }
    if (!Array.isArray(state.legal?.licenses) || state.legal.licenses.length === 0) {
        store.updatePath('legal', 'licenses', [
            { name: 'سجل تجاري', quantity: 1, price: 0, suggestedDraft: true },
            { name: 'رخصة بلدية', quantity: 1, price: 0, suggestedDraft: true },
        ]);
    }
    if (!Array.isArray(state.hr?.positions) || state.hr.positions.length === 0) {
        // مسودات براتب 0: نترك nationality فارغة عمداً — تعيين 'expat' كان يحقن رسوم
        // وافد صامتة (مكتب عمل/تذكرة/إقامة ≈ 12,750 ريال/سنة) قبل أن يُدخل المستخدم
        // راتباً فعلياً، خلافاً لمبدأ «لا تكلفة صامتة» في المشروع.
        store.updatePath('hr', 'positions', [
            { position: 'مدير تشغيل', nationality: 'saudi', count: 1, salary: 0, months: 12, suggestedDraft: true },
            { position: 'طاقم خدمة أو مطبخ', nationality: '', count: 1, salary: 0, months: 12, suggestedDraft: true },
        ]);
    }
}

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
                name: 'بدون قالب (من الصفر)',
                description: 'ابدأ دراسة جديدة ببياناتك الفعلية، ثم عدّل كل قسم حسب مشروعك.',
                icon: 'i-code',
                data: null
            },
            {
                id: 'fb',
                name: 'مطعم / مقهى',
                description: 'يبدأ بتراخيص البلدية والغذاء والدواء (SFDA) ومعدات المطبخ وطاقم مبدئي — أرقام إرشادية تُعدّلها ببياناتك.',
                icon: 'i-store',
                data: {
                    projectInfo: { sector: 'الأغذية والمشروبات', concept: 'مطعم / مقهى' },
                    legal: {
                        licenses: [
                            { name: 'سجل تجاري', price: 1200, quantity: 1 },
                            { name: 'رخصة البلدية', price: 3000, quantity: 1 },
                            { name: 'ترخيص هيئة الغذاء والدواء SFDA', price: 1000, quantity: 1 },
                            { name: 'رخصة الدفاع المدني', price: 1500, quantity: 1 }
                        ]
                    },
                    technical: {
                        equipment: [
                            { name: 'تجهيزات المطبخ (أفران، ثلاجات)', price: 60000, quantity: 1 },
                            { name: 'نظام نقاط البيع (POS)', price: 5000, quantity: 1 },
                            { name: 'أثاث الصالة', price: 35000, quantity: 1 },
                            { name: 'ديكورات وتجهيزات أولية', price: 80000, quantity: 1 }
                        ]
                    },
                    hr: {
                        positions: [
                            { position: 'طاهٍ رئيسي', salary: 5000, count: 1, months: 12, nationality: 'saudi' },
                            { position: 'مساعد طباخ', salary: 3000, count: 2, months: 12, nationality: 'saudi' },
                            { position: 'كاشير / مقدم طعام', salary: 3500, count: 2, months: 12, nationality: 'saudi' },
                            { position: 'عامل نظافة', salary: 2000, count: 2, months: 12, nationality: 'saudi' }
                        ]
                    },
                    administrative: { administrative: [{ name: 'إيجار المحل', monthly: 8000 }] },
                    marketing: { campaigns: [{ name: 'تسويق', type: 'operating', monthly: 2000 }] }
                }
            },
            {
                id: 'tech',
                name: 'تطبيق إلكتروني / منصة رقمية',
                description: 'يبدأ بخوادم الاستضافة وتراخيص البرمجيات وفريق تطوير مبدئي — أرقام إرشادية تُعدّلها ببياناتك.',
                icon: 'i-server',
                data: {
                    projectInfo: { sector: 'تقنية المعلومات', concept: 'تطبيق إلكتروني / منصة رقمية' },
                    legal: {
                        licenses: [
                            { name: 'سجل تجاري للتقنية', price: 1200, quantity: 1 },
                            { name: 'توثيق منصة الأعمال', price: 1000, quantity: 1 }
                        ]
                    },
                    technical: {
                        equipment: [
                            { name: 'أجهزة كمبيوتر للمطورين', price: 20000, quantity: 1 },
                            { name: 'تراخيص برمجيات وأدوات (سنوي)', price: 8000, quantity: 1 },
                            { name: 'برمجة التطبيق (Outsourcing)', price: 150000, quantity: 1 }
                        ]
                    },
                    hr: {
                        positions: [
                            { position: 'مطور واجهات', salary: 8000, count: 1, months: 12, nationality: 'saudi' },
                            { position: 'مطور خلفية (Backend)', salary: 10000, count: 1, months: 12, nationality: 'saudi' },
                            { position: 'مسؤول تسويق رقمي', salary: 6000, count: 1, months: 12, nationality: 'saudi' },
                            { position: 'دعم فني', salary: 4000, count: 1, months: 12, nationality: 'saudi' }
                        ]
                    },
                    administrative: { administrative: [{ name: 'خوادم استضافة (سحابية)', monthly: 1500 }] },
                    marketing: { campaigns: [{ name: 'تسويق رقمي', type: 'operating', monthly: 5000 }] }
                }
            },
            {
                id: 'retail',
                name: 'متجر تجزئة / معرض',
                description: 'يبدأ بأرفف العرض وكاميرات المراقبة وديكور المعرض ونظام المبيعات — أرقام إرشادية تُعدّلها ببياناتك.',
                icon: 'i-shopping-bag',
                data: {
                    projectInfo: { sector: 'التجزئة والتجارة', concept: 'متجر تجزئة / معرض' },
                    legal: {
                        licenses: [
                            { name: 'سجل تجاري', price: 1200, quantity: 1 },
                            { name: 'رخصة البلدية', price: 3000, quantity: 1 },
                            { name: 'ترخيص الدفاع المدني', price: 1500, quantity: 1 }
                        ]
                    },
                    technical: {
                        equipment: [
                            { name: 'نظام نقاط البيع (POS)', price: 4000, quantity: 1 },
                            { name: 'أرفف العرض وتجهيزات المحل', price: 30000, quantity: 1 },
                            { name: 'كاميرات مراقبة', price: 5000, quantity: 1 },
                            { name: 'ديكورات المحل واللوحة', price: 45000, quantity: 1 }
                        ]
                    },
                    hr: {
                        positions: [
                            { position: 'مدير معرض', salary: 5000, count: 1, months: 12, nationality: 'saudi' },
                            { position: 'بائع / ممثل مبيعات', salary: 4000, count: 2, months: 12, nationality: 'saudi' }
                        ]
                    },
                    administrative: {
                        administrative: [
                            { name: 'إيجار المعرض', monthly: 10000 },
                            { name: 'مصاريف تشغيل أخرى', monthly: 1500 }
                        ]
                    }
                }
            },
            {
                id: 'services',
                name: 'مكتب خدمات / استشارات',
                description: 'يبدأ بالترخيص المهني والأثاث المكتبي وأجهزة الحاسب — أرقام إرشادية تُعدّلها ببياناتك.',
                icon: 'i-users',
                data: {
                    projectInfo: { sector: 'الخدمات والاستشارات', concept: 'مكتب خدمات / استشارات' },
                    legal: {
                        licenses: [
                            { name: 'سجل تجاري', price: 1200, quantity: 1 },
                            { name: 'ترخيص مهني', price: 2000, quantity: 1 },
                            { name: 'رخصة البلدية', price: 2500, quantity: 1 }
                        ]
                    },
                    technical: {
                        equipment: [
                            { name: 'أثاث مكتبي (طاولات، كراسي)', price: 25000, quantity: 1 },
                            { name: 'أجهزة حاسب وملحقاتها', price: 15000, quantity: 1 },
                            { name: 'ديكور وتجهيز المقر', price: 30000, quantity: 1 }
                        ]
                    },
                    hr: {
                        positions: [
                            { position: 'مستشار / أخصائي', salary: 12000, count: 1, months: 12, nationality: 'saudi' },
                            { position: 'مسؤول مبيعات', salary: 5000, count: 1, months: 12, nationality: 'saudi' },
                            { position: 'موظف استقبال', salary: 4000, count: 1, months: 12, nationality: 'saudi' }
                        ]
                    },
                    administrative: {
                        administrative: [
                            { name: 'إيجار المكتب', monthly: 6000 },
                            { name: 'اشتراكات وتسويق', monthly: 2000 }
                        ]
                    }
                }
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
        this.overlay.innerHTML = `
            <div class="modal-card template-modal template-gallery animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="template-gallery-title">
                <div class="modal-header">
                    <h3 id="template-gallery-title">
                        <svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg>
                        كيف تود إعداد دراستك؟
                    </h3>
                    <button class="btn-close" type="button" aria-label="إغلاق النافذة">×</button>
                </div>
                <div class="modal-body">
                    
                    <!-- الخيار الأول: طلب مستشار -->
                    <div class="tg-hero mb-3" style="background: var(--c-surface-2); border: 1px solid var(--c-border); text-align: right; align-items: flex-start; padding: 24px;">
                        <span class="tg-hero__icon" aria-hidden="true" style="margin-bottom: 16px; background: var(--c-primary-light); color: var(--c-primary);"><svg class="ic"><use href="#i-star"/></svg></span>
                        <h4 class="tg-hero__title">طلب خدمة مستشار أو أخصائي</h4>
                        <p class="tg-hero__desc" style="text-align: right;">دع خبراؤنا المعتمدون يقومون بإعداد دراسة جدوى متكاملة واحترافية لمشروعك من الألف إلى الياء، لتتفرغ أنت لإدارة أعمالك.</p>
                        <button type="button" class="btn btn--primary tg-hero__cta" id="btnRequestConsultant" style="margin-top: 16px; align-self: flex-start;">اطلب استشارة الآن ←</button>
                    </div>

                    <div class="flex-center my-4 text-muted text-sm" style="position: relative;">
                        <hr style="width: 100%; position: absolute; top: 50%; z-index: 1; border-color: var(--c-border);">
                        <span style="background: var(--c-bg-card); padding: 0 12px; position: relative; z-index: 2;">أو</span>
                    </div>

                    <!-- الخيار الثاني: القوالب الذكية -->
                    <div class="tg-hero" style="background: transparent; border: 1px solid var(--c-border); padding: 24px; border-radius: 12px;">
                        <div class="flex items-center gap-3 mb-4">
                            <span class="tg-hero__icon flex-center" aria-hidden="true" style="background: var(--c-surface-2); color: var(--c-text-main); width: 48px; height: 48px; border-radius: 8px;"><svg class="ic" style="width:24px; height:24px;"><use href="#i-sparkle"/></svg></span>
                            <div>
                                <h4 class="tg-hero__title" style="margin: 0; text-align: right;">القوالب الذكية الجاهزة</h4>
                                <p class="text-sm text-muted mt-1 mb-0" style="text-align: right;">اختر نوع مشروعك وسنقوم بتجهيز التراخيص والمعدات والرواتب الافتراضية لك لتسريع العمل.</p>
                            </div>
                        </div>
                        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
                            ${this.templates.filter(t => t.id !== 'empty').map(t => `
                                <button type="button" class="btn-smart-template" data-id="${t.id}" style="text-align: right; background: var(--c-bg-card); border: 1px solid var(--c-border); border-radius: 8px; padding: 16px; cursor: pointer; transition: all 0.2s;">
                                    <div class="flex items-center gap-2 mb-2">
                                        <svg class="ic text-gold"><use href="#${t.icon || 'i-star'}"/></svg>
                                        <strong style="color: var(--c-text-main);">${t.name}</strong>
                                    </div>
                                    <div class="text-xs text-muted leading-relaxed">${t.description}</div>
                                </button>
                            `).join('')}
                        </div>
                        
                        <div class="mt-4 pt-4 border-t text-center" style="border-color: var(--c-border);">
                            <button type="button" class="btn btn--secondary tg-hero__cta" id="btnStartBlank" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 8px;">
                                <svg class="ic"><use href="#i-plus"/></svg>
                                أو ابدأ بمشروع فارغ من الصفر
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        `;

        this.overlay.querySelector('.btn-close').onclick = () => this.close();
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.close(); };

        this.overlay.querySelector('#btnStartBlank').onclick = () => this.renderBlankAttributionForm('empty');
        this.overlay.querySelectorAll('.btn-smart-template').forEach(btn => {
            btn.onclick = () => {
                this.startSmartWizard(btn.dataset.id);
            };
        });
        
        this.overlay.querySelector('#btnRequestConsultant').onclick = () => {
            // تدقيق 2026-07-18: كان يفتح ConsultationModal — رابط حجز خارجي يعدّه المستخدم يدوياً
            // بلا أي إرسال فعلي لأي جهة. نظام الاستشارات الحقيقي (نموذج + باقات أسعار + تخزين
            // Supabase حي في consultation_requests) موجود أصلاً في AdvisoryView على #/advisory
            // (نفس المسار الذي يفتحه زر «طلب استشارة» في لوحة التحكم) — نوجّه لنفس المكان بدل
            // تكرار واجهة معطّلة.
            this.close();
            window.location.hash = '#/advisory';
        };

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

    async startSmartWizard(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;
        
        if (this.store.reset) await this.store.reset();
        
        if (template.data) {
            for (const [section, sectionData] of Object.entries(template.data)) {
                this.store.update(section, sectionData);
            }
        }
        
        this.store.update('appSettings', { mode: 'advanced' });
        this.renderFoundationWizard(1);
    }

    /**
     * نموذج اعتماد الدراسة باسم العميل (للمشروع الفارغ): معدّ الدراسة قد يكون مستشاراً
     * يبيعها لعميله — الاسم يظهر على غلاف التقارير («أُعدت هذه الدراسة لصالح: …»).
     */
    renderBlankAttributionForm(templateId = 'empty') {
        const body = this.overlay.querySelector('.modal-body');
        const template = this.templates.find(t => t.id === templateId) || this.templates.find(t => t.id === 'empty');
        if (!body) { this.selectTemplate('empty'); return; }
        // الافتراضي هنا حرفي ثابت دائماً — لا تذكّر آخر اختيار يدوي (تحقّق 2026-07-15:
        // appSettings.mode هنا كان يقرأ حالة الدراسة السابقة/الحالية المتبقية في المخزن قبل
        // استدعاء store.reset() أدناه، وليس تفضيلاً متعمَّداً محفوظاً لهذه النافذة تحديداً.
        // آلية التفضيل الفعلية عبر الجلسات — localStorage['study_mode_preference'] المستهلكة
        // في app.js/SimpleModeController.js — لغرض مختلف تماماً (الوضع الفعّال لدراسة قائمة
        // بالفعل) ولم تُمس هنا.
        // تدقيق 2026-07-18: جُرِّب 'mini' كافتراضي لفترة وجيزة اليوم (أقل انطباع أول)، ثم
        // قرار صريح من المالك بإعادته لـ'advanced' — الدراسة الافتراضية يجب أن تكون كاملة
        // (42 خطوة) ما لم يختر المستخدم 'مصغّر'/'بسيط' يدوياً بنفسه.
        const currentMode = 'advanced';
        body.innerHTML = `
            <div class="blank-attribution-form">
                <p class="template-gallery__lead"><strong>ابدأ دراستك — اختر مستوى التفصيل</strong></p>
                <p class="text-sm text-muted mb-3">اختر ما يناسب خبرتك ووقتك؛ يمكنك تغييره لاحقاً في أي وقت.</p>
                <div class="mode-cards" role="radiogroup" aria-label="مستوى تفصيل الدراسة">
                    ${STUDY_MODES.map(m => `
                        <button type="button" class="mode-card ${m.id === currentMode ? 'active' : ''}" data-mode="${m.id}" role="radio" aria-checked="${m.id === currentMode}" aria-label="${escapeAttribute(m.name)}: ${escapeAttribute(m.desc)}${m.badge ? ' — ' + escapeAttribute(m.badge) : ''}">
                            ${m.badge ? `<span class="mode-card__badge" style="display:block;font-size:.7rem;font-weight:700;color:var(--c-primary,#0f5132);margin-bottom:4px;">${m.badge}</span>` : ''}
                            <span class="mode-card__icon" aria-hidden="true" style="font-size:1.5rem;"><svg class="ic" aria-hidden="true"><use href="#i-${m.icon}"/></svg></span>
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
                            <input type="text" id="blankPreparedBy" class="input" placeholder="مثال: مكتب رؤية للاستشارات" autocomplete="off">
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
        // نضبط الوضع والاعتماد قبل بدء معالج التأسيس
        const startWizard = async () => {
            const clientName = body.querySelector('#blankClientName')?.value.trim() || '';
            const preparedBy = body.querySelector('#blankPreparedBy')?.value.trim() || '';
            if (this.store.reset) await this.store.reset();
            
            if (template.data) {
                for (const [section, sectionData] of Object.entries(template.data)) {
                    this.store.update(section, sectionData);
                }
            }

            this.store.update('appSettings', { mode: selectedMode });
            if (clientName || preparedBy) {
                this.store.updatePath('projectInfo', 'clientName', clientName);
                this.store.updatePath('projectInfo', 'preparedBy', preparedBy);
            }
            
            // بدلاً من إغلاق النافذة وفتح لوحة التحكم فوراً، ننتقل لمعالج التأسيس
            this.renderFoundationWizard(1);
        };
        body.querySelector('#btnBlankCreate').onclick = () => startWizard();
        body.querySelector('#btnBlankBack').onclick = () => this.render();
        body.querySelector('.mode-card.active')?.focus();
    }

    renderFoundationWizard(stepIndex = 1) {
        const body = this.overlay.querySelector('.modal-body');
        if (!body) return;

        // تهيئة المتغيرات المؤقتة إذا كانت غير موجودة
        if (!this.wizardData) {
            this.wizardData = {
                projectName: '',
                description: '',
                industry: '',
                projectType: '',
                products: '',
                initialCapital: ''
            };
        }

        const renderStepContent = () => {
            if (stepIndex === 1) {
                return `
                    <div class="form-group mb-3">
                        <label>اسم المشروع</label>
                        <input type="text" id="fw_projectName" class="input" placeholder="مثال: مقهى الشروق" value="${escapeAttribute(this.wizardData.projectName)}" autofocus>
                    </div>
                    <div class="form-group mb-3">
                        <label>وصف الفكرة بإيجاز</label>
                        <textarea id="fw_description" class="input" placeholder="مثال: مقهى مختص يقدم قهوة عضوية..." rows="3">${escapeHtml(this.wizardData.description)}</textarea>
                    </div>
                    <div class="form-group mb-4">
                        <label>القطاع (مجال العمل)</label>
                        <input type="text" id="fw_industry" class="input" placeholder="مثال: الأغذية والمشروبات" value="${escapeAttribute(this.wizardData.industry)}">
                    </div>
                    <div class="form-group mb-4">
                        <label for="fw_projectType">نوع المشروع</label>
                        <select id="fw_projectType" class="input">
                            <option value="">اختر النوع إن كان واضحًا</option>
                            <option value="restaurant" ${this.wizardData.projectType === 'restaurant' ? 'selected' : ''}>مطعم أو مقهى</option>
                            <option value="retail" ${this.wizardData.projectType === 'retail' ? 'selected' : ''}>تجزئة</option>
                            <option value="service" ${this.wizardData.projectType === 'service' ? 'selected' : ''}>خدمات</option>
                            <option value="technology" ${this.wizardData.projectType === 'technology' ? 'selected' : ''}>تقنية</option>
                        </select>
                    </div>
                `;
            } else if (stepIndex === 2) {
                return `
                    <div class="form-group mb-4">
                        <label>ماذا تبيع؟ (المنتجات أو الخدمات الرئيسية)</label>
                        <p class="text-sm text-muted mb-2">اذكر أهم 3 إلى 5 منتجات أو خدمات تعتمد عليها إيراداتك.</p>
                        <textarea id="fw_products" class="input" placeholder="مثال: 1. قهوة حارة&#10;2. قهوة باردة&#10;3. حلى مخبوزات" rows="5">${escapeHtml(this.wizardData.products)}</textarea>
                    </div>
                `;
            } else if (stepIndex === 3) {
                return `
                    <div class="form-group mb-4">
                        <label>رأس المال التقديري المتوفر (اختياري)</label>
                        <p class="text-sm text-muted mb-2">كم المبلغ التقريبي الذي تخطط لاستثماره لتأسيس هذا المشروع؟</p>
                        <input type="number" id="fw_initialCapital" class="input" placeholder="مثال: 150000" value="${escapeAttribute(this.wizardData.initialCapital)}">
                    </div>
                `;
            }
        };

        const title = stepIndex === 1 ? '1. فكرة المشروع' : stepIndex === 2 ? '2. المنتجات والخدمات' : '3. الاستثمار المبدئي';

        body.innerHTML = `
            <div class="foundation-wizard">
                <div class="wizard-progress mb-4" style="display:flex; gap:8px;">
                    <div style="flex:1; height:4px; border-radius:2px; background: ${stepIndex >= 1 ? 'var(--c-primary)' : 'var(--c-border)'}"></div>
                    <div style="flex:1; height:4px; border-radius:2px; background: ${stepIndex >= 2 ? 'var(--c-primary)' : 'var(--c-border)'}"></div>
                    <div style="flex:1; height:4px; border-radius:2px; background: ${stepIndex >= 3 ? 'var(--c-primary)' : 'var(--c-border)'}"></div>
                </div>
                
                <h4 class="mb-3">${title}</h4>
                
                <div class="wizard-step-content">
                    ${renderStepContent()}
                </div>

                <div class="flex-between gap-3 mt-4 pt-3" style="border-top:1px solid var(--c-border)">
                    <button type="button" class="btn btn--ghost" id="fw_btnBack">${stepIndex === 1 ? 'تخطي التأسيس' : 'رجوع'}</button>
                    <button type="button" class="btn btn--primary" id="fw_btnNext">${stepIndex === 3 ? 'ابدأ العمل على دراستي ←' : 'التالي ←'}</button>
                </div>
            </div>
        `;

        // دالة حفظ البيانات الحالية
        const saveCurrentStepData = () => {
            if (stepIndex === 1) {
                this.wizardData.projectName = body.querySelector('#fw_projectName')?.value || '';
                this.wizardData.description = body.querySelector('#fw_description')?.value || '';
                this.wizardData.industry = body.querySelector('#fw_industry')?.value || '';
                this.wizardData.projectType = body.querySelector('#fw_projectType')?.value || '';
            } else if (stepIndex === 2) {
                this.wizardData.products = body.querySelector('#fw_products')?.value || '';
            } else if (stepIndex === 3) {
                this.wizardData.initialCapital = body.querySelector('#fw_initialCapital')?.value || '';
            }
        };

        const finishWizard = async () => {
            saveCurrentStepData();
            
            // حقن البيانات في الـ Store
            if (this.wizardData.projectName) this.store.updatePath('projectInfo', 'name', this.wizardData.projectName);
            if (this.wizardData.description) this.store.updatePath('projectInfo', 'description', this.wizardData.description);
            if (this.wizardData.industry) this.store.updatePath('projectInfo', 'industry', this.wizardData.industry);
            
            if (this.wizardData.products) {
                // محاولة ذكية لتقسيم النص إلى قائمة منتجات إذا استخدم أسطر جديدة
                const lines = parseProductNames(this.wizardData.products);
                if (lines.length > 0) {
                    const productsList = lines.map(name => ({ id: Date.now().toString() + Math.random(), name, type: 'final' }));
                    this.store.updatePath('projectInfo', 'products', productsList);
                } else {
                    this.store.updatePath('projectInfo', 'products', [{ id: Date.now().toString(), name: this.wizardData.products, type: 'final' }]);
                }
            }

            if (this.wizardData.projectType) this.store.updatePath('projectInfo', 'projectType', this.wizardData.projectType);
            applyProjectTypeDrafts(this.store, this.wizardData.projectType);

            if (this.wizardData.initialCapital) {
                // كان يُكتب في financing.equity (حقل غير موجود بالمخطط، لا يقرأه أي شيء في
                // المحرك — إجابة المستخدم تُهمَل بصمت). المسار الصحيح الذي يقرأه المحرك فعلياً
                // (paidCapital/fundingGap) هو financing.sources.equity.amount، نفسه الذي تكتب
                // إليه لوحة «معايرة سريعة» لاحقاً.
                this.store.updatePath('financing', 'sources.equity.amount', Number(this.wizardData.initialCapital) || 0);
            }

            if (this.store.flush) await this.store.flush();
            trackEvent('study_created', { source: 'blank_with_wizard' });
            window.dispatchEvent(new CustomEvent('project-loaded', { detail: { source: 'blank', name: this.wizardData.projectName || 'مشروع جديد' } }));
            this.close();
        };

        const skipWizard = async () => {
            if (this.store.flush) await this.store.flush();
            trackEvent('study_created', { source: 'blank' });
            window.dispatchEvent(new CustomEvent('project-loaded', { detail: { source: 'blank', name: 'مشروع جديد' } }));
            this.close();
        };

        body.querySelector('#fw_btnNext').onclick = () => {
            if (stepIndex < 3) {
                saveCurrentStepData();
                this.renderFoundationWizard(stepIndex + 1);
            } else {
                finishWizard();
            }
        };

        body.querySelector('#fw_btnBack').onclick = () => {
            if (stepIndex > 1) {
                saveCurrentStepData();
                this.renderFoundationWizard(stepIndex - 1);
            } else {
                skipWizard();
            }
        };
    }

    async selectTemplate(id) {
        if (id !== 'empty') return;

        if (this.store.reset) await this.store.reset();
        trackEvent('study_created', { source: 'template' });
        window.dispatchEvent(new CustomEvent('project-loaded', { detail: { source: 'blank', name: 'مشروع جديد' } }));
        this.close();
    }
}
