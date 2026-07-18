/**
 * Study Comparison View
 * UI component to compare the current study against saved studies
 */
import { DataService } from '../services/DataService.js';
import { createTooltip } from '../utils/glossary.js';
import { stepIndexById } from '../core/wizardSteps.js';

export class StudyComparison {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.selectedStudyId = null;
    }

    async render() {
        if (!this.container) return;

        const currentStudy = this.store.get();
        const availableStudies = await DataService.getAvailableStudiesForComparison(currentStudy.projectInfo?.id);

        this.container.innerHTML = `
            <div class="comparison-panel animate-entry">
                <div class="panel-header mb-6">
                    <h2 class="text-xl font-bold flex items-center gap-2">
                        <svg class="ic" aria-hidden="true"><use href="#i-scale"/></svg> مقارنة الدراسات
                    </h2>
                    <p class="text-muted">قارن أداء مشروعك الحالي مع مشاريعك السابقة أو سيناريوهات بديلة.</p>
                    <div class="alert alert--info mt-3" style="font-size: 0.85rem;">
                        <strong>شرط المفاضلة:</strong> لا تستثمر في مشروع واحد بدون مقارنة مع بدائل أخرى — الأفضل: ابحث عن 2–3 أفكار وقارنها قبل التفصيل. أنشئ دراسات مسودة وقارن مؤشراتها.
                    </div>
                    ${this.onNavigate ? `<div class="mt-2"><button type="button" class="btn btn--secondary btn-sm" id="btnAddIdeaForComparison">+ إضافة فكرة جديدة للمقارنة</button> <span class="text-muted text-sm">(انتقل لخطوة اختيار المشروع)</span></div>` : ''}
                </div>

                <!-- Selection Control -->
                <div class="comparison-controls card p-4 mb-6">
                    <label class="block text-sm font-medium mb-2" for="compareStudySelect">اختر دراسة للمقارنة معها:</label>
                    <div class="flex gap-4">
                        <select id="compareStudySelect" class="form-input flex-1">
                            <option value="">-- اختر مشروعاً محفوظاً --</option>
                            ${availableStudies.map(s => `
                                <option value="${s.id}" ${this.selectedStudyId === s.id ? 'selected' : ''}>
                                    ${s.name} (${new Date(s.date).toLocaleDateString('ar-SA-u-nu-latn')})
                                </option>
                            `).join('')}
                        </select>
                        <button id="btnRunComparison" class="btn btn--primary" ${!this.selectedStudyId ? 'disabled' : ''}>
                            مقارنة الآن
                        </button>
                    </div>
                </div>

                <!-- Results Container -->
                <div id="comparisonResults" class="comparison-results">
                    ${this.selectedStudyId ? '<div class="p-4 text-muted">جاري تحميل المقارنة...</div>' : this.renderEmptyState()}
                </div>
            </div>
        `;

        this.bindEvents();
        if (this.selectedStudyId) this.loadAndShowAnalysis();
    }

    async loadAndShowAnalysis() {
        const el = this.container?.querySelector('#comparisonResults');
        if (!el) return;
        try {
            const currentStudy = this.store.get();
            const analysis = await DataService.compareStudies(currentStudy, this.selectedStudyId);
            const { comparison, meta } = analysis;
            el.innerHTML = `
                <div class="comparison-grid">
                    <div class="comp-header-card">
                        <div>المؤشر</div>
                        <div class="text-primary font-bold">${meta.savedName} (المرجع)</div>
                        <div class="text-gold font-bold">${meta.currentName} (الحالي)</div>
                        <div>الفارق</div>
                    </div>
                    ${this.renderRow('صافي القيمة الحالية', 'NPV', comparison.npv)}
                    ${this.renderRow('معدل العائد الداخلي', 'IRR', comparison.irr)}
                    ${this.renderRow('فترة الاسترداد', 'PAYBACK', comparison.payback)}
                    ${this.renderRow('رأس المال المطلوب', 'CAPEX', comparison.capex)}
                    ${this.renderRow('التكاليف التشغيلية', 'OPEX', comparison.opex)}
                    ${this.renderRow('إيرادات السنة الأولى', null, comparison.revenue)}
                </div>
                <div class="mt-6 p-4 bg-glass rounded">
                    <h3 class="font-bold text-gold mb-2"><svg class="ic" aria-hidden="true"><use href="#i-lightbulb"/></svg> الخلاصة</h3>
                    <p>${this.generateInsight(comparison)}</p>
                </div>
            `;
        } catch (err) {
            console.error(err);
            el.innerHTML = '<div class="p-4 text-danger">فشل تحميل المقارنة. تأكد من وجود الدراسة المحفوظة.</div>';
        }
    }

    renderEmptyState() {
        return `
            <div class="text-center p-8 text-muted border-dashed">
                <svg class="ic text-4xl mb-4" aria-hidden="true"><use href="#i-chart"/></svg>
                <p>اختر دراسة من القائمة أعلاه لبدء المقارنة التفصيلية</p>
            </div>
        `;
    }

    renderRow(label, term, data) {
        if (!data) return '';

        const format = (val) => {
            if (val === '--') return '--';
            if (data.isPercent) return (val * 100).toFixed(1) + '%';
            if (term === 'PAYBACK') return val.toFixed(1) + ' سنة';
            return new Intl.NumberFormat('ar-SA').format(Math.round(val));
        };

        const diffIcon = data.status === 'positive' ? '<span class="inline-block w-2 h-2 rounded-full bg-green-500"></span>' : data.status === 'negative' ? '<span class="inline-block w-2 h-2 rounded-full bg-red-500"></span>' : '<span class="inline-block w-2 h-2 rounded-full bg-gray-400"></span>';
        const diffSign = data.diff > 0 ? '+' : '';
        const diffText = `${diffSign}${format(data.diff)}`;
        const pctText = `(${diffSign}${data.pct.toFixed(1)}%)`;

        return `
            <div class="comp-row-card">
                <div class="flex items-center gap-2">
                    ${label}
                    ${term ? createTooltip(term) : ''}
                </div>
                <div class="text-muted font-mono">${format(data.base)}</div>
                <div class="font-bold font-mono text-lg">${format(data.current)}</div>
                <div class="font-mono text-sm ${data.status}">
                    ${diffIcon} ${diffText} <br>
                    <span class="text-xs opacity-75">${pctText}</span>
                </div>
            </div>
        `;
    }

    generateInsight(comparison) {
        const npvBetter = comparison.npv.status === 'positive';
        const irrBetter = comparison.irr.status === 'positive';

        if (npvBetter && irrBetter) {
            return `المشروع الحالي يتفوق بوضوح على الدراسة المقارنة! زيادة في صافي القيمة الحالية بنسبة ${comparison.npv.pct.toFixed(0)}% وتحسن في معدل العائد.`;
        } else if (!npvBetter && !irrBetter) {
            return `تنبيه: أداء المشروع الحالي أقل من الدراسة المرجعية. راجع التكاليف والإيرادات لتحسين النتائج.`;
        } else {
            return `النتائج متباينة. هناك تحسن في بعض الجوانب وتراجع في أخرى. وازن بين العائد والمخاطرة.`;
        }
    }

    bindEvents() {
        const select = this.container.querySelector('#compareStudySelect');
        const btn = this.container.querySelector('#btnRunComparison');

        if (select) {
            select.addEventListener('change', (e) => {
                this.selectedStudyId = e.target.value;
                if (btn) btn.disabled = !this.selectedStudyId;
            });
        }

        if (btn) {
            btn.addEventListener('click', () => {
                this.render();
            });
        }

        this.container.querySelector('#btnAddIdeaForComparison')?.addEventListener('click', () => {
            const idx = stepIndexById('projectAlternatives');
            if (typeof this.onNavigate === 'function' && idx >= 0) {
                this.onNavigate(idx);
            }
        });
    }
}
