/**
 * أمثلة دراسات — استلهم (LivePlan — القسم 21)
 * 5–10 دراسات نموذجية بأسماء وهمية مع "استخدام كقالب" لنسخ الهيكل والمدخلات الافتراضية.
 */
import { TEMPLATES } from '../core/templates.js';
import { EXAMPLE_STUDIES } from '../config.js';
import { toast } from '../utils/toast.js';

export class ExamplesInspireView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = options.store || null;
        this.onBack = options.onBack || (() => {});
        this.onTemplateApplied = options.onTemplateApplied || (() => {});
    }

    render() {
        if (!this.container) return;

        const items = (EXAMPLE_STUDIES || []).map(ex => {
            const template = Object.values(TEMPLATES || {}).find(t => t.id === ex.templateId);
            return { ...ex, template };
        }).filter(x => x.template);

        this.container.innerHTML = `
            <div class="examples-inspire-view animate-entry p-6 max-w-4xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="examplesInspireBack">← العودة</button>
                <h1 class="text-2xl font-bold mb-2">استلهم من أمثلة دراسات</h1>
                <p class="text-muted mb-6">دراسات نموذجية بأسماء وهمية — استخدم كقالب لنسخ الهيكل والمدخلات الافتراضية ثم عدّل حسب مشروعك.</p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="examplesInspireGrid">
                    ${items.map((ex, i) => `
                        <div class="card card-hover p-4 flex flex-col" data-template-id="${ex.templateId}">
                            <div class="flex items-center gap-3 mb-2">
                                <span class="text-2xl">${ex.icon || '📄'}</span>
                                <div>
                                    <h3 class="font-bold text-gold">${(ex.displayName || ex.template?.label || '').toString().replace(/</g, '&lt;')}</h3>
                                    <p class="text-sm text-muted">${(ex.sector || ex.template?.label || '').toString().replace(/</g, '&lt;')}</p>
                                </div>
                            </div>
                            <p class="text-sm text-muted mb-4 flex-grow">${(ex.template?.description || '').toString().replace(/</g, '&lt;').slice(0, 120)}${(ex.template?.description || '').length > 120 ? '...' : ''}</p>
                            <button type="button" class="btn btn--primary btn-apply-example w-full" data-template-id="${ex.templateId}">استخدام كقالب</button>
                        </div>
                    `).join('')}
                </div>

                <p class="text-sm text-muted mt-6 text-center">تطبيق قالب سيمسح البيانات الحالية في الأقسام المتأثرة. يُفضّل استخدامه في بداية دراسة جديدة.</p>
            </div>
        `;

        this.container.querySelector('#examplesInspireBack')?.addEventListener('click', () => this.onBack());

        this.container.querySelectorAll('.btn-apply-example').forEach(btn => {
            btn.addEventListener('click', () => {
                const templateId = btn.dataset.templateId;
                const template = Object.values(TEMPLATES || {}).find(t => t.id === templateId);
                if (!template) {
                    toast.error('القالب غير متوفر.');
                    return;
                }
                if (!this.store) {
                    toast.warning('لا يوجد دراسة مفتوحة. ابدأ دراسة جديدة من لوحة التحكم ثم عد إلى «استلهم».');
                    this.onTemplateApplied(template);
                    return;
                }
                if (confirm(`هل تريد استخدام قالب «${template.label}»؟ سيتم تحديث البيانات بالأرقام الافتراضية.`)) {
                    this.applyTemplate(template);
                    toast.success('تم تطبيق القالب. عدّل البيانات حسب مشروعك.');
                    this.onTemplateApplied(template);
                }
            });
        });
    }

    applyTemplate(template) {
        if (!this.store || !template?.data) return;
        const studyData = this.store.get ? this.store.get() : this.store.getState();
        const newData = { ...studyData };
        if (template.data.projectInfo) newData.projectInfo = { ...newData.projectInfo, ...template.data.projectInfo };
        if (template.data.technical) newData.technical = { ...newData.technical, ...template.data.technical };
        if (template.data.hr) newData.hr = { ...newData.hr, ...template.data.hr };
        if (template.data.revenue) newData.revenue = { ...newData.revenue, ...template.data.revenue };
        if (template.data.marketing) newData.marketing = { ...newData.marketing, ...template.data.marketing };
        if (template.data.opex) newData.opex = { ...newData.opex, ...template.data.opex };
        this.store.set(newData);
        if (this.store.notify) this.store.notify();
    }
}
