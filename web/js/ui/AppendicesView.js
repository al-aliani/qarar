/**
 * Appendices View - الملاحق والمصادر والمراجع
 * الفجوة المعيارية: نبذة المستثمر، المصادر والمراجع، المحكمون، الاستبيانات، عروض الأسعار
 */

import { DynamicTable } from './DynamicTable.js';
import { TABLE_SCHEMAS } from '../core/schema.js';
import { SECTIONS } from '../core/schema.js';

export class AppendicesView {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        const appendices = state.appendices || {};
        const refs = appendices.references || [];
        const reviewers = appendices.reviewers || [];

        this.container.innerHTML = `
            <div class="appendices-view">
                <h2 class="section-title">الأدلة والمرفقات</h2>
                <p class="text-muted text-sm mb-4">وثّق الأرقام المهمة بمصدر أو عرض سعر أو نتيجة استبيان. لا تضف شرحاً نظرياً؛ أضف دليلاً يمكن مراجعته.</p>

                <div class="card analysis-card">
                    <h3 class="card-title">نبذة عن المستثمر</h3>
                    <p class="text-muted text-sm mb-3">سيرة ذاتية أو ملف تعريفي للمستثمر/الشركة</p>
                    <textarea id="appendices-investorProfile" class="input" rows="4" placeholder="نبذة عن المستثمر أو الشركة...">${(appendices.investorProfile || '').replace(/</g, '&lt;')}</textarea>
                </div>

                <div class="card analysis-card">
                    <h3 class="card-title">المصادر والمراجع</h3>
                    <p class="text-muted text-sm mb-3">قائمة المراجع المستخدمة في إعداد الدراسة (مؤلف، عنوان، ناشر، سنة)</p>
                    <div id="appendices-referencesTable"></div>
                </div>

                <div class="card analysis-card">
                    <h3 class="card-title">المحكمون والمختصون الفنيون</h3>
                    <p class="text-muted text-sm mb-3">من ساهم في إعداد أو مراجعة الدراسة</p>
                    <div id="appendices-reviewersTable"></div>
                </div>

                <div class="card analysis-card">
                    <h3 class="card-title">الاستطلاعات والاستبيانات</h3>
                    <p class="text-muted text-sm mb-3">نتائج الاستبيانات أو الاستطلاعات المستخدمة في الدراسة</p>
                    <textarea id="appendices-surveys" class="input" rows="3" placeholder="وصف أو نتائج الاستبيانات...">${(appendices.surveys && Array.isArray(appendices.surveys) ? appendices.surveys.join('\n') : (appendices.surveys || '')).replace(/</g, '&lt;')}</textarea>
                </div>

                <div class="card analysis-card">
                    <h3 class="card-title">عروض الأسعار والتقارير الفنية</h3>
                    <p class="text-muted text-sm mb-3">عروض أسعار الموردين أو التقارير الفنية المرفقة</p>
                    <textarea id="appendices-priceQuotes" class="input" rows="3" placeholder="ملخص عروض الأسعار أو المراجع...">${(appendices.priceQuotes && Array.isArray(appendices.priceQuotes) ? appendices.priceQuotes.join('\n') : (appendices.priceQuotes || '')).replace(/</g, '&lt;')}</textarea>
                </div>

                <div class="wizard-nav margin-top-lg">
                    <button type="button" class="btn btn--secondary btn-prev-step">السابق</button>
                    <button type="button" class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.renderReferencesTable();
        this.renderReviewersTable();
        this.bindEvents();
    }

    renderReferencesTable() {
        const container = this.container.querySelector('#appendices-referencesTable');
        if (!container) return;
        const schema = TABLE_SCHEMAS.references;
        if (!schema) return;
        const data = this.store.getState().appendices?.references || [];
        const table = new DynamicTable(null, {
            ...schema,
            id: 'references',
            initialData: [...data],
            onChange: (newData) => {
                this.store.update('appendices', { ...this.store.getState().appendices, references: newData });
            }
        });
        table.container = container;
        table.data = data;
        table.render();
    }

    renderReviewersTable() {
        const container = this.container.querySelector('#appendices-reviewersTable');
        if (!container) return;
        const schema = TABLE_SCHEMAS.reviewers;
        if (!schema) return;
        const data = this.store.getState().appendices?.reviewers || [];
        const table = new DynamicTable(null, {
            ...schema,
            id: 'reviewers',
            initialData: [...data],
            onChange: (newData) => {
                this.store.update('appendices', { ...this.store.getState().appendices, reviewers: newData });
            }
        });
        table.container = container;
        table.data = data;
        table.render();
    }

    bindEvents() {
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });

        const investorEl = this.container.querySelector('#appendices-investorProfile');
        if (investorEl) {
            investorEl.addEventListener('change', () => {
                const val = investorEl.value;
                this.store.update('appendices', { ...this.store.getState().appendices, investorProfile: val });
            });
        }

        const surveysEl = this.container.querySelector('#appendices-surveys');
        if (surveysEl) {
            surveysEl.addEventListener('change', () => {
                const val = surveysEl.value;
                this.store.update('appendices', { ...this.store.getState().appendices, surveys: val ? val.split('\n').filter(Boolean) : [] });
            });
        }

        const priceQuotesEl = this.container.querySelector('#appendices-priceQuotes');
        if (priceQuotesEl) {
            priceQuotesEl.addEventListener('change', () => {
                const val = priceQuotesEl.value;
                this.store.update('appendices', { ...this.store.getState().appendices, priceQuotes: val ? val.split('\n').filter(Boolean) : [] });
            });
        }
    }
}
