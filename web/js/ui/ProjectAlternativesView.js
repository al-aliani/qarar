/**
 * مرحلة اختيار المشروع قبل التفصيل (د. الروضي)
 * "لديك أكثر من فكرة؟ قارنها مبدئياً قبل الدخول في التفصيل"
 */
export class ProjectAlternativesView {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
    }

    render() {
        if (!this.container) return;

        const state = this.store.getState();
        const pa = state.projectAlternatives || {};
        const ideas = pa.ideas || [];
        const selectedIndex = pa.selectedIndex ?? 0;

        const esc = (s) => (s || '').toString().replace(/</g, '&lt;').replace(/"/g, '&quot;');

        this.container.innerHTML = `
            <div class="project-alternatives-view animate-entry">
                <h2 class="section-title">⚖️ اختيار المشروع قبل التفصيل</h2>
                <p class="text-muted mb-4">إذا لديك أكثر من فكرة مشروع، قارنها مبدئياً قبل الدخول في الدراسة التفصيلية. إذا مشروع واحد فقط — اكمل مباشرة.</p>

                <div class="alert alert--info mb-4" style="font-size: 0.9rem;">
                    <strong>شرط المفاضلة:</strong> لا تستثمر في مشروع واحد بدون مقارنة — قارن 2–3 أفكار (تكلفة تقريبية، عائد متوقع) ثم اختر الأفضل للمتابعة.
                </div>

                <div class="card analysis-card mb-4">
                    <h3 class="card-title">جدول مقارنة الأفكار (مبدئي)</h3>
                    <div class="table-responsive">
                        <table class="data-table" id="alternativesTable">
                            <thead>
                                <tr>
                                    <th>✓</th>
                                    <th>اسم الفكرة</th>
                                    <th>تكلفة تقريبية (ر.س)</th>
                                    <th>عائد متوقع (ر.س/سنة)</th>
                                    <th>ملاحظة</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="alternativesBody">
                                ${ideas.length === 0 ? `
                                    <tr class="empty-row">
                                        <td colspan="6" class="text-center text-muted py-4">لا توجد أفكار — أضف فكرة أو اكمل مباشرة</td>
                                    </tr>
                                ` : ideas.map((idea, i) => `
                                    <tr data-idx="${i}">
                                        <td><input type="radio" name="selectedAlt" ${selectedIndex === i ? 'checked' : ''} value="${i}"></td>
                                        <td><input type="text" class="input input--sm alt-field" data-field="name" placeholder="اسم الفكرة" value="${esc(idea.name)}"></td>
                                        <td><input type="number" class="input input--sm alt-field" data-field="estimatedCost" placeholder="0" value="${idea.estimatedCost ?? ''}"></td>
                                        <td><input type="number" class="input input--sm alt-field" data-field="estimatedReturn" placeholder="0" value="${idea.estimatedReturn ?? ''}"></td>
                                        <td><input type="text" class="input input--sm alt-field" data-field="notes" placeholder="ملاحظة" value="${esc(idea.notes)}"></td>
                                        <td><button type="button" class="btn-icon btn-remove-alt" data-idx="${i}">🗑️</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <button type="button" class="btn btn--secondary btn-sm mt-2" id="btnAddIdea">+ إضافة فكرة</button>
                </div>

                <div class="flex-between gap-3">
                    <button type="button" class="btn btn--ghost" id="btnBack">← رجوع</button>
                    <button type="button" class="btn btn--primary" id="btnContinue">متابعة للقوالب ←</button>
                </div>
            </div>
        `;

        this._bindEvents();
    }

    _save() {
        const rows = this.container.querySelectorAll('#alternativesBody tr[data-idx]');
        const ideas = [];
        let selectedIndex = parseInt(this.container.querySelector('input[name="selectedAlt"]:checked')?.value ?? '0', 10) || 0;

        rows.forEach((tr, i) => {
            const name = tr.querySelector('[data-field="name"]')?.value?.trim() || '';
            const estimatedCost = parseFloat(tr.querySelector('[data-field="estimatedCost"]')?.value) || 0;
            const estimatedReturn = parseFloat(tr.querySelector('[data-field="estimatedReturn"]')?.value) || 0;
            const notes = tr.querySelector('[data-field="notes"]')?.value?.trim() || '';
            if (name || estimatedCost || estimatedReturn || notes) {
                ideas.push({ name, estimatedCost, estimatedReturn, notes });
            }
        });

        const safeSelected = ideas.length === 0 ? 0 : Math.min(Math.max(0, selectedIndex), ideas.length - 1);

        this.store.updatePath('projectAlternatives', null, {
            ideas,
            selectedIndex: safeSelected
        });
    }

    _bindEvents() {
        const navToTemplates = () => {
            this._save();
            this.onNavigate(2); // templates
        };

        this.container.querySelector('#btnContinue')?.addEventListener('click', navToTemplates);
        this.container.querySelector('#btnBack')?.addEventListener('click', () => {
            this._save();
            this.onNavigate(0); // preliminaryCheck
        });

        this.container.querySelector('#btnAddIdea')?.addEventListener('click', () => {
            this._save();
            const pa = this.store.getState().projectAlternatives || {};
            const ideas = [...(pa.ideas || []), { name: '', estimatedCost: 0, estimatedReturn: 0, notes: '' }];
            this.store.updatePath('projectAlternatives.ideas', null, ideas);
            this.render();
        });

        this.container.querySelectorAll('.btn-remove-alt').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                this._save();
                const pa = this.store.getState().projectAlternatives || {};
                const ideas = (pa.ideas || []).filter((_, i) => i !== idx);
                const selectedIndex = pa.selectedIndex >= ideas.length ? Math.max(0, ideas.length - 1) : pa.selectedIndex;
                this.store.updatePath('projectAlternatives', null, { ideas, selectedIndex: Math.min(selectedIndex, ideas.length - 1) });
                this.render();
            });
        });

        this.container.querySelectorAll('.alt-field, input[name="selectedAlt"]').forEach(el => {
            el.addEventListener('change', () => this._save());
            el.addEventListener('blur', () => this._save());
        });
    }
}
