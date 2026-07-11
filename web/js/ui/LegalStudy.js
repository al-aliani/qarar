import { DynamicTable } from './DynamicTable.js';
import { TABLE_SCHEMAS } from '../core/schema.js';
import { AIWriter } from '../services/AIWriter.js';
import { generateTableSuggestions } from '../services/AIConnector.js';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

export class LegalStudy {
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
        const startData = state.legal || { legalForm: '', licenses: [] };

        this.container.innerHTML = `
            <div class="legal-study animate-entry">
                <div class="flex-between mb-6">
                    <h2 class="section-title mb-0">الدراسة القانونية</h2>
                    <button class="btn btn--magic" id="btnSuggestLegal">${icon('i-sparkle')} اقتراح الهيكل والتراخيص</button>
                </div>
                <p class="text-muted mb-6">حدد الشكل القانوني للمشروع وقائمة التراخيص المطلوبة لبدء النشاط.</p>

                <!-- Legal Form -->
                <div class="card mb-6">
                    <h3 class="card-title">الشكل القانوني</h3>
                    <div class="form-group">
                        <label>نوع المنشأة</label>
                        <select class="input" id="legalForm">
                            <option value="">اختر الشكل القانوني</option>
                            <option value="مؤسسة فردية" ${startData.legalForm === 'مؤسسة فردية' ? 'selected' : ''}>مؤسسة فردية (Sole Proprietorship)</option>
                            <!-- تدقيق 2026-07-08 (ملاحظة منخفضة #62): شركة الشخص الواحد (نظام الشركات
                            الجديد 2016) بديل شائع عن المؤسسة الفردية لحماية أصحاب المطاعم من المسؤولية
                            الشخصية بلا حاجة لشريك — كانت غائبة عن القائمة. -->
                            <option value="شركة الشخص الواحد" ${startData.legalForm === 'شركة الشخص الواحد' ? 'selected' : ''}>شركة الشخص الواحد (SPC)</option>
                            <option value="شركة ذات مسؤولية محدودة" ${startData.legalForm === 'شركة ذات مسؤولية محدودة' ? 'selected' : ''}>شركة ذات مسؤولية محدودة (LLC)</option>
                            <option value="شركة تضامن" ${startData.legalForm === 'شركة تضامن' ? 'selected' : ''}>شركة تضامن</option>
                            <option value="شركة مساهمة" ${startData.legalForm === 'شركة مساهمة' ? 'selected' : ''}>شركة مساهمة (Joint Stock)</option>
                        </select>
                    </div>
                </div>

                <!-- Licenses Table -->
                <div class="card mb-6">
                    <h3 class="card-title">التراخيص والمتطلبات الحكومية</h3>
                    <div id="licensesTableContainer"></div>
                </div>

                <!-- AI Output -->
                <div id="aiLegalSuggestion" class="alert alert--info hidden mb-6"></div>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents();
        this.renderTable(startData.licenses || []);
    }

    renderTable(data) {
        const container = this.container.querySelector('#licensesTableContainer');
        const schema = TABLE_SCHEMAS.licenses;
        // حارس دفاعي: لا نكسر الخطوة كاملة إن غاب تعريف الجدول (مثلاً بعد انحدار في المخطط)
        if (!schema) {
            if (container) container.innerHTML = '<p class="text-danger">تعذّر تحميل جدول التراخيص (تعريف الجدول غير متاح).</p>';
            console.error('TABLE_SCHEMAS.licenses is undefined — schema regression?');
            return;
        }

        // Add onSuggest handler for AI suggestions
        const onSuggest = schema.aiPrompt ? async (btn) => {
            if (btn && btn.disabled) return;
            const originalText = btn ? btn.textContent : '';
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'جاري التوليد...';
            }

            try {
                const state = this.store.getState();
                const projectInfo = state.projectInfo || {};

                // Use unified AI service
                const suggestions = await generateTableSuggestions(schema.aiPrompt, projectInfo);

                if (Array.isArray(suggestions) && suggestions.length > 0) {
                    // Enrich data with IDs - return for DynamicTable to handle
                    const enriched = suggestions.map(item => ({ 
                        name: item.name || item.band || '',
                        quantity: item.quantity || 1,
                        price: item.price || 0,
                        notes: item.notes || '',
                        id: Date.now() + Math.random()
                    }));
                    
                    return enriched;
                }
                return [];
            } catch (err) {
                console.error('AI Licenses Error', err);
                alert('حدث خطأ أثناء الاتصال بالذكاء الاصطناعي');
                return [];
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = originalText;
                }
            }
        } : null;

        const table = new DynamicTable('licensesTableContainer', {
            ...schema,
            initialData: data,
            onSuggest,
            onChange: (newData) => {
                const currentState = this.store.getState().legal || {};
                this.store.update('legal', { ...currentState, licenses: newData });
            }
        });
        table.render();
    }

    bindEvents() {
        // Legal Form Change
        this.container.querySelector('#legalForm').addEventListener('change', (e) => {
            const val = e.target.value;
            const currentState = this.store.getState().legal || {};
            this.store.update('legal', { ...currentState, legalForm: val });
        });

        // AI Suggestion
        this.container.querySelector('#btnSuggestLegal').addEventListener('click', async () => {
            if (this.isGenerating) return;
            this.isGenerating = true;
            const btn = this.container.querySelector('#btnSuggestLegal');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'جاري التوليد...';
            btn.disabled = true;

            const state = this.store.getState();
            const projectInfo = state.projectInfo || {};

            try {
                const result = await AIWriter.generate('legal_advice', projectInfo);
                const aiDiv = this.container.querySelector('#aiLegalSuggestion');

                if (typeof result === 'object' && result.licenses) {
                    // 1. Update Legal Form
                    if (result.legalForm) {
                        const select = this.container.querySelector('#legalForm');
                        select.value = result.legalForm;
                        select.dispatchEvent(new Event('change'));
                    }

                    // 2. Update Licenses Table
                    const currentState = this.store.getState().legal || {};
                    this.store.update('legal', { ...currentState, licenses: result.licenses });
                    this.renderTable(result.licenses);

                    // 3. Show Success
                    aiDiv.innerHTML = `<strong>تم تطبيق الاقتراحات!</strong><br>تم تحديد الشكل القانوني وإضافة ${result.licenses.length} من البنود المتوقعة للجدول.`;
                    aiDiv.className = 'alert alert--success mb-6 animate-entry';
                    aiDiv.classList.remove('hidden');
                } else {
                    // Fallback for text (if server old or error)
                    const formatted = (typeof result === 'string' ? result : JSON.stringify(result)).replace(/\n/g, '<br>');
                    aiDiv.innerHTML = `<strong>${icon('i-lightbulb')} مقترح الذكاء الاصطناعي:</strong><br><div class="text-sm mt-2">${formatted}</div>`;
                    aiDiv.className = 'alert alert--info mb-6 animate-entry';
                    aiDiv.classList.remove('hidden');
                }
            } catch (err) {
                console.error(err);
                alert('فشل في الاتصال بالذكاء الاصطناعي');
            } finally {
                this.isGenerating = false;
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });

        // Navigation
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });
    }
}
