/**
 * Timeline Component — خارطة الطريق المرئية (Visual Roadmap)
 * خط زمني أفقي أنيق: مراحل كدوائر متصلة بخط، مع سحب وإفلات لتعديل التواريخ.
 * ميزات المسار الحرج/التبعيات/الربط بالتكلفة والتمويل/التصدير مبنية فوق
 * timelineScheduling.js (منطق نقي قابل للاختبار) — هذا الملف عرض/تفاعل فقط.
 */
import Swal from 'sweetalert2';
import { SECTIONS } from '../core/schema.js';
import { generateTableSuggestions } from '../services/AIConnector.js';
import { TimelineChart } from './TimelineChart.js';
import { toast } from '../utils/toast.js';
import {
    computeCriticalPath,
    suggestParallelTracks,
    estimateDelayRisk,
    computeLinkedCashFlow,
    checkFinancingCollision
} from '../core/timelineScheduling.js';
import { calculateDelayedLaunchImpact } from '../core/engine.js';
import { buildIcsCalendar } from '../utils/icsExport.js';
import { loadXLSX } from '../../export/utils.js';
import { escapeHtml } from '../utils/escape.js';

const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

const RESPONSIBLE_PARTY_LABELS = { owner: 'المالك', supplier: 'مورّد', government: 'جهة حكومية' };
const CATEGORY_LABELS = { legal: 'قانوني / إداري', technical: 'فني / إنشائي', hr: 'موارد بشرية', marketing: 'تسويق', launch: 'افتتاح' };

export class Timeline {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.isGenerating = false;
        this.chart = null;
    }

    render() {
        const state = this.store.get();
        const data = state[SECTIONS.TIMELINE] || { activities: [] };
        const activities = data.activities || [];
        const establishmentCosts = state[SECTIONS.TECHNICAL]?.establishmentCosts || [];

        const cpm = computeCriticalPath(activities);
        const criticalIds = cpm.ok ? new Set(Object.keys(cpm.byId).filter(id => cpm.byId[id].isCritical)) : new Set();
        const parallel = suggestParallelTracks(activities);
        const delayRisks = estimateDelayRisk(activities);
        const delayRiskById = new Map(delayRisks.map(r => [String(r.id), r]));
        const cashFlow = computeLinkedCashFlow(activities, establishmentCosts);
        const collisions = checkFinancingCollision(activities, establishmentCosts, state[SECTIONS.FINANCING]);

        this.container.innerHTML = `
            <div class="timeline-container animate-entry">
                <div class="section-header">
                    <h2 class="page-title"><svg class="ic" aria-hidden="true"><use href="#i-history"/></svg> خطة التنفيذ</h2>
                    <p class="text-muted">خطة عمل مرحلة التأسيس قبل التشغيل الفعلي. اسحب المراحل لتعديل شهر البدء.</p>
                </div>

                <div class="card glass-card timeline-chart-wrapper">
                    <div id="timelineChartRoot" class="timeline-chart-root" aria-label="خارطة الطريق المرئية للمراحل"></div>
                    ${activities.length > 0 ? `
                    <div class="timeline-phases-list mt-3 pt-3 border-t border-border">
                        <div class="text-xs text-muted mb-2">المراحل المضافة — انقر حذف لإزالة</div>
                        <div class="flex flex-wrap gap-2">
                            ${activities.sort((a,b)=>(a.startMonth||1)-(b.startMonth||1)).map(act => `
                                <span class="timeline-phase-tag ${criticalIds.has(String(act.id)) ? 'timeline-phase-tag--critical' : ''}">
                                    <span>${escapeHtml(act.name || '')} (م${act.startMonth || 1})${criticalIds.has(String(act.id)) ? ' <span class="badge badge--warning" title="على المسار الحرج">حرج</span>' : ''}</span>
                                    <button type="button" class="btn-delete-act btn-icon-sm" data-id="${act.id}" title="حذف المرحلة" aria-label="حذف">${icon('i-x')}</button>
                                </span>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>

                ${this._renderSchedulingCard(cpm, parallel, activities)}
                ${collisions.length ? this._renderCollisionAlert(collisions) : ''}
                ${Object.keys(cashFlow).length ? this._renderCashFlowCard(cashFlow) : ''}

                <div class="card analysis-card mt-4">
                    <div class="flex-between mb-3">
                        <h3 class="card-title">إضافة / تعديل مرحلة</h3>
                        <button class="btn-xs btn-magic ai-timeline-btn"><svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg> اقتراح خطة تنفيذية</button>
                    </div>
                    <div class="timeline-form">
                        <input type="text" id="newActName" placeholder="اسم المرحلة (مثلاً: التأسيس، الافتتاح، التوسع)" class="form-control">
                        <select id="newActCategory" class="form-control">
                            ${Object.entries(CATEGORY_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
                        </select>
                        <input type="number" id="newActStart" placeholder="شهر البدء" min="1" max="12" class="form-control">
                        <input type="number" id="newActDuration" placeholder="المدة (أشهر)" min="1" max="12" class="form-control">
                        <select id="newActResponsible" class="form-control" title="من المسؤول عن إنجاز هذه المرحلة؟">
                            ${Object.entries(RESPONSIBLE_PARTY_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
                        </select>
                        <select id="newActCostItem" class="form-control" title="اربط هذه المرحلة ببند تكلفة تأسيس فعلي (اختياري) لحساب التدفق النقدي الزمني">
                            <option value="">بدون ربط تكلفة</option>
                            ${establishmentCosts.filter(c => c?.name).map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('')}
                        </select>
                        ${activities.length ? `
                        <div class="timeline-depends-on">
                            <div class="text-xs text-muted mb-1">تعتمد على (اختياري):</div>
                            <div class="flex flex-wrap gap-3">
                                ${activities.map((a, i) => `
                                    <div class="form-group flex items-center gap-2">
                                        <input type="checkbox" id="actDep${i}" class="checkbox newActDependsOn" value="${a.id}">
                                        <label for="actDep${i}" class="text-sm cursor-pointer">${escapeHtml(a.name || '')}</label>
                                    </div>
                                `).join('')}
                            </div>
                        </div>` : ''}
                        <button id="btnAddActivity" class="btn btn--primary">إضافة للمخطط</button>
                    </div>
                </div>

                <div class="card analysis-card mt-4">
                    <div class="flex-between mb-3">
                        <h3 class="card-title">أثر تأخير الافتتاح على NPV</h3>
                    </div>
                    <div class="timeline-form">
                        <input type="number" id="delayMonthsInput" placeholder="عدد أشهر التأخير" min="0" max="24" class="form-control">
                        <button id="btnCalcDelayImpact" class="btn btn--secondary">احسب الأثر</button>
                    </div>
                    <div id="delayImpactResult" class="mt-2 text-muted" style="font-size:.9em"></div>
                </div>

                <div class="card analysis-card mt-4">
                    <div class="flex-between mb-3">
                        <h3 class="card-title">تصدير الخطة</h3>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button id="btnExportCsv" class="btn btn--sm btn--secondary">تصدير Excel/CSV (متوافق مع Google Sheets)</button>
                        <button id="btnExportIcs" class="btn btn--sm btn--secondary">تصدير كأحداث تقويم (.ics)</button>
                    </div>
                </div>
                <!-- شريط التنقّل يضيفه app.js عبر wizard.appendNav() بعد الرسم. -->
            </div>
        `;

        this.chart = new TimelineChart('timelineChartRoot', {
            onActivityMove: (activityId, newStartMonth) => {
                const state = this.store.get();
                const activities = [...(state[SECTIONS.TIMELINE].activities || [])];
                const idx = activities.findIndex(a => String(a.id) === String(activityId));
                if (idx >= 0) {
                    activities[idx] = { ...activities[idx], startMonth: newStartMonth };
                    activities.sort((a, b) => (a.startMonth || 1) - (b.startMonth || 1));
                    this.store.updatePath(SECTIONS.TIMELINE, 'activities', activities);
                    this.chart.render(activities, criticalIds);
                }
            }
        });
        this.chart.render(activities, criticalIds);

        this.bindEvents();
    }

    _renderSchedulingCard(cpm, parallel, activities) {
        if (!activities.length) return '';
        if (!cpm.ok) {
            const msg = cpm.reason === 'cycle'
                ? 'تعذّر حساب المسار الحرج: هناك تبعيات دائرية بين مراحل (مرحلة تعتمد على أخرى تعتمد عليها بدورها) — راجع خيارات «تعتمد على» عند كل مرحلة.'
                : '';
            return msg ? `<div class="card analysis-card mt-4"><div class="alert alert--warning">${msg}</div></div>` : '';
        }
        const byId = cpm.byId;
        const parallelHtml = parallel.ok && parallel.groups.some(g => g.length > 1)
            ? `<div class="mt-2"><div class="text-xs text-muted mb-1">مسارات يمكن تنفيذها بالتوازي (اقتراح استرشادي لا حل أمثل):</div>
                ${parallel.groups.filter(g => g.length > 1).map(g => `
                    <div class="text-sm">• ${g.map(id => escapeHtml(activities.find(a => String(a.id) === id)?.name || id)).join(' + ')}</div>
                `).join('')}
              </div>`
            : '';
        return `
            <div class="card analysis-card mt-4">
                <h3 class="card-title mb-2">المسار الحرج والجدولة</h3>
                <div class="text-sm">إجمالي المدة النظرية الدنيا (حسب المدد والتبعيات المُدخلة): <strong>${byId ? cpm.totalDuration : 0} شهر</strong></div>
                <div class="text-xs text-muted mt-1">المراحل الموسومة «حرج» أعلاه هي التي لا تحتمل أي تأخير دون تأخير المشروع كاملاً.</div>
                ${parallelHtml}
            </div>
        `;
    }

    _renderCollisionAlert(collisions) {
        const first = collisions[0];
        return `
            <div class="card analysis-card mt-4">
                <div class="alert alert--warning">
                    تنبيه سيولة: التكلفة التراكمية للمراحل المرتبطة ببنود تأسيس تتجاوز رأس المال المُدخل (حقوق ملكية + قرض) بحلول الشهر ${first.month}
                    — نقص تقديري ${Math.round(first.shortfall).toLocaleString('ar-SA')} ريال. راجع توقيت هذه المراحل أو مصادر التمويل.
                </div>
            </div>
        `;
    }

    _renderCashFlowCard(cashFlow) {
        const months = Object.keys(cashFlow).map(Number).sort((a, b) => a - b);
        return `
            <div class="card analysis-card mt-4">
                <h3 class="card-title mb-2">التدفق النقدي الزمني للمراحل المرتبطة ببنود تأسيس</h3>
                <div class="flex flex-wrap gap-3">
                    ${months.map(m => `<div class="text-sm">شهر ${m}: <strong>${Math.round(cashFlow[m]).toLocaleString('ar-SA')} ريال</strong></div>`).join('')}
                </div>
            </div>
        `;
    }

    bindEvents() {
        const btnAdd = document.getElementById('btnAddActivity');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const name = document.getElementById('newActName').value;
                const category = document.getElementById('newActCategory').value;
                const startMonth = parseInt(document.getElementById('newActStart').value);
                const duration = parseInt(document.getElementById('newActDuration').value);
                const responsibleParty = document.getElementById('newActResponsible')?.value || 'owner';
                const costItemName = document.getElementById('newActCostItem')?.value || '';
                const dependsOn = [...this.container.querySelectorAll('.newActDependsOn:checked')].map(el => el.value);

                if (!name || isNaN(startMonth) || isNaN(duration)) {
                    alert('يرجى إكمال جميع الحقول بشكل صحيح');
                    return;
                }

                const act = { name, category, startMonth, duration, responsibleParty };
                if (costItemName) act.costItemName = costItemName;
                if (dependsOn.length) act.dependsOn = dependsOn;
                this.addActivity(act);
            });
        }

        this.container.querySelectorAll('.btn-delete-act').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.deleteActivity(id);
            });
        });

        const delayBtn = document.getElementById('btnCalcDelayImpact');
        if (delayBtn) {
            delayBtn.addEventListener('click', () => {
                const months = Number(document.getElementById('delayMonthsInput')?.value || 0);
                const resultEl = document.getElementById('delayImpactResult');
                if (!resultEl) return;
                try {
                    const impact = calculateDelayedLaunchImpact(this.store.get(), months);
                    const fmt = (n) => Math.round(n).toLocaleString('ar-SA');
                    resultEl.textContent = impact.npvImpact === 0
                        ? 'لا أثر (تأخير صفر أو لا فرق محسوب).'
                        : `تأخير ${impact.delayMonths} شهر يُقدَّر أن يُنقص صافي القيمة الحالية (NPV) من ${fmt(impact.baselineNpv)} إلى ${fmt(impact.delayedNpv)} ريال (أثر ${fmt(impact.npvImpact)} ريال).`;
                } catch (e) {
                    resultEl.textContent = 'تعذّر حساب الأثر — تأكد من اكتمال الافتراضات المالية أولاً.';
                }
            });
        }

        const csvBtn = document.getElementById('btnExportCsv');
        if (csvBtn) csvBtn.addEventListener('click', () => this._exportCsv());

        const icsBtn = document.getElementById('btnExportIcs');
        if (icsBtn) icsBtn.addEventListener('click', () => this._exportIcs());

        // AI Timeline Handler
        this.container.querySelectorAll('.ai-timeline-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (this.isGenerating) return;

                const state = this.store.get();
                if (state[SECTIONS.TIMELINE]?.activities?.length > 0) {
                    const result = await Swal.fire({
                        title: 'هل أنت متأكد؟',
                        text: 'سيتم استبدال الخطة الحالية بخطة مقترحة جديدة.',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'نعم، استبدل',
                        cancelButtonText: 'إلغاء',
                        customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
                        buttonsStyling: false
                    });
                    if (!result.isConfirmed) return;
                }

                e.target.disabled = true;
                e.target.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-reset"/></svg> جاري التخطيط...';
                this.isGenerating = true;

                const projectInfo = state.projectInfo || {};

                try {
                    const rawResult = await generateTableSuggestions('timeline', projectInfo);
                    const activities = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;

                    if (Array.isArray(activities)) {
                        // Assign IDs أولاً، ثم ترجمة dependsOnIndex (فهرس نسبي من generateTimeline) لمعرّفات فعلية.
                        const enriched = activities.map((a, i) => ({ ...a, id: Date.now() + i }));
                        enriched.forEach((a, i) => {
                            const idxDeps = activities[i]?.dependsOnIndex;
                            if (Array.isArray(idxDeps) && idxDeps.length) {
                                a.dependsOn = idxDeps.map(idx => enriched[idx]?.id).filter(Boolean);
                            }
                            delete a.dependsOnIndex;
                        });
                        this.store.updatePath(SECTIONS.TIMELINE, 'activities', enriched);
                        this.render();
                    }
                } catch (err) {
                    console.error("AI Timeline Error", err);
                }

                e.target.disabled = false;
                e.target.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg> اقتراح خطة تنفيذية';
                this.isGenerating = false;
            });
        });
    }

    async _exportCsv() {
        const state = this.store.get();
        const activities = state[SECTIONS.TIMELINE]?.activities || [];
        if (!activities.length) { toast.info('أضف مرحلة واحدة على الأقل قبل التصدير.'); return; }
        try {
            await loadXLSX();
            const rows = activities.map(a => ({
                'اسم المرحلة': a.name || '',
                'التصنيف': CATEGORY_LABELS[a.category] || a.category || '',
                'شهر البدء': a.startMonth || '',
                'المدة (أشهر)': a.duration || '',
                'المسؤول': RESPONSIBLE_PARTY_LABELS[a.responsibleParty] || '',
                'تعتمد على': (a.dependsOn || []).map(id => activities.find(x => String(x.id) === String(id))?.name).filter(Boolean).join('، ')
            }));
            const ws = window.XLSX.utils.json_to_sheet(rows);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, 'خطة التنفيذ');
            window.XLSX.writeFile(wb, 'خطة-التنفيذ.xlsx');
        } catch (e) {
            toast.warning('تعذّر تصدير الملف — ' + (e?.message || ''));
        }
    }

    _exportIcs() {
        const state = this.store.get();
        const activities = state[SECTIONS.TIMELINE]?.activities || [];
        const projectStart = state.projectInfo?.timeline?.projectStart;
        if (!activities.length) { toast.info('أضف مرحلة واحدة على الأقل قبل التصدير.'); return; }
        if (!projectStart) { toast.warning('حدّد تاريخ بدء المشروع في «معلومات المشروع» أولاً لتصدير تواريخ فعلية.'); return; }

        const ics = buildIcsCalendar(activities, projectStart);
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'خطة-التنفيذ.ics';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    addActivity(act) {
        const state = this.store.get();
        const activities = [...(state[SECTIONS.TIMELINE].activities || [])];

        activities.push({
            id: Date.now(),
            ...act
        });

        // Sort by startMonth
        activities.sort((a, b) => a.startMonth - b.startMonth);

        this.store.updatePath(SECTIONS.TIMELINE, 'activities', activities);
        this.render();
    }

    deleteActivity(id) {
        const state = this.store.get();
        const activities = state[SECTIONS.TIMELINE].activities
            .filter(a => a.id !== id)
            .map(a => Array.isArray(a.dependsOn) ? { ...a, dependsOn: a.dependsOn.filter(d => String(d) !== String(id)) } : a);
        this.store.updatePath(SECTIONS.TIMELINE, 'activities', activities);
        this.render();
    }
}
