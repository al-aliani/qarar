/**
 * Template Selector Component
 * واجهة قوالب المختصين المعتمدة.
 *
 * لا تعرض قوالب قطاعية افتراضية حتى لا تبدو كدراسات صحيحة من غير خبير.
 */
import { ProjectManager } from '../services/ProjectManager.js';
import {
    applyExpertTemplate,
    applyExpertTemplatePreset,
    deleteExpertTemplate,
    getExpertTemplatePresets,
    getExpertTemplates,
    saveExpertTemplate
} from '../services/ExpertTemplateService.js';
import { toast } from '../utils/toast.js';

const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export class TemplateSelector {
    constructor(containerId, store, onTemplateApplied) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onTemplateApplied = onTemplateApplied;
    }

    render() {
        if (!this.container) return;
        const expertTemplates = getExpertTemplates();
        const expertTemplatePresets = getExpertTemplatePresets();

        this.container.innerHTML = `
            <div class="template-selector animate-entry">
                <div class="template-header">
                    <h2 class="text-xl font-bold">قوالب المختصين المعتمدة</h2>
                    <p class="text-muted">القالب الكامل لا يظهر هنا إلا إذا كان من مختص واضح الخبرة والنطاق، مع تاريخ تحديث ومسؤولية عن الأرقام. حالياً استخدم الهيكل أو ابدأ من الصفر.</p>
                    <div class="flex flex-wrap gap-2 mt-3">
                        <button type="button" class="btn btn--primary btn--sm" id="btnStartBlankStudy">إنشاء دراسة فارغة</button>
                        <button type="button" class="btn btn--ghost btn--sm" id="btnDownloadStructureOnly" title="تحميل هيكل دراسة جدوى (HTML) لملئه يدوياً أو فتحه في Word">تحميل هيكل (Word/HTML)</button>
                        <button type="button" class="btn btn--ghost btn--sm" id="btnDownloadStructureExcel" title="تحميل هيكل دراسة جدوى (CSV) لملئه في Excel">تحميل هيكل (Excel/CSV)</button>
                    </div>
                    <div class="mode-toggle-container mt-4 mb-4 flex-center">
                        <div class="mode-toggle-wrapper" style="background:var(--c-bg-card); border:1px solid var(--c-border); padding:4px; border-radius:30px; display:inline-flex; flex-wrap:wrap; gap:4px; justify-content:center;">
                            <button class="btn-mode active" data-mode="advanced" style="border-radius:20px; padding:6px 16px;">مفصل</button>
                            <button class="btn-mode" data-mode="simple" style="border-radius:20px; padding:6px 16px;">بسيط</button>
                            <button class="btn-mode" data-mode="mini" style="border-radius:20px; padding:6px 16px;">مصغّر (للمبتدئين)</button>
                        </div>
                        <p class="text-xs text-muted mt-2">المصغّر = فكرة، سوق، تكاليف، إيرادات، قرار — الحد الأدنى قبل التوجه لمتخصص</p>
                    </div>
                </div>

                <div class="saved-projects mb-8" id="savedProjectsContainer">
                    <div class="loading-spinner">جارٍ التحميل…</div>
                </div>

                <div class="card glass-card mb-4" style="border:1px solid var(--c-border);">
                    <h3 class="card-title mb-2">مسودات إعداد للمختص</h3>
                    <p class="text-sm text-muted mb-3">هذه ليست قوالب معتمدة للبيع. هي هياكل بداية تساعد المختص على تجهيز دراسة ثم مراجعتها وحفظها كقالب معتمد.</p>
                    ${this.renderExpertTemplatePresets(expertTemplatePresets)}
                </div>

                <div class="card glass-card mb-4" style="border:1px solid var(--c-border);">
                    <h3 class="card-title mb-2">إضافة قالب مختص</h3>
                    <p class="text-sm text-muted mb-3">سيُحفظ القالب من الدراسة الحالية كما هي الآن، مع حذف بيانات العميل والمعرّفات حتى يفتح كدراسة جديدة عند تطبيقه.</p>
                    <form id="expertTemplateForm" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="form-group">
                            <label for="expertTemplateTitle">اسم القالب</label>
                            <input id="expertTemplateTitle" class="input" type="text" placeholder="مثال: دراسة جدوى مقهى مختص - تشغيل فعلي" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label for="expertTemplateName">اسم المختص</label>
                            <input id="expertTemplateName" class="input" type="text" placeholder="مثال: محمد العتيبي" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label for="expertTemplateSpecialty">التخصص / القطاع</label>
                            <input id="expertTemplateSpecialty" class="input" type="text" placeholder="مثال: مطاعم ومقاهي" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label for="expertTemplateYears">سنوات الخبرة</label>
                            <input id="expertTemplateYears" class="input" type="number" min="0" step="1" placeholder="15">
                        </div>
                        <div class="form-group">
                            <label for="expertTemplatePrice">سعر القالب أو الاستشارة</label>
                            <input id="expertTemplatePrice" class="input" type="text" placeholder="مثال: 490 ريال / استشارة حسب الطلب" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label for="expertTemplateUrl">رابط حجز الاستشارة</label>
                            <input id="expertTemplateUrl" class="input" type="url" placeholder="https://..." autocomplete="off">
                        </div>
                        <div class="form-group md:col-span-2">
                            <label for="expertTemplateScope">نطاق استخدام القالب</label>
                            <textarea id="expertTemplateScope" class="input" rows="2" placeholder="مثال: مقاهي مختصة داخل المدن الرئيسية، مساحة 80-180م²، بدون فرن إنتاج مركزي."></textarea>
                        </div>
                        <div class="form-group md:col-span-2">
                            <label for="expertTemplateNotes">ملاحظات المراجعة</label>
                            <textarea id="expertTemplateNotes" class="input" rows="2" placeholder="ما الذي راجعه المختص؟ مصادر الأسعار؟ حدود الافتراضات؟"></textarea>
                        </div>
                        <label class="md:col-span-2 text-sm text-muted" style="display:flex; gap:8px; align-items:flex-start;">
                            <input id="expertTemplateReviewed" type="checkbox" style="margin-top:3px;">
                            <span>أؤكد أن القالب تمت مراجعته من مختص، وأنه ليس أرقاماً عامة تُعرض كدراسة جاهزة.</span>
                        </label>
                        <div class="md:col-span-2 flex flex-wrap gap-2">
                            <button type="submit" class="btn btn--primary">حفظ الدراسة الحالية كقالب مختص</button>
                        </div>
                    </form>
                </div>

                <div class="card glass-card mb-4" style="border:1px solid var(--c-border);">
                    <h3 class="card-title mb-2">القوالب المحفوظة</h3>
                    ${this.renderExpertTemplates(expertTemplates)}
                </div>
            </div>
        `;

        this.renderSavedProjects().then(html => {
            const detailedContainer = this.container.querySelector('#savedProjectsContainer');
            if (detailedContainer) detailedContainer.innerHTML = html;
            this.bindProjectEvents();
        }).catch(err => {
            console.error('Error rendering saved projects:', err);
            const detailedContainer = this.container.querySelector('#savedProjectsContainer');
            if (detailedContainer) {
                detailedContainer.innerHTML = '<div class="card">حدث خطأ أثناء تحميل المشاريع المحفوظة</div>';
            }
            this.bindProjectEvents();
        });
    }

    async renderSavedProjects() {
        const projects = await ProjectManager.getAllProjects();
        if (projects.length === 0) {
            return `
                <div class="card glass-card mb-4 text-center py-8" style="border:1px solid var(--c-border);">
                    <p class="text-muted mb-2">لا توجد مشاريع محفوظة بعد</p>
                    <p class="text-xs text-muted">ابدأ بإنشاء دراسة جديدة أو احفظ مشروعك من لوحة القرار</p>
                </div>
            `;
        }

        return `
            <div class="card glass-card mb-4" style="border:1px solid var(--c-p-500);">
                <h3 class="card-title text-gold mb-3">مشاريعك المحفوظة</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${projects.map(p => `
                        <div class="saved-project-item p-3" style="background:rgba(255,255,255,0.05); border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div class="font-bold">${p.name}</div>
                                <div class="text-xs text-muted">${new Date(p.lastModified).toLocaleDateString('ar-SA')}</div>
                            </div>
                            <div class="flex gap-2">
                                <button class="btn-xs btn--primary btn-load-project" data-id="${p.id}">فتح</button>
                                <button class="btn-xs btn--danger btn-delete-project" data-id="${p.id}">x</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    bindProjectEvents() {
        this.container.querySelectorAll('.btn-load-project').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const result = await ProjectManager.loadProject(id);
                if (result?.data) {
                    this.store.set(result.data);
                    if (this.onTemplateApplied) this.onTemplateApplied({ id: 'loaded', label: 'Saved Project' });
                }
            });
        });

        this.container.querySelectorAll('.btn-delete-project').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (confirm('هل أنت متأكد من الحذف؟')) {
                    await ProjectManager.deleteProject(id);
                    this.render();
                }
            });
        });

        this.container.querySelectorAll('.btn-mode').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.container.querySelectorAll('.btn-mode').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.color = 'var(--c-text-main)';
                });
                e.target.classList.add('active');
                e.target.style.background = 'var(--c-p-500)';
                e.target.style.color = '#fff';

                const mode = e.target.dataset.mode;
                this.store.update('appSettings', { mode });
            });
        });

        const currentMode = (this.store.getState?.()?.appSettings?.mode || this.store.get?.()?.appSettings?.mode) || 'advanced';
        this.container.querySelectorAll('.btn-mode').forEach(b => {
            const isActive = b.dataset.mode === currentMode;
            b.classList.toggle('active', isActive);
            b.style.background = isActive ? 'var(--c-p-500)' : 'transparent';
            b.style.color = isActive ? '#fff' : 'var(--c-text-main)';
        });

        this.container.querySelector('#btnDownloadStructureOnly')?.addEventListener('click', () => this.downloadStructureOnly());
        this.container.querySelector('#btnDownloadStructureExcel')?.addEventListener('click', () => this.downloadStructureExcel());
        this.container.querySelector('#btnStartBlankStudy')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:newStudy'));
        });
        this.container.querySelector('#expertTemplateForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCurrentStudyAsExpertTemplate();
        });

        this.container.querySelectorAll('.btn-apply-expert-template').forEach(btn => {
            btn.addEventListener('click', () => this.applyTemplateById(btn.dataset.id));
        });

        this.container.querySelectorAll('.btn-delete-expert-template').forEach(btn => {
            btn.addEventListener('click', () => this.deleteTemplateById(btn.dataset.id));
        });

        this.container.querySelectorAll('.btn-apply-expert-preset').forEach(btn => {
            btn.addEventListener('click', () => this.applyPresetById(btn.dataset.id));
        });
    }

    renderExpertTemplatePresets(presets) {
        if (!presets.length) {
            return '<p class="text-sm text-muted mb-0">لا توجد مسودات إعداد حالياً.</p>';
        }

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                ${presets.map(p => `
                    <div class="template-card card-hover" data-id="${escapeHtml(p.id)}">
                        <div class="template-body">
                            <h3>${escapeHtml(p.title)}</h3>
                            <p class="text-sm text-muted mb-2">${escapeHtml(p.specialty)}</p>
                            <p class="text-sm mb-2"><strong>الحالة:</strong> مسودة إعداد، تحتاج مختصاً لاعتمادها.</p>
                            ${p.scope ? `<p class="text-sm text-muted mb-2">${escapeHtml(p.scope)}</p>` : ''}
                            ${p.reviewNotes ? `<p class="text-xs text-muted mb-1">${escapeHtml(p.reviewNotes)}</p>` : ''}
                        </div>
                        <div class="flex gap-2 mt-2">
                            <button class="btn btn--secondary flex-1 btn-apply-expert-preset" data-id="${escapeHtml(p.id)}">استخدام كمسودة</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderExpertTemplates(templates) {
        if (!templates.length) {
            return `
                <div class="alert alert--info">
                    <strong>المبدأ:</strong> العميل يقدر يبني دراسة من الصفر دائماً، والقالب المدفوع يكون منتج خبير وليس أرقاماً عامة.
                </div>
            `;
        }

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                ${templates.map(t => `
                    <div class="template-card card-hover" data-id="${escapeHtml(t.id)}">
                        <div class="template-body">
                            <h3>${escapeHtml(t.title)}</h3>
                            <p class="text-sm text-muted mb-2">${escapeHtml(t.specialty)} — ${Number(t.yearsExperience) || 0} سنة خبرة</p>
                            <p class="text-sm mb-2"><strong>المختص:</strong> ${escapeHtml(t.expertName)}</p>
                            ${t.scope ? `<p class="text-sm text-muted mb-2">${escapeHtml(t.scope)}</p>` : ''}
                            ${t.priceLabel ? `<p class="text-xs text-gold mb-1">السعر: ${escapeHtml(t.priceLabel)}</p>` : ''}
                            ${t.consultationUrl ? `<p class="text-xs mb-1"><a href="${escapeHtml(t.consultationUrl)}" target="_blank" rel="noopener">رابط حجز الاستشارة</a></p>` : ''}
                            ${t.certification ? `<p class="text-xs text-success mb-1">اعتماد القالب: ${Number(t.certification.score) || 0}/100 — ${escapeHtml(t.certification.status)}</p>` : ''}
                            <p class="text-xs text-muted">آخر تحديث: ${new Date(t.updatedAt).toLocaleDateString('ar-SA')}</p>
                        </div>
                        <div class="flex gap-2 mt-2">
                            <button class="btn btn--primary flex-1 btn-apply-expert-template" data-id="${escapeHtml(t.id)}">تطبيق القالب</button>
                            <button class="btn btn--ghost btn--sm btn-delete-expert-template" data-id="${escapeHtml(t.id)}">حذف</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    saveCurrentStudyAsExpertTemplate() {
        const form = this.container.querySelector('#expertTemplateForm');
        if (!form) return;
        const reviewed = form.querySelector('#expertTemplateReviewed')?.checked;
        if (!reviewed) {
            toast.warning('أكد مراجعة المختص قبل حفظ القالب.');
            return;
        }

        try {
            const studyData = this.store.get ? this.store.get() : this.store.getState?.();
            saveExpertTemplate({
                title: form.querySelector('#expertTemplateTitle')?.value,
                expertName: form.querySelector('#expertTemplateName')?.value,
                specialty: form.querySelector('#expertTemplateSpecialty')?.value,
                yearsExperience: form.querySelector('#expertTemplateYears')?.value,
                priceLabel: form.querySelector('#expertTemplatePrice')?.value,
                consultationUrl: form.querySelector('#expertTemplateUrl')?.value,
                scope: form.querySelector('#expertTemplateScope')?.value,
                reviewNotes: form.querySelector('#expertTemplateNotes')?.value,
                status: 'approved'
            }, studyData);
            toast.success('تم حفظ القالب ضمن قوالب المختصين.');
            this.render();
        } catch (err) {
            toast.error(err?.message || 'تعذر حفظ القالب.');
        }
    }

    fillExpertTemplateForm(preset) {
        const form = this.container.querySelector('#expertTemplateForm');
        if (!form || !preset) return;
        form.querySelector('#expertTemplateTitle').value = preset.title || '';
        form.querySelector('#expertTemplateName').value = '';
        form.querySelector('#expertTemplateSpecialty').value = preset.specialty || '';
        form.querySelector('#expertTemplateYears').value = '';
        form.querySelector('#expertTemplatePrice').value = preset.priceLabel || '';
        form.querySelector('#expertTemplateScope').value = preset.scope || '';
        form.querySelector('#expertTemplateNotes').value = preset.reviewNotes || '';
        form.querySelector('#expertTemplateReviewed').checked = false;
    }

    applyPresetById(id) {
        const preset = getExpertTemplatePresets().find(p => p.id === id);
        if (!preset) {
            toast.error('مسودة الإعداد غير موجودة.');
            return;
        }
        if (!confirm(`استخدام مسودة «${preset.title}» سيستبدل الدراسة الحالية بهيكل SaaS قابل للتعديل.\n\nهذه ليست قالباً معتمداً حتى يراجعها مختص وتحفظها من النموذج أدناه.\n\nهل تريد المتابعة؟`)) return;
        const result = applyExpertTemplatePreset(this.store, id);
        if (!result) {
            toast.error('تعذر تحميل المسودة.');
            return;
        }
        this.fillExpertTemplateForm(preset);
        toast.success('تم تحميل مسودة SaaS. راجع الأرقام ثم احفظها كقالب مختص بعد الاعتماد.');
    }

    applyTemplateById(id) {
        const template = getExpertTemplates().find(t => t.id === id);
        if (!template) {
            toast.error('القالب غير موجود.');
            return;
        }
        if (!confirm(`تطبيق قالب «${template.title}» سيستبدل الدراسة الحالية بدراسة جديدة مبنية على القالب.\n\nهل تريد المتابعة؟`)) return;
        applyExpertTemplate(this.store, template);
        toast.success(`تم تطبيق قالب «${template.title}».`);
        if (this.onTemplateApplied) this.onTemplateApplied(template);
    }

    deleteTemplateById(id) {
        const template = getExpertTemplates().find(t => t.id === id);
        if (!template) return;
        if (!confirm(`حذف قالب «${template.title}»؟`)) return;
        deleteExpertTemplate(id);
        toast.success('تم حذف القالب.');
        this.render();
    }

    downloadStructureOnly() {
        const date = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
        const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>هيكل دراسة جدوى — للملء يدوياً</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 12pt; line-height: 1.8; max-width: 21cm; margin: 24px auto; padding: 24px; }
        h1 { font-size: 18pt; border-bottom: 2px solid #C9A227; padding-bottom: 8px; }
        h2 { font-size: 14pt; color: #2c5282; margin-top: 24px; }
        .placeholder { color: #718096; border-bottom: 1px dotted #cbd5e0; min-height: 1.5em; }
        .footer { margin-top: 32px; font-size: 9pt; color: #718096; text-align: center; }
    </style>
</head>
<body>
    <h1>هيكل دراسة جدوى — للملء يدوياً</h1>
    <p class="footer">تاريخ التحميل: ${date} | هيكل من منصة قرار — يمكنك الطباعة أو التحويل إلى Word</p>

    <h2>١. الملخص التنفيذي</h2>
    <p><strong>اسم المشروع:</strong> <span class="placeholder">&nbsp;</span></p>
    <p><strong>الفكرة / المشكلة والحل:</strong></p>
    <p class="placeholder">&nbsp;</p>
    <p><strong>الرؤية والأهداف:</strong></p>
    <p class="placeholder">&nbsp;</p>

    <h2>٢. المنهجية ونطاق الدراسة</h2>
    <p class="placeholder">&nbsp;</p>

    <h2>٣. الجانب المالي</h2>
    <p><strong>إجمالي الاستثمار المطلوب (ريال):</strong> <span class="placeholder">&nbsp;</span></p>
    <p><strong>مصادر التمويل:</strong></p>
    <p class="placeholder">&nbsp;</p>
    <p><strong>أهم المؤشرات (NPV، IRR، فترة الاسترداد، نقطة التعادل):</strong></p>
    <p class="placeholder">&nbsp;</p>

    <h2>٤. تحليل المخاطر</h2>
    <p><strong>أبرز المخاطر وخطط المواجهة:</strong></p>
    <p class="placeholder">&nbsp;</p>

    <h2>٥. الملاحق</h2>
    <p><strong>الفريق / جهات الاتصال:</strong></p>
    <p class="placeholder">&nbsp;</p>

    <div class="footer">هذا الهيكل للملء يدوياً أو للاستيراد إلى معالج نصوص. © ${new Date().getFullYear()}</div>
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `هيكل_دراسة_جدوى_${new Date().toISOString().slice(0, 10)}.html`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('تم تحميل هيكل الدراسة — يمكنك فتحه وملؤه يدوياً أو تحويله إلى Word');
    }

    downloadStructureExcel() {
        const BOM = '\uFEFF';
        const rows = [
            ['القسم', 'الحقل', 'القيمة / الملاحظات'],
            ['الملخص التنفيذي', 'اسم المشروع', ''],
            ['الملخص التنفيذي', 'المشكلة والحل', ''],
            ['الملخص التنفيذي', 'القيمة المميزة', ''],
            ['نطاق السوق', 'TAM (إجمالي السوق)', ''],
            ['نطاق السوق', 'SAM (السوق المستهدف)', ''],
            ['نطاق السوق', 'SOM (الحصة المتوقعة)', ''],
            ['الجانب المالي', 'إجمالي الاستثمار (ريال)', ''],
            ['الجانب المالي', 'مصادر التمويل', ''],
            ['الجانب المالي', 'NPV / IRR / فترة الاسترداد', ''],
            ['تحليل المخاطر', 'أبرز المخاطر', ''],
            ['تحليل المخاطر', 'خطط المواجهة', ''],
            ['التوصية', 'القرار (مضي / مراجعة / لا تدخل)', '']
        ];
        const csv = BOM + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `هيكل_دراسة_جدوى_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('تم تحميل هيكل Excel (CSV) — افتحه في Excel واملأ الأعمدة');
    }
}
