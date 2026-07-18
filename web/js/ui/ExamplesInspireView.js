/**
 * أمثلة دراسات — تُعرض فقط عند وجود أمثلة معتمدة من مختصين.
 */
import { EXAMPLE_STUDIES } from '../config.js';

export class ExamplesInspireView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onBack = options.onBack || (() => {});
    }

    render() {
        if (!this.container) return;

        const items = EXAMPLE_STUDIES || [];

        this.container.innerHTML = `
            <div class="examples-inspire-view animate-entry p-6 max-w-4xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="examplesInspireBack">← العودة</button>
                <h1 class="text-2xl font-bold mb-2">أمثلة المختصين المعتمدة</h1>
                <p class="text-muted mb-6">لن نعرض أمثلة أو قوالب بأرقام افتراضية غير موثقة. عند توفر قالب خبير معتمد سيظهر هنا مع اسم صاحبه ونطاق خبرته.</p>

                ${items.length ? `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="examplesInspireGrid">
                        ${items.map(ex => `
                            <div class="card p-4 flex flex-col">
                                <div class="flex items-center gap-3 mb-2">
                                    <span class="text-2xl">${ex.icon || '<svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg>'}</span>
                                    <div>
                                        <h3 class="font-bold text-gold">${(ex.displayName || '').toString().replace(/</g, '&lt;')}</h3>
                                        <p class="text-sm text-muted">${(ex.sector || '').toString().replace(/</g, '&lt;')}</p>
                                    </div>
                                </div>
                                <p class="text-sm text-muted mb-0">${(ex.description || '').toString().replace(/</g, '&lt;')}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="card glass-card text-center py-8" style="border:1px solid var(--c-border);">
                        <h3 class="card-title mb-2">لا توجد أمثلة معتمدة حالياً</h3>
                        <p class="text-sm text-muted mb-0">الخطوة التالية هي استقبال قوالب من مختصين حقيقيين ومراجعتها قبل عرضها للعملاء.</p>
                    </div>
                `}
            </div>
        `;

        this.container.querySelector('#examplesInspireBack')?.addEventListener('click', () => this.onBack());
    }
}
