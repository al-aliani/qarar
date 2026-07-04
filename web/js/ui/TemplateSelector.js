/**
 * Template Selector Component
 * Allows users to pick a sector and pre-fill the study with standard data.
 * قوالب جاهزة للتحميل أو الاستخدام داخل المنصة (صناع الحياة / مبادرات).
 */
import { TEMPLATES } from '../core/templates.js';
import { createEmptyStudy } from '../core/schema.js';
import { ProjectManager } from '../services/ProjectManager.js';
import { toast } from '../utils/toast.js';

export class TemplateSelector {
    constructor(containerId, store, onTemplateApplied) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onTemplateApplied = onTemplateApplied;
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="template-selector animate-entry">
                <div class="template-header">
                    <h2 class="text-xl font-bold">🚀 القوالب القطاعية الذكية</h2>
                    <p class="text-muted">قوالب حسب القطاع (مطعم، retail، خدمي) مع قيم افتراضية قابلة للتعديل. اختر قطاع نشاطك لتعبئة الدراسة ببيانات استرشادية — مناسب لمشاريع مثل المذكور تحت كل قالب.</p>
                    <div class="flex flex-wrap gap-2 mt-3">
                        <button type="button" class="btn btn--ghost btn--sm" id="btnDownloadStructureOnly" title="تحميل هيكل دراسة جدوى (HTML) لملئه يدوياً أو فتحه في Word">📄 تحميل هيكل (Word/HTML)</button>
                        <button type="button" class="btn btn--ghost btn--sm" id="btnDownloadStructureExcel" title="تحميل هيكل دراسة جدوى (CSV) لملئه في Excel">📊 تحميل هيكل (Excel/CSV)</button>
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

                <!-- Saved Projects Section -->
                <div class="saved-projects mb-8" id="savedProjectsContainer">
                    <div class="loading-spinner">loading...</div>
                </div>

                <div class="templates-grid">
                    ${Object.values(TEMPLATES).map(template => `
                        <div class="template-card card-hover" data-id="${template.id}">
                            <div class="template-icon">${template.icon}</div>
                            <div class="template-body">
                                <h3>${template.label}</h3>
                                <p>${template.description}</p>
                                ${template.suitableForProjectLike ? `<p class="text-sm text-muted mt-2" style="border-right:3px solid var(--c-p-500); padding-right:8px;">${template.suitableForProjectLike}</p>` : ''}
                                ${template.priceLabel ? `<p class="text-xs text-gold mt-1">السعر: ${template.priceLabel}</p>` : ''}
                            </div>
                            <div class="flex gap-2 mt-2">
                                <button class="btn btn--primary flex-1 btn-apply-template" data-id="${template.id}">تطبيق داخل المنصة</button>
                                <button class="btn btn--ghost btn--sm btn-download-template" data-id="${template.id}" title="تحميل القالب كملف JSON">تحميل (JSON)</button>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="template-footer mt-4">
                    <div class="alert alert--info">
                        <strong>💡 تنبيه:</strong> تطبيق قالب سيمسح البيانات الحالية في الأقسام المتأثرة. يفضل استخدامه في بداية الدراسة.
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();

        // Load projects async
        this.renderSavedProjects().then(html => {
            const detailedContainer = this.container.querySelector('#savedProjectsContainer');
            if (detailedContainer) detailedContainer.innerHTML = html;
            // Re-bind events for dynamic content
            this.bindProjectEvents();
        }).catch(err => {
            console.error('Error rendering saved projects:', err);
            const detailedContainer = this.container.querySelector('#savedProjectsContainer');
            if (detailedContainer) {
                detailedContainer.innerHTML = '<div class="card">حدث خطأ أثناء تحميل المشاريع المحفوظة</div>';
            }
            // أزرار تطبيق القوالب تُربط هنا أيضاً — كان فشل تحميل المشاريع
            // المحفوظة يترك كل أزرار القوالب ميتة
            this.bindProjectEvents();
        });
    }

    async renderSavedProjects() {
        const projects = await ProjectManager.getAllProjects();
        if (projects.length === 0) {
            return `
                <div class="card glass-card mb-4 text-center py-8" style="border:1px solid var(--c-border);">
                    <p class="text-muted mb-2">📂 لا توجد مشاريع محفوظة بعد</p>
                    <p class="text-xs text-muted">ابدأ بإنشاء دراسة جديدة أو احفظ مشروعك من لوحة القرار</p>
                </div>
            `;
        }

        return `
            <div class="card glass-card mb-4" style="border:1px solid var(--c-p-500);">
                <h3 class="card-title text-gold mb-3">📂 مشاريعك المحفوظة</h3>
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

    bindEvents() {
        // ... (Existing bindings) ...
    }

    bindProjectEvents() {
        // Load Project
        this.container.querySelectorAll('.btn-load-project').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const result = await ProjectManager.loadProject(id);
                if (result?.data) {
                    this.store.set(result.data);
                    // Notify and Navigate
                    if (this.onTemplateApplied) this.onTemplateApplied({ id: 'loaded', label: 'Saved Project' });
                }
            });
        });

        // Delete Project
        this.container.querySelectorAll('.btn-delete-project').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.dataset.id;
                if (confirm('هل أنت متأكد من الحذف؟')) {
                    await ProjectManager.deleteProject(id);
                    // Re-render
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

                // Save Preference
                const mode = e.target.dataset.mode;
                this.store.update('appSettings', { mode });
            });
        });

        // Initialize button style from appSettings (بسيط أو كامل)
        const currentMode = (this.store.getState?.()?.appSettings?.mode || this.store.get?.()?.appSettings?.mode) || 'advanced';
        this.container.querySelectorAll('.btn-mode').forEach(b => {
            const isActive = b.dataset.mode === currentMode;
            b.classList.toggle('active', isActive);
            b.style.background = isActive ? 'var(--c-p-500)' : 'transparent';
            b.style.color = isActive ? '#fff' : 'var(--c-text-main)';
        });

        this.container.querySelectorAll('.btn-apply-template').forEach(btn => {
            btn.addEventListener('click', () => {
                const templateId = btn.dataset.id;
                const template = Object.values(TEMPLATES).find(t => t.id === templateId);

                if (confirm(`هل أنت متأكد من رغبتك في تطبيق قالب "${template.label}"؟ سيتم تحديث البيانات بالأرقام الافتراضية لهذا القطاع.`)) {
                    this.applyTemplate(template);
                }
            });
        });

        this.container.querySelectorAll('.btn-download-template').forEach(btn => {
            btn.addEventListener('click', () => {
                const templateId = btn.dataset.id;
                const template = Object.values(TEMPLATES).find(t => t.id === templateId);
                if (template) this.downloadTemplateAsJson(template);
            });
        });

        this.container.querySelector('#btnDownloadStructureOnly')?.addEventListener('click', () => this.downloadStructureOnly());
        this.container.querySelector('#btnDownloadStructureExcel')?.addEventListener('click', () => this.downloadStructureExcel());
    }

    /** تحميل هيكل دراسة جدوى فقط (HTML) لملئه يدوياً — منصات تعليمية (القسم 20) */
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
    <p class="footer">تاريخ التحميل: ${date} | هيكل من محاكي الجدوى — يمكنك الطباعة أو التحويل إلى Word</p>

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

    /** تحميل هيكل دراسة جدوى كـ CSV لفتحه في Excel — قوالب هيكل Word/Excel (Section 36–43) */
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

    /** تحميل القالب كملف JSON — قوالب جاهزة للتحميل (صناع الحياة) */
    downloadTemplateAsJson(template) {
        const empty = createEmptyStudy();
        const merged = JSON.parse(JSON.stringify(empty));
        if (template.data) {
            const data = this._normalizeTemplateData(template.data);
            Object.keys(data).forEach(section => {
                if (merged[section] && typeof merged[section] === 'object' && !Array.isArray(merged[section])) {
                    merged[section] = { ...merged[section], ...data[section] };
                } else {
                    merged[section] = data[section];
                }
            });
        }
        merged.updatedAt = new Date().toISOString();
        const name = (template.label || template.id || 'template').replace(/\s+/g, '_').replace(/[^\w\u0600-\u06FF_-]/g, '');
        const blob = new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `قالب_${name}_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('تم تحميل القالب: ' + (template.label || template.id));
    }

    /**
     * توحيد مفاتيح القالب مع مخطط الدراسة قبل التطبيق —
     * كانت القوالب تكتب بمفاتيح لا يقرأها المحرك ولا الجداول:
     * title→position (فيظهر عمود المسمى فارغاً)، name→service،
     * depreciationYears→depreciationRate (فتُهمل نسب الإهلاك المدروسة)،
     * وopex.costItems قسم غير موجود في المخطط أصلاً (فتضيع كل التكاليف التشغيلية).
     */
    _normalizeTemplateData(rawData) {
        const d = JSON.parse(JSON.stringify(rawData || {}));

        (d.hr?.positions || []).forEach(p => {
            if (p.title && !p.position) p.position = p.title;
            if (p.months == null) p.months = 12;
        });

        (d.revenue?.streams || []).forEach(s => {
            if (s.name && !s.service) s.service = s.name;
        });

        const fixAssets = (arr) => (arr || []).forEach(a => {
            const years = Number(a.depreciationYears);
            if (Number.isFinite(years) && years > 0 && a.depreciationRate == null) {
                a.depreciationRate = Math.round((1 / years) * 10000) / 10000;
            }
        });
        fixAssets(d.technical?.buildings);
        fixAssets(d.technical?.equipment);
        fixAssets(d.technical?.furniture);
        fixAssets(d.technical?.vehicles);
        fixAssets(d.techResources?.techResources);

        // opex.costItems → الأقسام التي يقرأها المحرك فعلاً
        if (Array.isArray(d.opex?.costItems) && d.opex.costItems.length) {
            const admin = [];
            const campaigns = [];
            d.opex.costItems.forEach(item => {
                const name = String(item.name || '');
                const monthly = Number(item.monthlyAmount ?? item.monthly ?? 0);
                if (!monthly) return;
                // GOSI والإقامات يحسبها المحرك تلقائياً من الرواتب والجنسيات — لا نكررها
                if (/GOSI|تأمينات|إقامات|إقامة/i.test(name)) return;
                if (/تسويق|إعلان/i.test(name)) campaigns.push({ name, type: 'operating', monthly });
                else admin.push({ name, monthly });
            });
            if (admin.length) {
                d.administrative = d.administrative || {};
                d.administrative.administrative = [...(d.administrative.administrative || []), ...admin];
            }
            if (campaigns.length) {
                d.marketing = d.marketing || {};
                d.marketing.campaigns = [...(d.marketing.campaigns || []), ...campaigns];
            }
            delete d.opex;
        }

        return d;
    }

    applyTemplate(template) {
        console.log('Applying template:', template.id);

        // Deep merge or specific updates
        const studyData = this.store.get();
        const newData = { ...studyData };

        // كل أقسام القالب تُنسخ (كانت قائمة مثبتة تنسخ 5 أقسام فقط وتُسقط opex
        // — الإيجار وكل التكاليف التشغيلية — فيبدو مشروع القالب أكثر ربحية زوراً)
        const data = this._normalizeTemplateData(template.data);
        Object.keys(data).forEach(section => {
            const tplValue = data[section];
            if (tplValue && typeof tplValue === 'object' && !Array.isArray(tplValue)
                && newData[section] && typeof newData[section] === 'object' && !Array.isArray(newData[section])) {
                newData[section] = { ...newData[section], ...tplValue };
            } else {
                newData[section] = tplValue;
            }
        });

        this.store.set(newData);
        toast.success('تم تطبيق قالب «' + (template.label || template.id) + '» — راجع الأرقام وعدّلها حسب واقعك');

        if (this.onTemplateApplied) {
            this.onTemplateApplied(template);
        }
    }
}
