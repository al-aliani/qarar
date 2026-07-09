import { toast } from '../utils/toast.js';
import { calculateStudyCompleteness } from '../utils/studyCompleteness.js';
import { calculateIdeaScore } from '../core/calculateIdeaScore.js';
import { SIDEBAR_SECTIONS } from '../core/wizardSteps.js';
import { SimpleModeController } from '../controllers/SimpleModeController.js';

export class Sidebar {
    constructor(containerId, steps, onStepClick, store = null) {
        this.container = document.getElementById(containerId);
        this.steps = steps;
        this.onStepClick = onStepClick;
        this.activeStep = 0;
        this.progressTracker = null;
        this.store = store;
        this.modeController = new SimpleModeController(store);

        this.sections = SIDEBAR_SECTIONS;

        // Accordion: افتح قسماً واحداً افتراضياً — قسم «الدراسات» مطويّ افتراضياً (نقرة واحدة تفتحه)
        const first = (this.sections && this.sections[0] && this.sections[0].id) ? this.sections[0].id : null;
        this.expandedSections = new Set();
        if (first) this.expandedSections.add(first);

        // ربط التنقل بالتفويض مرة واحدة — يبقى شغالاً مهما أُعيد بناء المحتوى
        this._bindDelegatedNavClicks();
    }

    /**
     * تفويض الأحداث (Event Delegation) على الحاوية بدل ربط كل عنصر على حدة —
     * إعادة الرسم عبر innerHTML (تحدث بعد كل تغيير في الـ store) كانت تُسقط
     * المستمعين أثناء نقرة المستخدم فيتعطل التنقل بين الخطوات.
     * يُربط مرة واحدة فقط على الحاوية نفسها فلا يتأثر بإعادة الرسم.
     */
    _bindDelegatedNavClicks() {
        if (!this.container || this._navClicksBound) return;
        this._navClicksBound = true;

        this.container.addEventListener('click', (e) => {
            // 1) نقرة على خطوة تنقّل (عناصر قسم الدراسات لا تحمل data-index فتُستبعد تلقائياً)
            const stepEl = e.target.closest('.step-item');
            if (stepEl && this.container.contains(stepEl) && stepEl.dataset.index !== undefined) {
                e.stopPropagation(); // Prevent parent header click
                const globalIdx = parseInt(stepEl.dataset.index, 10);
                if (Number.isNaN(globalIdx)) return;
                const localIdx = parseInt(stepEl.dataset.localIdx, 10);
                // تمرير كائن الخطوة لضمان صحة التنقل عند تصفية الخطوات (الأوضاع المبسطة)
                const step = Array.isArray(this.steps) && localIdx >= 0 ? this.steps[localIdx] : null;
                this.setActive(globalIdx);
                if (typeof this.onStepClick === 'function') this.onStepClick(step || globalIdx);
                return;
            }

            // 2) نقرة على رأس قسم (Accordion)
            const header = e.target.closest('.nav-section-header');
            if (header && this.container.contains(header)) {
                const sectionId = header.dataset.sectionId;
                if (!sectionId) return;
                // قسم «الدراسات» مطويّ افتراضياً: يُفتح ويُطوى بنقرة دون المساس بالأقسام الرئيسية
                if (sectionId === 'studies') {
                    if (this.expandedSections.has('studies')) this.expandedSections.delete('studies');
                    else this.expandedSections.add('studies');
                    this.render();
                    return;
                }
                const keepStudies = this.expandedSections.has('studies');
                // Keep one main section expanded at a time
                this.expandedSections = new Set();
                if (keepStudies) this.expandedSections.add('studies');
                this.expandedSections.add(sectionId);
                this.render();
            }
        });
    }

    getStepIcon(index) {
        // تنظيف الأيقونات — لا إيموجي في شجرة التنقل:
        // الخانة الفارغة تُرسم نقطةً محايدة عبر CSS ‏(.step-icon:empty::before)،
        // وعلامة ✓ للخطوات المكتملة يمررها المستدعي كنص عادي.
        return '';
    }

    getCompletenessMessage(percentage) {
        if (percentage >= 90) return 'دراسة شبه مكتملة';
        if (percentage >= 70) return 'دراسة جيدة';
        if (percentage >= 50) return 'دراسة متوسطة';
        if (percentage >= 30) return 'دراسة أولية';
        return 'دراسة في بدايتها';
    }

    /** Format lastModified for display (ar-SA short date) */
    _formatStudyDate(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return iso;
        }
    }

    /**
     * Render studies list inside listEl. Expects listEl._list, listEl._sortBy. Binds open + delete + sort.
     */
    _renderStudiesList(listEl) {
        const list = listEl._list || [];
        const sortBy = listEl._sortBy || 'date';
        const sorted = [...list].sort((a, b) => {
            if (sortBy === 'name') {
                return (a.name || '').localeCompare(b.name || '', 'ar');
            }
            const ta = new Date(a.lastModified || 0).getTime();
            const tb = new Date(b.lastModified || 0).getTime();
            return tb - ta;
        });

        if (sorted.length === 0) {
            listEl.innerHTML = '<div class="text-xs text-muted p-2">لا توجد دراسات محفوظة</div>';
            return;
        }

        listEl.innerHTML = `
            <div class="studies-list-sort mb-2 px-1 flex gap-1">
                <span class="text-xs text-muted">ترتيب:</span>
                <button type="button" class="studies-sort-btn text-xs px-2 py-0.5 rounded ${sortBy === 'date' ? 'active' : ''}" data-sort="date">التاريخ</button>
                <button type="button" class="studies-sort-btn text-xs px-2 py-0.5 rounded ${sortBy === 'name' ? 'active' : ''}" data-sort="name">الاسم</button>
            </div>
            <div class="studies-list-items">
                ${sorted.map(p => `
                    <div class="step-item studies-load-item flex items-center gap-1 justify-between" data-id="${p.id}" data-name="${(p.name || '').replace(/"/g, '&quot;')}" role="button" tabindex="0" style="padding: 6px 8px; font-size: 12px; border-radius: 4px; margin-bottom: 2px;">
                        <div class="flex-1 min-w-0 flex items-center gap-1" data-action="open">
                            <span class="step-icon"><svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg></span>
                            <span class="step-label truncate">${(p.name || 'بدون اسم').substring(0, 24)}</span>
                            <span class="text-muted text-[10px]">${this._formatStudyDate(p.lastModified)}</span>
                        </div>
                        <button type="button" class="studies-delete-btn p-0.5 rounded opacity-70 hover:opacity-100" data-id="${p.id}" title="حذف الدراسة" aria-label="حذف"><svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg></button>
                    </div>
                `).join('')}
            </div>
        `;

        listEl.querySelectorAll('.studies-sort-btn').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                listEl._sortBy = btn.dataset.sort;
                this._renderStudiesList(listEl);
            });
        });

        listEl.querySelectorAll('.studies-load-item').forEach(item => {
            const openPart = item.querySelector('[data-action="open"]');
            openPart?.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const id = item.dataset.id;
                window.dispatchEvent(new CustomEvent('feasibility:openStudy', { detail: { id } }));
                listEl.style.display = 'none';
            });
        });

        listEl.querySelectorAll('.studies-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                const id = btn.dataset.id;
                const item = btn.closest('.studies-load-item');
                const name = (item?.dataset.name || 'هذه الدراسة').replace(/&quot;/g, '"');
                if (!confirm(`حذف الدراسة «${name}»؟ لا يمكن التراجع.`)) return;
                try {
                    const { ProjectManager } = await import('../services/ProjectManager.js');
                    await ProjectManager.deleteProject(id);
                    listEl._list = listEl._list.filter(p => p.id !== id);
                    this._renderStudiesList(listEl);
                    toast.success('تم حذف الدراسة');
                } catch (err) {
                    toast.error('فشل حذف الدراسة');
                }
            });
        });
    }

    setProgressTracker(tracker) {
        this.progressTracker = tracker;
        // this.render(); // Avoid double render, allow specific update
        this.render();

        // Subscribe to store changes to update completeness
        if (this.store && this.store.subscribe) {
            this.store.subscribe(() => {
                // Debounce updates to avoid too many re-renders
                if (this._completenessUpdateTimeout) {
                    clearTimeout(this._completenessUpdateTimeout);
                }
                this._completenessUpdateTimeout = setTimeout(() => {
                    this.render();
                }, 500);
            });
        }
    }

    setActive(index) {
        this.activeStep = index;

        // Ensure the section containing the active step is expanded
        const section = this.sections.find(s => index >= s.range[0] && index <= s.range[1]);
        if (section) {
            // Accordion behavior: keep only one main section expanded (plus studies)
            const keepStudies = this.expandedSections.has('studies');
            this.expandedSections = new Set();
            if (keepStudies) this.expandedSections.add('studies');
            this.expandedSections.add(section.id);
        }

        // Update progress tracker
        if (this.progressTracker) {
            this.progressTracker.setCurrentStep(index);
        }

        // Re-render to update visual state
        this.render();
    }

    async render() {
        console.log('[Sidebar] render() called');

        if (this.modeController) {
            this.modeController.store = this.store || (await import('../core/store.js')).store;
            this.modeController.applyModeToBody();
        }

        if (!this.container) {
            console.warn('[Sidebar] Container #stepperNav not found');
            return;
        }

        // Ensure container is visible
        if (this.container.style.display === 'none') {
            this.container.style.display = '';
        }

        // Ensure parent sidebar is visible on desktop
        const sidebarEl = this.container.closest('.sidebar');
        if (sidebarEl && window.innerWidth > 768) {
            if (sidebarEl.style.display === 'none') {
                sidebarEl.style.display = 'flex';
            }
        }

        // Render progress widget if tracker exists
        const progressHTML = this.progressTracker ? this.progressTracker.renderCompact() : '';

        // نتيجة الفكرة (Idea Score) — عداد سرعة ملون في أعلى الـ Sidebar
        //
        // تدقيق 2026-07-09 (علة #2): render() يُستدعى مئات المرات في جلسة إدخال
        // واحدة (اشتراك store.subscribe عبر الرحلة الكاملة ذات الـ44 خطوة، بالإضافة
        // لاستدعاءات مباشرة كنقر الأقسام القابلة للطي التي تتخطى مؤقت 500ms). وبلا
        // results جاهزة، calculateIdeaScore يُشغّل calculateStudy() الكاملة داخلياً —
        // أي إعادة تشغيل المحرك المالي بأكمله على كل ضغطة مفتاح تقريباً (نفس فئة
        // العلة الموثّقة أعلى LivePanel.js، لكن دون المساس بمعمارية الاشتراك هنا:
        // فقط سقف تكرار زمني بسيط — لا حذف للحساب، فقط تحديد وتيرته الأقصى).
        // نعيد استخدام آخر نتيجة محسوبة إن مرّ أقل من 400ms منذ آخر حساب فعلي.
        let ideaScoreHTML = '';
        try {
            const storeInstance = this.store;
            const state = storeInstance?.getState?.() ?? storeInstance?.get?.() ?? {};
            const now = Date.now();
            let idea;
            if (this._ideaCache && this._ideaCacheAt && (now - this._ideaCacheAt) < 400) {
                idea = this._ideaCache;
            } else {
                idea = calculateIdeaScore(state);
                this._ideaCache = idea;
                this._ideaCacheAt = now;
            }
            const score = Math.min(100, Math.max(0, idea.score));
            const colorClass = idea.color === 'green' ? 'idea-score--green' : idea.color === 'yellow' ? 'idea-score--yellow' : 'idea-score--red';
            // صف رفيع داخل بطاقة الحالة المدمجة (.sidebar-status) — التفاصيل تبقى في title/aria
            ideaScoreHTML = `
                <div class="status-row status-row--score ${colorClass}" role="status" aria-label="نتيجة الفكرة ${score} من 100: ${idea.message}" title="${idea.message}">
                    <span class="status-label">نتيجة الفكرة</span>
                    <span class="status-track" aria-hidden="true"><span class="status-fill" style="width:${score}%"></span></span>
                    <span class="status-value">${score}</span>
                </div>`;
        } catch (e) {
            console.warn('Idea Score calculation failed:', e);
        }

        // Calculate and render completeness percentage
        let completenessHTML = '';
        try {
            console.log('[Sidebar] calculating completeness...');
            // Use passed store or import default
            const storeInstance = this.store || (await import('../core/store.js')).store;
            // const { calculateStudyCompleteness } = await import('../utils/studyCompleteness.js'); // Moved to static import
            console.log('[Sidebar] store loaded');
            const state = storeInstance?.getState();
            if (state) {
                const completeness = calculateStudyCompleteness(state);

                const percentage = completeness.percentage;
                const colorClass = percentage >= 80 ? 'text-success' : percentage >= 50 ? 'text-warning' : 'text-danger';

                // صف رفيع + رابط التفاصيل — قوائم النواقص والنصائح كاملة في نافذة showCompletenessDetails
                completenessHTML = `
                    <div class="status-row" role="status" aria-label="نسبة الاكتمال ${percentage}% — ${this.getCompletenessMessage(percentage)}" title="${this.getCompletenessMessage(percentage)}">
                        <span class="status-label">الاكتمال</span>
                        <span class="status-track" aria-hidden="true"><span class="status-fill" style="width:${percentage}%"></span></span>
                        <span class="status-value ${colorClass}">${percentage}%</span>
                    </div>
                    <button type="button" class="btn-completeness-details status-details-link">ما الذي ينقص الدراسة؟</button>`;
            }
        } catch (e) {
            console.warn('Could not calculate completeness:', e);
        }

        console.log('[Sidebar] building HTML...');

        // تجميع المحتوى: نتيجة الفكرة أولاً ثم الوضع ثم الاكتمال ثم التقدم ثم الدراسات ثم الأقسام
        const state = (this.store?.getState && this.store.getState()) || (this.store?.get && this.store.get()) || {};
        const mode = state.appSettings?.mode || 'advanced';
        // مبدّل النمط: شريط مقسّم حبّي رفيع — المظهر كله من CSS (.btn-mode-sidebar.active)
        const modeToggleHTML = `
            <div class="mode-toggle-widget" role="group" aria-label="نمط الدراسة">
                <button class="btn-mode-sidebar ${mode === 'quick' ? 'active' : ''}" data-mode="quick" title="إخفاء التفاصيل المعقدة (للمبتدئين)" aria-pressed="${mode === 'quick'}">الأساسي</button>
                <button class="btn-mode-sidebar ${mode === 'advanced' ? 'active' : ''}" data-mode="advanced" title="عرض كافة التحليلات (للمستشارين)" aria-pressed="${mode === 'advanced'}">المتقدم</button>
            </div>`;

        // قسم الدراسات (قبل البداية والتعريف): دراسة جديدة + الدراسات المحفوظة
        const studiesSectionHTML = `
            <div class="nav-section studies-section ${this.expandedSections.has('studies') ? 'is-expanded' : ''}">
                <div class="nav-section-header" data-section-id="studies">
                    <span class="nav-section-title">الدراسات</span>
                    <span class="nav-section-arrow">${this.expandedSections.has('studies') ? '▾' : '▸'}</span>
                </div>
                <div class="nav-section-items" style="${this.expandedSections.has('studies') ? '' : 'display: none'}">
                    <div class="step-item studies-action" data-action="new" role="button" tabindex="0">
                        <span class="step-icon"><svg class="ic" aria-hidden="true"><use href="#i-plus"/></svg></span>
                        <span class="step-label">دراسة جديدة</span>
                    </div>
                    <div class="step-item studies-action" data-action="open-list" role="button" tabindex="0">
                        <span class="step-icon"><svg class="ic" aria-hidden="true"><use href="#i-folder"/></svg></span>
                        <span class="step-label">الدراسات المحفوظة</span>
                    </div>
                    <div class="step-item studies-action" data-action="integrations" role="button" tabindex="0">
                        <span class="step-icon"><svg class="ic" aria-hidden="true"><use href="#i-link"/></svg></span>
                        <span class="step-label">التكاملات</span>
                    </div>
                    <div class="step-item studies-action" data-action="trash" role="button" tabindex="0">
                        <span class="step-icon"><svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg></span>
                        <span class="step-label">سلة المحذوفات</span>
                    </div>
                    <div id="studiesListContainer" class="studies-list-container" style="display:none;"></div>
                </div>
            </div>
        `;

        const renderedSections = this.sections.map(section => {
            const isExpanded = this.expandedSections.has(section.id);
            const sectionSteps = this.steps.slice(section.range[0], section.range[1] + 1);
            const containsActive = this.activeStep >= section.range[0] && this.activeStep <= section.range[1];

            const visibleStepsHTML = sectionSteps.map((step, sIdx) => {
                const localIdx = section.range[0] + sIdx;

                // Check Visibility
                if (this.modeController && !this.modeController.isStepVisible(step.id)) {
                    return '';
                }

                const globalIdx = (this.stepIndexMap && this.stepIndexMap[localIdx] >= 0)
                    ? this.stepIndexMap[localIdx] : localIdx;
                const isActive = globalIdx === this.activeStep;
                const isComplete = this.progressTracker?.isCompleted(globalIdx) || false;
                return `
                        <div class="step-item ${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''}" data-index="${globalIdx}" data-local-idx="${localIdx}">
                            <span class="step-icon" aria-hidden="true">${isComplete && !isActive ? '✓' : this.getStepIcon(globalIdx)}</span>
                            <div class="step-label">${step.label}</div>
                        </div>
                    `;
            }).join('');

            // Hide section if empty
            if (!visibleStepsHTML.trim()) return '';

            // Check completeness for section badge
            const isComplete = (() => {
                try {
                    if (!this.progressTracker || typeof this.progressTracker.isCompleted !== 'function') return false;
                    const start = section.range[0];
                    const end = section.range[1];
                    for (let i = start; i <= end; i++) {
                        // Only check visible steps
                        const s = this.steps[i];
                        if (this.modeController && !this.modeController.isStepVisible(s.id)) continue;
                        if (!this.progressTracker.isCompleted(i)) return false;
                    }
                    return true;
                } catch { return false; }
            })();

            return `
                <div class="nav-section ${isExpanded ? 'is-expanded' : ''} ${containsActive ? 'contains-active' : ''}">
                    <div class="nav-section-header" data-section-id="${section.id}">
                        <span class="nav-section-title">${section.label}${isComplete ? ' ✓' : ''}</span>
                        <span class="nav-section-arrow">${isExpanded ? '▾' : '▸'}</span>
                    </div>
                    <div class="nav-section-items" style="${isExpanded ? '' : 'display: none'}">
                        ${visibleStepsHTML}
                    </div>
                </div>
            `;
        }).join('');

        // بطاقة حالة واحدة تلمّ الصفوف الثلاثة (نتيجة الفكرة/الاكتمال/التقدم) بدل 3 بطاقات
        const statusHTML = (ideaScoreHTML || completenessHTML || progressHTML)
            ? `<div class="sidebar-status">${ideaScoreHTML}${completenessHTML}${progressHTML}</div>`
            : '';
        this.container.innerHTML = statusHTML + modeToggleHTML + studiesSectionHTML + renderedSections;
        console.log('[Sidebar] HTML injected');

        // Ensure container is visible
        if (this.container) {
            this.container.style.removeProperty('display'); // Let CSS handle it

            // Remove manual display manipulation on parent sidebar to avoid conflicts with Mobile CSS
            const sidebarEl = this.container.closest('.sidebar');
            if (sidebarEl) {
                // Only remove display:none if it was explicitly set inline (e.g. by landing page logic)
                if (sidebarEl.style.display === 'none') {
                    sidebarEl.style.removeProperty('display');
                }
            }
        }

        // نقرات الخطوات ورؤوس الأقسام مربوطة بالتفويض في _bindDelegatedNavClicks()
        // (مرة واحدة على الحاوية) — لا حاجة لإعادة الربط بعد كل رسم.
        this._bindDelegatedNavClicks();

        // قسم الدراسات: دراسة جديدة + الدراسات المحفوظة
        this.container.querySelector('.studies-action[data-action="new"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('feasibility:newStudy'));
        });
        this.container.querySelector('.studies-action[data-action="integrations"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('feasibility:showIntegrations'));
        });
        this.container.querySelector('.studies-action[data-action="trash"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('feasibility:showTrash'));
        });
        this.container.querySelector('.studies-action[data-action="open-list"]')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const listEl = document.getElementById('studiesListContainer');
            if (!listEl) return;
            if (listEl.style.display === 'block') {
                listEl.style.display = 'none';
                return;
            }
            if (listEl.style.display === 'none' || listEl.style.display === '') {
                if (!listEl._loaded) {
                    listEl.innerHTML = '<div class="text-xs text-muted p-2">جاري التحميل...</div>';
                    try {
                        const { ProjectManager } = await import('../services/ProjectManager.js');
                        const list = await ProjectManager.getAllProjects();
                        listEl._loaded = true;
                        listEl._list = list || [];
                        listEl._sortBy = listEl._sortBy || 'date';
                        this._renderStudiesList(listEl);
                        listEl.style.display = 'block';
                    } catch (err) {
                        listEl.innerHTML = '<div class="text-xs text-danger p-2">فشل تحميل القائمة</div>';
                        listEl._loaded = true;
                        listEl.style.display = 'block';
                    }
                } else {
                    listEl.style.display = 'block';
                }
            } else {
                listEl.style.display = 'none';
            }
        });

        // Bind completeness details button
        this.container.querySelector('.btn-completeness-details')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.showCompletenessDetails();
        });

        // وضع العرض: بسيط | كامل
        this.container.querySelectorAll('.btn-mode-sidebar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const m = btn.dataset.mode;
                if (!m) return;
                
                if (this.modeController) {
                    this.modeController.setMode(m);
                } else if (this.store?.update) {
                    const s = (this.store.getState && this.store.getState()) || (this.store.get && this.store.get()) || {};
                    this.store.update('appSettings', { ...(s.appSettings || {}), mode: m });
                }

                // المظهر من CSS عبر الفئة .active فقط — لا أنماط مضمّنة تتجاوز الثيم
                this.container.querySelectorAll('.btn-mode-sidebar').forEach(b => {
                    const isActive = b.dataset.mode === m;
                    b.classList.toggle('active', isActive);
                    b.setAttribute('aria-pressed', String(isActive));
                });
                const msg = m === 'quick' ? 'الوضع الأساسي (مبتدئ)' : 'الوضع المتقدم (مستشار)';
                toast.info('تم التبديل إلى ' + msg, 2500);

                // Reload to apply changes cleanly (step filtering affects everything)
                setTimeout(() => window.location.reload(), 500);
            });
        });
    }

    async showCompletenessDetails() {
        try {
            const storeInstance = this.store || (await import('../core/store.js')).store;
            const { calculateStudyCompleteness } = await import('../utils/studyCompleteness.js');
            const state = storeInstance?.getState();
            if (!state) return;

            const completeness = calculateStudyCompleteness(state);
            const missingSections = completeness.getMissingSections();

            // Create modal overlay
            const modal = document.createElement('div');
            modal.className = 'modal-overlay is-open';
            modal.innerHTML = `
                <div class="modal-card" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>تفاصيل نسبة الاكتمال</h3>
                        <button class="btn-close">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="text-center mb-4">
                            <div class="text-4xl font-bold ${completeness.percentage >= 80 ? 'text-success' : completeness.percentage >= 50 ? 'text-warning' : 'text-danger'} mb-2">
                                ${completeness.percentage}%
                            </div>
                            <p class="text-muted">${this.getCompletenessMessage(completeness.percentage)}</p>
                        </div>

                        <div class="completeness-details-grid" style="display: grid; gap: 8px; margin-top: 16px;">
                            ${Object.entries(completeness.details).map(([key, d]) => {
                const sectionLabels = {
                    projectInfo: 'بيانات المشروع',
                    keyPeople: 'الأشخاص الرئيسون',
                    projectIntro: 'مقدمة الجدوى الموحدة',
                    technical: 'الدراسة الفنية',
                    hr: 'الموارد البشرية',
                    assumptions: 'الافتراضات المالية',
                    techResources: 'الموارد التقنية',
                    logistics: 'الموارد اللوجستية',
                    administrative: 'الموارد الإدارية',
                    legal: 'الدراسة القانونية',
                    revenue: 'مصادر الإيرادات',
                    marketing: 'الدراسة التسويقية',
                    marketSizing: 'تحليل حجم السوق',
                    strategic: 'التحليل الاستراتيجي',
                    services: 'تحليل الخدمات',
                    riskAnalysis: 'تحليل المخاطر',
                    scenarios: 'السيناريوهات',
                    financing: 'مصادر التمويل'
                };
                const label = sectionLabels[key] || key;
                const pct = Math.round(d.percentage);
                const colorClass = pct >= 80 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-danger';
                return `
                                    <div class="completeness-detail-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--c-bg-card); border-radius: 4px;">
                                        <span>${label}</span>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div class="progress-bar" style="width: 100px; height: 4px; background: var(--c-bg-app); border-radius: 2px;">
                                                <div class="progress-bar-fill ${colorClass.replace('text-', 'bg-')}" style="width: ${pct}%; height: 100%;"></div>
                                            </div>
                                            <span class="${colorClass} font-bold">${pct}%</span>
                                        </div>
                                    </div>
                                `;
            }).join('')}
                        </div>

                        ${missingSections.length > 0 ? `
                            <div class="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                                <div class="font-medium mb-2">توصيات للإكمال:</div>
                                <ul class="text-sm space-y-1">
                                    ${missingSections.map(s => {
                const stepIdx = (this.steps || []).findIndex(st => st.id === s.key);
                const canGo = stepIdx >= 0 && typeof this.onStepClick === 'function';
                return `
                                        <li class="mb-2">
                                            <div class="font-medium flex items-center gap-2 flex-wrap">
                                                <span>• ${s.label} <span class="text-xs text-muted">(${s.max} نقطة)</span></span>
                                                ${canGo ? `<button type="button" class="btn-goto-section btn-xs btn--primary" data-step-index="${stepIdx}" title="انتقل للإكمال">انتقل ←</button>` : ''}
                                            </div>
                                            ${s.missing && s.missing.length > 0 ? `
                                                <ul class="list-disc list-inside pl-4 mt-1 text-xs text-danger/80">
                                                    ${s.missing.map(m => `<li>${m}</li>`).join('')}
                                                </ul>
                                            ` : ''}
                                        </li>
                                    `}).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn--primary w-full btn-close-modal">إغلاق</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Close handlers
            const onEscape = (e) => { if (e.key === 'Escape') closeModal(); };
            const closeModal = () => {
                document.removeEventListener('keydown', onEscape);
                modal.classList.remove('is-open');
                setTimeout(() => modal.remove(), 300);
            };
            document.addEventListener('keydown', onEscape);

            modal.querySelector('.btn-close')?.addEventListener('click', closeModal);
            modal.querySelector('.btn-close-modal')?.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });

            // روابط «انتقل» لتوصيات الإكمال — إغلاق النافذة والانتقال للخطوة
            modal.querySelectorAll('.btn-goto-section').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.stepIndex, 10);
                    if (!isNaN(idx) && typeof this.onStepClick === 'function') {
                        closeModal();
                        this.onStepClick(idx);
                    }
                });
            });
        } catch (e) {
            console.error('Error showing completeness details:', e);
            toast.error('حدث خطأ أثناء عرض التفاصيل');
        }
    }
}
