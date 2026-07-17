/**
 * لوحة تنفيذ المهام (Kanban) — عرض للقراءة فقط (بدون سحب وإفلات) لأنشطة
 * state.timeline.activities الحقيقية + إنجازها الفعلي (state.actuals.timelineCompletions).
 * محرر الأنشطة الحقيقي هو Timeline.js — هذه الشاشة عرض مكمّل، لا محرر منافس.
 * لا يوجد مفهوم "تاريخ إطلاق فعلي" في المخطط، فالحالة (قيد الانتظار/قيد التنفيذ/مكتمل)
 * تُشتقّ من مؤشر "أي شهر نحن فيه؟" محلي (غير محفوظ) يضبطه المستخدم يدوياً بدل اختلاق
 * ساعة حية لا وجود لها في التطبيق.
 */
import { computeCriticalPath } from '../core/timelineScheduling.js';
import { escapeHtml } from '../utils/escape.js';

const CATEGORY_LABELS = { legal: 'قانوني / إداري', technical: 'فني / إنشائي', hr: 'موارد بشرية', marketing: 'تسويق', launch: 'افتتاح' };

export class ExecutionKanbanView {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.currentMonth = 1;
    }

    async render() {
        if (!this.container) return;

        const state = this.store.get();
        const activities = state?.timeline?.activities || [];
        const completions = state?.actuals?.timelineCompletions || {};

        this.container.innerHTML = `
            <div class="execution-kanban-view" style="max-width:960px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnKanbanBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>
                <h2 class="section-title"><svg class="ic" aria-hidden="true"><use href="#i-calendar"/></svg> لوحة تنفيذ المهام</h2>
                <p class="text-muted mb-4">حالة أنشطة خطتك الزمنية على شكل أعمدة.</p>
                <div id="kanbanBody"></div>
            </div>
        `;
        this.container.querySelector('#btnKanbanBack')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        const body = this.container.querySelector('#kanbanBody');

        if (activities.length === 0) {
            body.innerHTML = `
                <div class="alert alert--info">
                    <p>أضف مراحل في خطة التنفيذ لعرض لوحة التنفيذ.</p>
                </div>`;
            return this.container;
        }

        // مؤشر ابتدائي معقول: آخر شهر مسجَّل فيه إنجاز فعلي، وإلا الشهر 1
        const completedMonths = Object.values(completions).map(Number).filter(Number.isFinite);
        this.currentMonth = completedMonths.length ? Math.max(...completedMonths) : 1;

        const cpm = computeCriticalPath(activities);
        const cycleWarning = cpm.ok === false && cpm.reason === 'cycle'
            ? '<div class="alert alert--warning mb-3"><p>توجد تبعيات دائرية بين بعض الأنشطة، راجع خطة التنفيذ — شارة "المسار الحرج" معطّلة مؤقتاً.</p></div>'
            : '';
        const criticalIds = cpm.ok ? new Set(Object.keys(cpm.byId).filter(id => cpm.byId[id].isCritical)) : new Set();

        body.innerHTML = `
            ${cycleWarning}
            <div class="flex-between mb-3" style="align-items:center;gap:12px;flex-wrap:wrap;">
                <label class="text-sm" style="display:flex;align-items:center;gap:8px;">
                    أي شهر نحن فيه الآن؟
                    <input type="number" id="kanbanMonthMarker" min="0" value="${this.currentMonth}" class="form-control" style="width:80px;">
                </label>
                <span class="text-xs text-muted">يحدّد هذا المؤشر فقط عرض هذه اللوحة، ولا يُحفظ في دراستك.</span>
            </div>
            <div id="kanbanColumns"></div>
        `;

        body.querySelector('#kanbanMonthMarker')?.addEventListener('input', (e) => {
            const v = parseInt(e.target.value, 10);
            this.currentMonth = Number.isFinite(v) ? v : 0;
            this.renderColumns(activities, completions, criticalIds);
        });

        this.renderColumns(activities, completions, criticalIds);
        return this.container;
    }

    renderColumns(activities, completions, criticalIds) {
        const columnsEl = this.container.querySelector('#kanbanColumns');
        if (!columnsEl) return;

        const columns = { todo: [], inProgress: [], done: [] };
        activities.forEach(a => {
            if (completions[a.id] != null) columns.done.push(a);
            else if ((Number(a.startMonth) || 0) <= this.currentMonth) columns.inProgress.push(a);
            else columns.todo.push(a);
        });

        const card = (a) => `
            <div class="card" style="padding:12px;margin-bottom:8px;">
                <div class="text-sm font-bold mb-1">${escapeHtml(a.name || 'نشاط بلا اسم')}${criticalIds.has(String(a.id)) ? ' <span class="badge badge--warning" style="font-size:.65rem;">مسار حرج</span>' : ''}</div>
                <div class="text-xs text-muted">${CATEGORY_LABELS[a.category] || a.category || ''} · شهر ${a.startMonth ?? '—'} لمدة ${a.duration ?? '—'} ${Number(a.duration) === 1 ? 'شهر' : 'أشهر'}</div>
            </div>`;

        const column = (title, items) => `
            <div class="card" style="padding:12px;">
                <h3 class="card-title" style="font-size:.9rem;margin-bottom:8px;">${title} <span class="text-xs text-muted">(${items.length})</span></h3>
                ${items.length ? items.map(card).join('') : '<p class="text-xs text-muted">لا أنشطة</p>'}
            </div>`;

        columnsEl.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
                ${column('قيد الانتظار', columns.todo)}
                ${column('قيد التنفيذ', columns.inProgress)}
                ${column('مكتمل', columns.done)}
            </div>`;
    }
}
