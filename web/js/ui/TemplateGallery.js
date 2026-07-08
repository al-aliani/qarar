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
    applyExpertTemplatePreset,
    getExpertTemplatePresets,
    getExpertTemplates,
    saveExpertTemplate
} from '../services/ExpertTemplateService.js';
import { toast } from '../utils/toast.js';

// أوضاع الدراسة — كانت مدفونة في خطوة القوالب؛ صارت اختياراً واضحاً عند البداية
const STUDY_MODES = [
    { id: 'mini', icon: '🌱', name: 'مصغّر (للمبتدئين)', desc: 'فكرة، سوق، تكاليف، إيرادات، قرار — الحد الأدنى للوصول لقرار سريع.' },
    { id: 'simple', icon: '📋', name: 'بسيط', desc: 'الأقسام الأساسية دون التحليلات المتقدمة (حساسية، مونت كارلو…).' },
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
        const expertTemplates = getExpertTemplates();
        const expertTemplatePresets = getExpertTemplatePresets();
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
                        <h4 class="card-title mb-1">مسودات إعداد للمختص</h4>
                        <p class="text-sm text-muted mb-2">هياكل بداية قابلة للتعديل، وليست قوالب معتمدة حتى يراجعها مختص ويحفظها.</p>
                        ${expertTemplatePresets.length ? `
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                ${expertTemplatePresets.map(t => `
                                    <button type="button" class="template-card btn-apply-expert-preset" data-id="${escapeAttribute(t.id)}" style="text-align:right;">
                                        <span class="t-icon" aria-hidden="true">↗</span>
                                        <span class="t-info">
                                            <span class="t-name">${escapeHtml(t.title)}</span>
                                            <span class="t-desc">${escapeHtml(t.specialty)} — تحتاج مراجعة مختص قبل الاعتماد</span>
                                        </span>
                                    </button>
                                `).join('')}
                            </div>
                        ` : `<p class="text-sm text-muted mb-0">لا توجد مسودات إعداد حالياً.</p>`}
                    </div>

                    <details class="card mt-4" style="border:1px solid var(--c-border); background:rgba(255,255,255,0.03);">
                        <summary style="cursor:pointer; font-weight:600;">أدوات المختصين وتحميل الهيكل</summary>
                        <div class="mt-3">
                            <div class="flex flex-wrap gap-2 mb-4">
                                <button type="button" class="btn btn--ghost btn--sm" id="btnDownloadStructureHtml" title="هيكل مبسّط للطباعة أو Word">تحميل هيكل مبسّط (Word/HTML)</button>
                                <button type="button" class="btn btn--ghost btn--sm" id="btnDownloadStructureCsv" title="هيكل مبسّط لملئه في Excel">تحميل هيكل مبسّط (Excel/CSV)</button>
                            </div>
                            <h4 class="card-title mb-1">حفظ الدراسة الحالية كقالب مختص</h4>
                            <p class="text-sm text-muted mb-3">تُحفظ الدراسة المفتوحة حالياً كقالب (بعد حذف بيانات العميل والمعرّفات)، لاستخدامها لاحقاً كنقطة بداية.</p>
                            <form id="expertTemplateForm" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div class="form-group"><label for="etTitle">اسم القالب</label><input id="etTitle" class="input" type="text" placeholder="مثال: دراسة جدوى مقهى مختص" autocomplete="off"></div>
                                <div class="form-group"><label for="etName">اسم المختص</label><input id="etName" class="input" type="text" placeholder="مثال: محمد العتيبي" autocomplete="off"></div>
                                <div class="form-group"><label for="etSpecialty">التخصص / القطاع</label><input id="etSpecialty" class="input" type="text" placeholder="مثال: مطاعم ومقاهي" autocomplete="off"></div>
                                <div class="form-group"><label for="etYears">سنوات الخبرة</label><input id="etYears" class="input" type="number" min="0" step="1" placeholder="15"></div>
                                <div class="form-group"><label for="etPrice">سعر القالب أو الاستشارة</label><input id="etPrice" class="input" type="text" placeholder="مثال: 490 ريال" autocomplete="off"></div>
                                <div class="form-group"><label for="etUrl">رابط حجز الاستشارة</label><input id="etUrl" class="input" type="url" placeholder="https://..." autocomplete="off"></div>
                                <div class="form-group md:col-span-2"><label for="etScope">نطاق استخدام القالب</label><textarea id="etScope" class="input" rows="2" placeholder="مثال: مقاهي مختصة داخل المدن الرئيسية، مساحة 80-180م²."></textarea></div>
                                <div class="form-group md:col-span-2"><label for="etNotes">ملاحظات المراجعة</label><textarea id="etNotes" class="input" rows="2" placeholder="ما الذي راجعه المختص؟ مصادر الأسعار؟"></textarea></div>
                                <label class="md:col-span-2 text-sm text-muted" style="display:flex; gap:8px; align-items:flex-start;">
                                    <input id="etReviewed" type="checkbox" style="margin-top:3px;">
                                    <span>أؤكد أن القالب تمت مراجعته من مختص، وأنه ليس أرقاماً عامة تُعرض كدراسة جاهزة.</span>
                                </label>
                                <div class="md:col-span-2"><button type="submit" class="btn btn--primary">حفظ كقالب مختص</button></div>
                            </form>
                        </div>
                    </details>
                </div>
            </div>
        `;

        this.overlay.querySelector('.btn-close').onclick = () => this.close();
        this.overlay.querySelector('#btnDownloadStructureHtml')?.addEventListener('click', () => this.downloadStructureHtml());
        this.overlay.querySelector('#btnDownloadStructureCsv')?.addEventListener('click', () => this.downloadStructureCsv());
        this.overlay.querySelector('#expertTemplateForm')?.addEventListener('submit', (e) => { e.preventDefault(); this.saveCurrentStudyAsExpertTemplate(); });
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.close(); };
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
        this.overlay.querySelectorAll('.btn-apply-expert-preset').forEach(btn => {
            btn.onclick = () => {
                const preset = getExpertTemplatePresets().find(t => t.id === btn.dataset.id);
                if (!preset) return;
                if (!window.confirm(`استخدام مسودة «${preset.title}» سيستبدل الدراسة الحالية بهيكل قابل للتعديل.\n\nهذه ليست قالباً معتمداً حتى يراجعها مختص ويحفظها.\n\nهل تريد المتابعة؟`)) return;
                applyExpertTemplatePreset(this.store, preset.id);
                window.dispatchEvent(new CustomEvent('project-loaded', { detail: { source: 'expert-template-preset', name: preset.title } }));
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

    saveCurrentStudyAsExpertTemplate() {
        const q = (id) => this.overlay.querySelector(id);
        if (!q('#etReviewed')?.checked) {
            toast.warning('أكد مراجعة المختص قبل حفظ القالب.');
            return;
        }
        try {
            const studyData = this.store.get ? this.store.get() : this.store.getState?.();
            saveExpertTemplate({
                title: q('#etTitle')?.value,
                expertName: q('#etName')?.value,
                specialty: q('#etSpecialty')?.value,
                yearsExperience: q('#etYears')?.value,
                priceLabel: q('#etPrice')?.value,
                consultationUrl: q('#etUrl')?.value,
                scope: q('#etScope')?.value,
                reviewNotes: q('#etNotes')?.value,
                status: 'approved'
            }, studyData);
            toast.success('تم حفظ القالب ضمن قوالب المختصين.');
            this.render();
        } catch (err) {
            toast.error(err?.message || 'تعذر حفظ القالب.');
        }
    }

    _downloadBlob(content, mime, filename) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    downloadStructureHtml() {
        const date = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
        const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>هيكل دراسة جدوى — للملء يدوياً</title>
<style>body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:12pt;line-height:1.8;max-width:21cm;margin:24px auto;padding:24px}h1{font-size:18pt;border-bottom:2px solid #C9A227;padding-bottom:8px}h2{font-size:14pt;color:#2c5282;margin-top:24px}.placeholder{color:#718096;border-bottom:1px dotted #cbd5e0;min-height:1.5em}.footer{margin-top:32px;font-size:9pt;color:#718096;text-align:center}</style></head>
<body><h1>هيكل دراسة جدوى — للملء يدوياً</h1>
<p class="footer">تاريخ التحميل: ${date} | هيكل مبسّط من منصة قرار</p>
<h2>١. الملخص التنفيذي</h2><p><strong>اسم المشروع:</strong> <span class="placeholder">&nbsp;</span></p><p><strong>الفكرة / المشكلة والحل:</strong></p><p class="placeholder">&nbsp;</p>
<h2>٢. المنهجية ونطاق الدراسة</h2><p class="placeholder">&nbsp;</p>
<h2>٣. الجانب المالي</h2><p><strong>إجمالي الاستثمار (ريال):</strong> <span class="placeholder">&nbsp;</span></p><p><strong>أهم المؤشرات (NPV، IRR، الاسترداد، التعادل):</strong></p><p class="placeholder">&nbsp;</p>
<h2>٤. تحليل المخاطر</h2><p class="placeholder">&nbsp;</p>
<h2>٥. الملاحق</h2><p class="placeholder">&nbsp;</p>
<div class="footer">هيكل مبسّط للملء اليدوي © ${new Date().getFullYear()}</div></body></html>`;
        this._downloadBlob(html, 'text/html;charset=utf-8', `هيكل_دراسة_جدوى_${new Date().toISOString().slice(0, 10)}.html`);
        toast.success('تم تحميل هيكل مبسّط — يمكنك فتحه وملؤه أو تحويله إلى Word');
    }

    downloadStructureCsv() {
        const BOM = '﻿';
        const rows = [
            ['القسم', 'الحقل', 'القيمة / الملاحظات'],
            ['الملخص التنفيذي', 'اسم المشروع', ''],
            ['الملخص التنفيذي', 'المشكلة والحل', ''],
            ['نطاق السوق', 'TAM / SAM / SOM', ''],
            ['الجانب المالي', 'إجمالي الاستثمار (ريال)', ''],
            ['الجانب المالي', 'NPV / IRR / فترة الاسترداد', ''],
            ['تحليل المخاطر', 'أبرز المخاطر وخطط المواجهة', ''],
            ['التوصية', 'القرار (مضي / مراجعة / لا تدخل)', '']
        ];
        const csv = BOM + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
        this._downloadBlob(csv, 'text/csv;charset=utf-8', `هيكل_دراسة_جدوى_${new Date().toISOString().slice(0, 10)}.csv`);
        toast.success('تم تحميل هيكل Excel (CSV) — افتحه في Excel واملأ الأعمدة');
    }
}
