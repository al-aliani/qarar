/**
 * ReportBuilderView.js
 * صفحة بناء التقرير — أقسام التقرير كبطاقات قابلة لإعادة الترتيب بالسحب والإفلات.
 * (مستوحى من PlanGuru / مرونة ترتيب الأقسام)
 * جدوى كلاود: شريط توليد سريع بالذكاء الاصطناعي (ملخص، تحليل سوق، SWOT، منافسون).
 */

import Swal from 'sweetalert2';
import { DEFAULT_REPORT_SECTION_ORDER } from '../core/schema.js';
import { AIConnector } from '../services/AIConnector.js';
import { toast } from '../utils/toast.js';

const REPORT_SECTION_LABELS = {
    executive_summary: 'الملخص التنفيذي',
    preliminary: 'الدراسة المبدئية',
    project_alternatives: 'مقارنة أفكار المشاريع',
    project_info: 'معلومات المشروع الأساسية',
    market: 'تحليل السوق',
    intro_feasibility: 'مقدمة الجدوى',
    marketing: 'التحليل التسويقي',
    financial_kpis: 'الملخص المالي (المؤشرات المالية)',
    swot: 'التحليل الاستراتيجي (التحليل الرباعي)',
    pestel: 'تحليل البيئة الكلية (PESTEL)',
    porter: 'تحليل قوى بورتر الخمس',
    tows: 'مصفوفة الاستراتيجيات (TOWS)',
    capex: 'الاستثمارات الرأسمالية',
    legal: 'الدراسة القانونية والتراخيص',
    income_statement: 'قائمة الدخل',
    cash_flow: 'قائمة التدفقات النقدية',
    loan_schedule: 'جدول سداد القرض',
    balance_sheet: 'الميزانية العمومية (قائمة المركز المالي)',
    business_model: 'نموذج العمل',
    org_structure: 'الهيكل التنظيمي وخطة التوطين',
    risks: 'تحليل المخاطر',
    appendices: 'الملاحق والمصادر وعروض الأسعار',
    scenarios: 'مقارنة السيناريوهات',
    sensitivity: 'تحليل الحساسية',
    recommendation: 'التوصية النهائية والقرار الاستثماري'
};

export class ReportBuilderView {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.draggedId = null;
    }

    getOrder() {
        const state = this.store.getState ? this.store.getState() : this.store.get();
        const order = state.reportSectionOrder;
        if (Array.isArray(order) && order.length > 0) {
            return [...order];
        }
        return [...DEFAULT_REPORT_SECTION_ORDER];
    }

    saveOrder(order) {
        const state = this.store.getState ? this.store.getState() : this.store.get();
        state.reportSectionOrder = order;
        if (this.store.save) this.store.save();
        if (this.store.notify) this.store.notify();
        // ترتيب الأقسام يُستخدم عند تصدير التقرير (ReportGenerator/BankReportGenerator)
    }

    render() {
        const order = this.getOrder();
        const allIds = [...new Set([...DEFAULT_REPORT_SECTION_ORDER, ...order])];
        const displayOrder = order.length >= allIds.length ? order : allIds;

        this.container.innerHTML = `
            <div class="report-builder animate-entry">
                <div class="report-builder-header">
                    <h2 class="report-builder-title page-title"><svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg> بناء التقرير</h2>
                    <p class="report-builder-desc">اسحب البطاقات وأفلتها لإعادة ترتيب أقسام التقرير. مثلاً: ضع «الملخص المالي» في البداية لإبراز الأرباح.</p>
                </div>
                <div class="report-builder-ai-bar mb-4 p-3 rounded-lg border border-border bg-card" role="group" aria-label="مساعد الكتابة — اكتب لي هذا القسم">
                    <div class="text-xs text-muted mb-2"><svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg> اكتب لي هذا القسم — توليد سريع بالذكاء الاصطناعي (الملخص، السوق، التسويق، المخاطر):</div>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" class="btn btn--sm btn-magic btn-ai-summary" data-type="summary">ولّد الملخص التنفيذي</button>
                        <button type="button" class="btn btn--sm btn-magic btn-ai-market" data-type="market">ولّد تحليل السوق</button>
                        <button type="button" class="btn btn--sm btn-magic btn-ai-swot" data-type="swot">ولّد SWOT</button>
                        <button type="button" class="btn btn--sm btn-magic btn-ai-competitors" data-type="competitors">ولّد تحليل المنافسين</button>
                        <button type="button" class="btn btn--sm btn-magic btn-ai-risks" data-type="risks">ولّد تحليل المخاطر</button>
                    </div>
                </div>
                <div class="report-builder-ai-preview card mb-4 hidden" id="reportBuilderAiPreview" aria-live="polite">
                    <h3 class="text-gold mb-2" id="reportBuilderAiPreviewTitle">الناتج المقترح</h3>
                    <p class="text-sm" id="reportBuilderAiPreviewText"></p>
                </div>
                <div class="report-builder-cards" id="reportBuilderCards">
                    ${displayOrder.map(id => this.renderCard(id)).join('')}
                </div>
                <p class="report-builder-hint text-muted text-sm mt-4">الترتيب الحالي يُطبَّق عند تصدير التقرير (PDF أو تقرير بنكي).</p>
            </div>
        `;

        this.bindDragDrop();
        this.bindAIGenerate();
    }

    renderCard(id) {
        const label = REPORT_SECTION_LABELS[id] || id;
        return `<div class="report-builder-card" data-id="${id}" draggable="true" role="button" tabindex="0" aria-label="قسم: ${label}. اسحب لإعادة الترتيب">
                <span class="report-builder-card-grip" aria-hidden="true">⋮⋮</span>
                <span class="report-builder-card-label">${label}</span>
            </div>`;
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    showAIPreview(title, text) {
        const box = this.container.querySelector('#reportBuilderAiPreview');
        const titleEl = this.container.querySelector('#reportBuilderAiPreviewTitle');
        const textEl = this.container.querySelector('#reportBuilderAiPreviewText');
        if (!box || !titleEl || !textEl) return;
        titleEl.textContent = title || 'الناتج المقترح';
        textEl.innerHTML = this.escapeHtml(text || '').replace(/\n/g, '<br>');
        box.classList.remove('hidden');
    }

    bindDragDrop() {
        const cardsEl = this.container.querySelector('#reportBuilderCards');
        if (!cardsEl) return;

        const cards = cardsEl.querySelectorAll('.report-builder-card');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                this.draggedId = card.dataset.id;
                card.classList.add('report-builder-card-dragging');
                e.dataTransfer.setData('text/plain', this.draggedId);
                e.dataTransfer.effectAllowed = 'move';
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('report-builder-card-dragging');
                cardsEl.querySelectorAll('.report-builder-card').forEach(c => c.classList.remove('report-builder-card-drag-over'));
                this.draggedId = null;
            });
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (this.draggedId && card.dataset.id !== this.draggedId) {
                    card.classList.add('report-builder-card-drag-over');
                }
            });
            card.addEventListener('dragleave', () => {
                card.classList.remove('report-builder-card-drag-over');
            });
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('report-builder-card-drag-over');
                if (!this.draggedId || card.dataset.id === this.draggedId) return;
                const order = this.getOrder();
                const fromIdx = order.indexOf(this.draggedId);
                const toIdx = order.indexOf(card.dataset.id);
                if (fromIdx === -1 || toIdx === -1) return;
                order.splice(fromIdx, 1);
                order.splice(toIdx, 0, this.draggedId);
                this.saveOrder(order);
                this.render();
            });
        });
    }

    bindAIGenerate() {
        const connector = new AIConnector();

        const getState = () => this.store.getState ? this.store.getState() : this.store.get();

        const setLoading = (btn, loading) => {
            if (!btn) return;
            btn.disabled = loading;
            const label = btn.dataset.label || btn.textContent;
            btn.textContent = loading ? 'جاري التوليد...' : label;
        };

        const restoreLabel = (btn) => {
            const labels = { summary: 'ولّد الملخص التنفيذي', market: 'ولّد تحليل السوق', swot: 'ولّد SWOT', competitors: 'ولّد تحليل المنافسين', risks: 'ولّد تحليل المخاطر' };
            btn.textContent = labels[btn.dataset.type] || btn.dataset.label || 'توليد';
        };

        this.container.querySelector('.btn-ai-summary')?.addEventListener('click', async (e) => {
            const btn = e.target;
            const label = btn.textContent;
            btn.dataset.label = label;
            setLoading(btn, true);
            const state = getState();
            try {
                let results = null;
                try {
                    const { calculateStudy } = await import('../core/engine.js');
                    results = calculateStudy(state);
                } catch (_) {}
                const existingSummary = (state.executiveSummary?.projectOverview || '').trim();
                if (existingSummary) {
                    const confirmResult = await Swal.fire({
                        title: 'هل أنت متأكد؟',
                        text: 'سيستبدل هذا الملخصَ التنفيذي الحالي. متابعة؟',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'نعم، استبدل',
                        cancelButtonText: 'إلغاء',
                        customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
                        buttonsStyling: false
                    });
                    if (!confirmResult.isConfirmed) {
                        btn.disabled = false; restoreLabel(btn); return;
                    }
                }
                const text = await connector.generateExecutiveSummary(state, results);
                if (typeof text === 'string' && text.trim()) {
                    const prev = (getState().executiveSummary || {});
                    this.store.update('executiveSummary', { ...prev, projectOverview: text });
                    if (this.store.notify) this.store.notify();
                    this.showAIPreview('الملخص التنفيذي المقترح', text);
                    toast.success('تم توليد الملخص التنفيذي. راجع قسم الملخص التنفيذي.');
                } else toast.warning('لم يُنشأ نص. جرّب مرة أخرى أو أضف بيانات المشروع.');
            } catch (err) {
                console.error('AI summary failed:', err);
                toast.error('فشل التوليد: ' + (err?.message || 'خطأ'));
            } finally {
                btn.disabled = false;
                restoreLabel(btn);
            }
        });

        this.container.querySelector('.btn-ai-market')?.addEventListener('click', async (e) => {
            const btn = e.target;
            btn.dataset.label = btn.textContent;
            setLoading(btn, true);
            const state = getState();
            try {
                const existingMarket = (state.marketing?.marketAnalysis?.summary || '').trim();
                if (existingMarket) {
                    const confirmResult = await Swal.fire({
                        title: 'هل أنت متأكد؟',
                        text: 'سيستبدل هذا ملخصَ تحليل السوق الحالي. متابعة؟',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'نعم، استبدل',
                        cancelButtonText: 'إلغاء',
                        customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
                        buttonsStyling: false
                    });
                    if (!confirmResult.isConfirmed) {
                        btn.disabled = false; restoreLabel(btn); return;
                    }
                }
                const text = await connector.generateMarketAnalysisText(state);
                if (typeof text === 'string' && text.trim()) {
                    const marketing = state.marketing || {};
                    const marketAnalysis = marketing.marketAnalysis || {};
                    this.store.update('marketing', { ...marketing, marketAnalysis: { ...marketAnalysis, summary: text } });
                    if (this.store.notify) this.store.notify();
                    toast.success('تم توليد تحليل السوق. راجع قسم التحليل التسويقي.');
                } else toast.warning('لم يُنشأ نص. جرّب مرة أخرى.');
            } catch (err) {
                console.error('AI market failed:', err);
                toast.error('فشل التوليد: ' + (err?.message || 'خطأ'));
            } finally {
                btn.disabled = false;
                restoreLabel(btn);
            }
        });

        this.container.querySelector('.btn-ai-swot')?.addEventListener('click', async (e) => {
            const btn = e.target;
            btn.dataset.label = btn.textContent;
            setLoading(btn, true);
            const state = getState();
            try {
                const prevSwot = (state.strategic || state.strategicAnalysis || {}).swot || {};
                const hasSwot = (prevSwot.strengths?.length || prevSwot.weaknesses?.length || prevSwot.opportunities?.length || prevSwot.threats?.length);
                if (hasSwot) {
                    const confirmResult = await Swal.fire({
                        title: 'هل أنت متأكد؟',
                        text: 'سيستبدل هذا تحليلَ SWOT الحالي. متابعة؟',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'نعم، استبدل',
                        cancelButtonText: 'إلغاء',
                        customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
                        buttonsStyling: false
                    });
                    if (!confirmResult.isConfirmed) {
                        btn.disabled = false; restoreLabel(btn); return;
                    }
                }
                const swot = await connector.generateSWOT(state);
                if (swot && (swot.strengths?.length || swot.weaknesses?.length || swot.opportunities?.length || swot.threats?.length)) {
                    const strategic = state.strategic || state.strategicAnalysis || {};
                    this.store.update('strategic', { ...strategic, swot });
                    if (this.store.notify) this.store.notify();
                    toast.success('تم توليد SWOT. راجع قسم التحليل الاستراتيجي.');
                } else toast.warning('لم يُنشأ تحليل SWOT. جرّب مرة أخرى.');
            } catch (err) {
                console.error('AI SWOT failed:', err);
                toast.error('فشل التوليد: ' + (err?.message || 'خطأ'));
            } finally {
                btn.disabled = false;
                restoreLabel(btn);
            }
        });

        this.container.querySelector('.btn-ai-competitors')?.addEventListener('click', async (e) => {
            const btn = e.target;
            btn.dataset.label = btn.textContent;
            setLoading(btn, true);
            const state = getState();
            try {
                const existingCompetitors = state.marketing?.competitors || [];
                if (existingCompetitors.length > 0) {
                    const confirmResult = await Swal.fire({
                        title: 'هل أنت متأكد؟',
                        text: `سيستبدل هذا ${existingCompetitors.length} منافساً أدخلتهم. متابعة؟`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'نعم، استبدل',
                        cancelButtonText: 'إلغاء',
                        customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
                        buttonsStyling: false
                    });
                    if (!confirmResult.isConfirmed) {
                        btn.disabled = false; restoreLabel(btn); return;
                    }
                }
                const competitors = await connector.generateCompetitors(state);
                if (Array.isArray(competitors) && competitors.length > 0) {
                    const marketing = state.marketing || {};
                    this.store.update('marketing', { ...marketing, competitors });
                    if (this.store.notify) this.store.notify();
                    toast.success('تم توليد تحليل المنافسين. راجع قسم التحليل التسويقي.');
                } else toast.warning('لم يُنشأ منافسون. جرّب مرة أخرى.');
            } catch (err) {
                console.error('AI competitors failed:', err);
                toast.error('فشل التوليد: ' + (err?.message || 'خطأ'));
            } finally {
                btn.disabled = false;
                restoreLabel(btn);
            }
        });

        this.container.querySelector('.btn-ai-risks')?.addEventListener('click', async (e) => {
            const btn = e.target;
            btn.dataset.label = btn.textContent;
            setLoading(btn, true);
            const state = getState();
            try {
                const risks = await connector.generateRisksForReport(state);
                if (Array.isArray(risks) && risks.length > 0) {
                    const riskAnalysis = state.riskAnalysis || { risks: [] };
                    const existing = riskAnalysis.risks || [];
                    const merged = [...existing];
                    // إزالة التكرار بالاسم — كانت كل نقرة تضيف نفس المخاطر مجدداً
                    const seen = new Set(existing.map(r => (r.name || r.description || '').trim()));
                    risks.forEach(r => {
                        const key = (r?.name || r?.description || '').trim();
                        if (!key || seen.has(key)) return;
                        seen.add(key);
                        merged.push({
                            name: r.name || r.description,
                            description: r.description || r.name || '',
                            probability: r.probability || 'medium',
                            impact: r.impact || 'medium',
                            mitigation: r.mitigation || ''
                        });
                    });
                    if (merged.length === existing.length) {
                        toast.info('لا مخاطر جديدة — المقترحات موجودة مسبقاً في القسم.');
                        return;
                    }
                    this.store.update('riskAnalysis', { ...riskAnalysis, risks: merged });
                    if (this.store.notify) this.store.notify();
                    toast.success('تم توليد تحليل المخاطر. راجع قسم تحليل المخاطر.');
                } else toast.warning('لم يُنشأ مخاطر. جرّب مرة أخرى.');
            } catch (err) {
                console.error('AI risks failed:', err);
                toast.error('فشل التوليد: ' + (err?.message || 'خطأ'));
            } finally {
                btn.disabled = false;
                restoreLabel(btn);
            }
        });
    }
}
