/**
 * Timeline Component — خارطة الطريق المرئية (Visual Roadmap)
 * خط زمني أفقي أنيق: مراحل كدوائر متصلة بخط، مع سحب وإفلات لتعديل التواريخ.
 */
import { SECTIONS } from '../core/schema.js';
import { generateTableSuggestions } from '../services/AIConnector.js';
import { TimelineChart } from './TimelineChart.js';

function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

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

        this.container.innerHTML = `
            <div class="timeline-container animate-entry">
                <div class="section-header">
                    <h2 class="text-xl font-bold"><svg class="ic" aria-hidden="true"><use href="#i-history"/></svg> الجدول الزمني للتنفيذ</h2>
                    <p class="text-muted">خطة عمل مرحلة التأسيس قبل التشغيل الفعلي. اسحب المراحل لتعديل شهر البدء.</p>
                </div>

                <div class="card glass-card timeline-chart-wrapper">
                    <div id="timelineChartRoot" class="timeline-chart-root" aria-label="خارطة الطريق المرئية للمراحل"></div>
                    ${activities.length > 0 ? `
                    <div class="timeline-phases-list mt-3 pt-3 border-t border-border">
                        <div class="text-xs text-muted mb-2">المراحل المضافة — انقر حذف لإزالة</div>
                        <div class="flex flex-wrap gap-2">
                            ${activities.sort((a,b)=>(a.startMonth||1)-(b.startMonth||1)).map(act => `
                                <span class="timeline-phase-tag">
                                    <span>${escapeHtml(act.name || '')} (م${act.startMonth || 1})</span>
                                    <button type="button" class="btn-delete-act btn-icon-sm" data-id="${act.id}" title="حذف المرحلة" aria-label="حذف">×</button>
                                </span>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>

                <div class="card analysis-card mt-4">
                    <div class="flex-between mb-3">
                        <h3 class="card-title">إضافة / تعديل مرحلة</h3>
                        <button class="btn-xs btn-magic ai-timeline-btn"><svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg> اقتراح خطة تنفيذية</button>
                    </div>
                    <div class="timeline-form">
                        <input type="text" id="newActName" placeholder="اسم المرحلة (مثلاً: التأسيس، الافتتاح، التوسع)" class="form-control">
                        <select id="newActCategory" class="form-control">
                            <option value="legal">قانوني / إداري</option>
                            <option value="technical">فني / إنشائي</option>
                            <option value="hr">موارد بشرية</option>
                            <option value="marketing">تسويق</option>
                            <option value="launch">افتتاح</option>
                        </select>
                        <input type="number" id="newActStart" placeholder="شهر البدء" min="1" max="12" class="form-control">
                        <input type="number" id="newActDuration" placeholder="المدة (أشهر)" min="1" max="12" class="form-control">
                        <button id="btnAddActivity" class="btn btn--primary">إضافة للمخطط</button>
                    </div>
                </div>
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
                    this.chart.render(activities);
                }
            }
        });
        this.chart.render(activities);

        this.bindEvents();
    }

    bindEvents() {
        const btnAdd = document.getElementById('btnAddActivity');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const name = document.getElementById('newActName').value;
                const category = document.getElementById('newActCategory').value;
                const startMonth = parseInt(document.getElementById('newActStart').value);
                const duration = parseInt(document.getElementById('newActDuration').value);

                if (!name || isNaN(startMonth) || isNaN(duration)) {
                    alert('يرجى إكمال جميع الحقول بشكل صحيح');
                    return;
                }

                this.addActivity({ name, category, startMonth, duration });
            });
        }

        this.container.querySelectorAll('.btn-delete-act').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.deleteActivity(id);
            });
        });

        // AI Timeline Handler
        this.container.querySelectorAll('.ai-timeline-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (this.isGenerating) return;

                const confirmMsg = "هل أنت متأكد؟ سيتم استبدال الخطة الحالية بخطة مقترحة جديدة.";
                const state = this.store.get();
                if (state[SECTIONS.TIMELINE]?.activities?.length > 0 && !confirm(confirmMsg)) {
                    return;
                }

                e.target.disabled = true;
                e.target.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-reset"/></svg> جاري التخطيط...';
                this.isGenerating = true;

                const projectInfo = state.projectInfo || {};

                try {
                    const rawResult = await generateTableSuggestions('timeline', projectInfo);
                    const activities = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;

                    if (Array.isArray(activities)) {
                        // Assign IDs
                        const enriched = activities.map((a, i) => ({ ...a, id: Date.now() + i }));
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
        const activities = state[SECTIONS.TIMELINE].activities.filter(a => a.id !== id);
        this.store.updatePath(SECTIONS.TIMELINE, 'activities', activities);
        this.render();
    }
}
