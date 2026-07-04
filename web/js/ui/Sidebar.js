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
        this.saveStatusUnsubscribe = null;
        this.modeController = new SimpleModeController(store);

        this.sections = SIDEBAR_SECTIONS;

        // Accordion: افتح قسماً واحداً افتراضياً + احتفظ بقسم الدراسات منفصلاً
        const first = (this.sections && this.sections[0] && this.sections[0].id) ? this.sections[0].id : null;
        this.expandedSections = new Set(['studies']);
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
        // مطابقة واحد-بواحد مع STEPS في wizardSteps.js (44 خطوة) — عند إضافة خطوة أضف أيقونتها هنا
        const icons = [
            '🔍', // 0: الدراسة المبدئية
            '⚖️', // 1: اختيار المشروع (مقارنة أفكار)
            '🚀', // 2: ابدأ من قالب قطاعي
            '🏠', // 3: معلومات المشروع ونموذج العمل
            '🎯', // 4: تفاصيل الفكرة (المنتجات والخدمات)
            '👥', // 5: الأشخاص الرئيسون
            '📜', // 6: مقدمة الجدوى الموحدة
            '🏆', // 7: الأهداف الذكية
            '🏗️', // 8: الدراسة الفنية (الأصول)
            '🧑‍💼', // 9: الموارد البشرية (الرواتب)
            '💻', // 10: الموارد التقنية
            '🚚', // 11: الموارد اللوجستية
            '📂', // 12: الموارد الإدارية
            '🏢', // 13: الهيكل التنظيمي والحوكمة
            '🏭', // 14: محاكاة التشغيل
            '⚖️', // 15: الدراسة القانونية
            '📈', // 16: الدراسة السوقية
            '🧩', // 17: التحليل الاستراتيجي (SWOT)
            '💰', // 18: مصادر الإيرادات
            '🛠️', // 19: تحليل الخدمات المفصل
            '🏦', // 20: مصادر وهيكلة التمويل
            '🤝', // 21: تحليل الجدوى الاستثمارية
            '📝', // 22: الافتراضات المالية
            '📊', // 23: القوائم المالية التقديرية
            '🧾', // 24: جدول سداد القرض
            '⚖️', // 25: الميزانية العمومية
            '📉', // 26: تحليل نقطة التعادل
            '💹', // 27: مؤشرات التقييم المالي
            '🧠', // 28: التحليل الاستراتيجي
            '⚠️', // 29: تحليل المخاطر
            '⛈️', // 30: اختبار التحمل
            '🔬', // 31: تحليل الحساسية
            '🔮', // 32: مستويات السيناريوهات
            '📅', // 33: الجدول الزمني للتنفيذ
            '🌙', // 34: حساب الزكاة والضريبة
            '🎲', // 35: محاكاة مونت كارلو
            '💎', // 36: تقييم الشركة
            '🔭', // 37: مراقبة الأداء الفعلي
            '📎', // 38: الملاحق والمصادر والمراجع
            '💼', // 39: نموذج العمل
            '🚦', // 40: لوحة القرار الاستثماري
            '🏁', // 41: الملخص التنفيذي النهائي
            '🧱', // 42: بناء التقرير
            '🖥️', // 43: لوحة التحكم المالي العامة
        ];
        return icons[index] || '🔹';
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
                            <span class="step-icon">📄</span>
                            <span class="step-label truncate">${(p.name || 'بدون اسم').substring(0, 24)}</span>
                            <span class="text-muted text-[10px]">${this._formatStudyDate(p.lastModified)}</span>
                        </div>
                        <button type="button" class="studies-delete-btn p-0.5 rounded opacity-70 hover:opacity-100" data-id="${p.id}" title="حذف الدراسة" aria-label="حذف">🗑️</button>
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
        this.updateAuthWidget(); // Ensure auth is shown
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

    // Auth & Persistence Integration
    async updateAuthWidget() {
        const authContainer = this.container.querySelector('#authWidget');
        if (!authContainer) return; // if render hasn't happened yet

        try {
            const { getAuthUser } = await import('../../supabaseClient.js');
            const { user } = await getAuthUser();

            if (user) {
                authContainer.innerHTML = `
                    <div class="auth-box logged-in">
                        <div class="auth-avatar">👤</div>
                        <div class="auth-info">
                            <span class="auth-email" title="${user.email}">${user.email.split('@')[0]}</span>
                            <span id="saveStatus" class="auth-status text-success">● محفوظ</span>
                        </div>
                        <button id="btnLogout" class="btn-xs btn--text">تسجيل خروج</button>
                    </div>
                `;

                authContainer.querySelector('#btnLogout')?.addEventListener('click', async () => {
                    if (this.store && this.store.flush) await this.store.flush();
                    const { signOut } = await import('../../supabaseClient.js');
                    await signOut();
                });

                // Update save status initially
                if (this.store && typeof this.store.getLastSaveStatus === 'function') {
                    const lastStatus = this.store.getLastSaveStatus();
                    this.updateSaveStatus(lastStatus);
                }
            } else {
                authContainer.innerHTML = `
                    <div class="auth-box guest">
                        <div class="auth-info">
                            <span class="auth-name">مستخدم ضيف</span>
                            <span id="saveStatus" class="auth-status text-muted">● مسودة محلية</span>
                        </div>
                        <button id="btnLogin" class="btn-xs btn--primary">دخول / تسجيل</button>
                    </div>
                `;

                authContainer.querySelector('#btnLogin').addEventListener('click', async () => {
                    const { AuthModal } = await import('./AuthModalStub.js');
                    const m = new AuthModal('authModalContainer', {
                        onSuccess: async ({ success }) => {
                            if (success) {
                                this.updateAuthWidget();
                                if (this.store && this.store.flush) await this.store.flush();
                                window.location.reload();
                            }
                        }
                    });
                    m.open();
                });
            }
        } catch (e) {
            console.error('Auth widget error:', e);
            authContainer.innerHTML = `<div class="text-xs text-danger">خطأ في المصادقة</div>`;
        }
    }

    updateSaveStatus(status) {
        const saveStatusEl = this.container.querySelector('#saveStatus');
        if (!saveStatusEl) return;

        if (status.location === 'both') {
            saveStatusEl.textContent = '● محفوظ في السحابة';
            saveStatusEl.className = 'auth-status text-success';
        } else if (status.location === 'local') {
            saveStatusEl.textContent = status.error ? '● خطأ في المزامنة' : '● مسودة محلية';
            saveStatusEl.className = status.error ? 'auth-status text-warning' : 'auth-status text-muted';
        } else {
            saveStatusEl.textContent = '● غير محفوظ';
            saveStatusEl.className = 'auth-status text-danger';
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
        let ideaScoreHTML = '';
        try {
            const storeInstance = this.store;
            const state = storeInstance?.getState?.() ?? storeInstance?.get?.() ?? {};
            const idea = calculateIdeaScore(state);
            const score = Math.min(100, Math.max(0, idea.score));
            const colorClass = idea.color === 'green' ? 'idea-score--green' : idea.color === 'yellow' ? 'idea-score--yellow' : 'idea-score--red';
            const strokeColor = idea.color === 'green' ? 'var(--c-success)' : idea.color === 'yellow' ? 'var(--c-p-500)' : 'var(--c-danger)';
            const rotation = -90 + (score / 100) * 180;
            ideaScoreHTML = `
                <div class="idea-score-widget mb-3 p-3 rounded-lg border border-border ${colorClass}" role="status" aria-label="نتيجة الفكرة ${score} من 100">
                    <div class="idea-score-header flex items-center justify-between mb-2">
                        <span class="text-xs text-muted">نتيجة الفكرة</span>
                        <span class="idea-score-value text-lg font-bold" style="color: ${idea.color === 'green' ? 'var(--c-success)' : idea.color === 'yellow' ? 'var(--c-p-500)' : 'var(--c-danger)'}">${score}</span>
                    </div>
                    <div class="idea-score-gauge" style="--idea-rotation: ${rotation}deg; --idea-color: ${strokeColor};">
                        <svg viewBox="0 0 60 32" class="idea-score-svg" aria-hidden="true">
                            <path d="M 6 28 A 24 24 0 0 1 54 28" fill="none" stroke="var(--c-bg-panel)" stroke-width="6"/>
                            <path d="M 6 28 A 24 24 0 0 1 54 28" fill="none" stroke="var(--idea-color)" stroke-width="6" stroke-dasharray="${(score / 100) * 75.4} 75.4" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <div class="text-xs text-center mt-1 idea-score-message">${idea.message}</div>
                    <div class="text-[10px] text-muted mt-2 flex justify-between">
                        <span title="اكتمال البيانات">📋 ${idea.breakdown.completeness}</span>
                        <span title="هامش الربح">📈 ${idea.breakdown.margin}</span>
                        <span title="حجم السوق TAM">🌐 ${idea.breakdown.tam}</span>
                    </div>
                </div>
            `;
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
                const icon = percentage >= 80 ? '✅' : percentage >= 50 ? '⚠️' : '📋';

                const missingSections = completeness.getMissingSections().slice(0, 3);
                completenessHTML = `
                    <div class="completeness-widget mb-4 p-3 bg-card rounded-lg border border-border">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-muted">نسبة الاكتمال</span>
                            <span class="text-lg font-bold ${colorClass}">${percentage}%</span>
                        </div>
                        <div class="progress-bar bg-bg-card" style="height: 6px; border-radius: 3px; overflow: hidden;">
                            <div class="progress-bar-fill ${colorClass.replace('text-', 'bg-')}" 
                                 style="width: ${percentage}%; height: 100%; transition: width 0.3s ease;"></div>
                        </div>
                        <div class="text-xs text-muted mt-1 text-center mb-2">${icon} ${this.getCompletenessMessage(percentage)}</div>
                        ${missingSections.length > 0 && percentage < 80 ? `
                            <div class="text-xs text-muted mt-2 pt-2 border-t border-border">
                                <div class="font-medium mb-1">💡 يحتاج إكمال:</div>
                                <div class="space-y-1">
                                    ${missingSections.map(s => `<div class="text-xs">• ${s.label} (${Math.round(s.percentage)}%)</div>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                        ${percentage < 100 && typeof completeness.getTipsToRaiseScore === 'function' ? (() => {
                        const tips = completeness.getTipsToRaiseScore().slice(0, 2);
                        if (tips.length === 0) return '';
                        return `<div class="text-xs text-gold mt-2 pt-2 border-t border-border"><div class="font-medium mb-1">📈 نصائح لرفع النقاط:</div><div class="space-y-0.5">${tips.map(t => `<div class="text-xs">• ${t}</div>`).join('')}</div></div>`;
                    })() : ''}
                        <button class="btn btn--xs btn--ghost w-full mt-2 btn-completeness-details" style="font-size: 0.75rem;">
                            📋 عرض التفاصيل
                        </button>
                    </div>
                `;
            }
        } catch (e) {
            console.warn('Could not calculate completeness:', e);
        }

        console.log('[Sidebar] building HTML...');
        // Auth Widget Placeholder
        const authHTML = `<div id="authWidget" class="auth-widget-container mb-4"></div>`;

        // تجميع المحتوى: نتيجة الفكرة أولاً ثم Auth ثم الوضع ثم الاكتمال ثم التقدم ثم الدراسات ثم الأقسام
        const state = (this.store?.getState && this.store.getState()) || (this.store?.get && this.store.get()) || {};
        const mode = state.appSettings?.mode || 'advanced';
        const modeToggleHTML = `
            <div class="mode-toggle-widget mb-3 p-2 rounded-lg border border-border" style="background: var(--c-bg-card, #1a1d24);" role="group" aria-label="وضع العرض">
                <div class="text-xs text-muted mb-1">نمط الدراسة</div>
                <div class="flex gap-1 flex-wrap">
                    <button class="btn-mode-sidebar flex-1 px-2 py-1 text-xs rounded min-w-0 ${mode === 'quick' ? 'active' : ''}" data-mode="quick" title="سريع ومختصر (للمبتدئين)" aria-pressed="${mode === 'quick'}">🚀 سريع</button>
                    <button class="btn-mode-sidebar flex-1 px-2 py-1 text-xs rounded min-w-0 ${mode === 'advanced' ? 'active' : ''}" data-mode="advanced" title="كامل وتفصيلي (للمحترفين)" aria-pressed="${mode === 'advanced'}">💼 مفصل</button>
                </div>
            </div>
        `;

        // قسم الدراسات (قبل البداية والتعريف): دراسة جديدة + الدراسات المحفوظة
        const studiesSectionHTML = `
            <div class="nav-section studies-section ${this.expandedSections.has('studies') ? 'is-expanded' : ''}">
                <div class="nav-section-header" data-section-id="studies">
                    <span class="nav-section-title">📂 الدراسات</span>
                    <span class="nav-section-arrow">${this.expandedSections.has('studies') ? '▾' : '▸'}</span>
                </div>
                <div class="nav-section-items" style="${this.expandedSections.has('studies') ? '' : 'display: none'}">
                    <div class="step-item studies-action" data-action="new" role="button" tabindex="0">
                        <span class="step-icon">➕</span>
                        <span class="step-label">دراسة جديدة</span>
                    </div>
                    <div class="step-item studies-action" data-action="open-list" role="button" tabindex="0">
                        <span class="step-icon">📂</span>
                        <span class="step-label">الدراسات المحفوظة</span>
                    </div>
                    <div class="step-item studies-action" data-action="integrations" role="button" tabindex="0">
                        <span class="step-icon">🔗</span>
                        <span class="step-label">التكاملات</span>
                    </div>
                    <div class="step-item studies-action" data-action="trash" role="button" tabindex="0">
                        <span class="step-icon">🗑️</span>
                        <span class="step-label">سلة المحذوفات</span>
                    </div>
                    <div id="studiesListContainer" class="studies-list-container" style="display:none; padding: 4px 0 4px 8px; max-height: 200px; overflow-y: auto;"></div>
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
                            <div class="step-icon">${isComplete && !isActive ? '✓' : this.getStepIcon(globalIdx)}</div>
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

        this.container.innerHTML = ideaScoreHTML + authHTML + modeToggleHTML + completenessHTML + progressHTML + studiesSectionHTML + renderedSections;
        console.log('[Sidebar] HTML injected');

        // Init Auth Widget content
        this.updateAuthWidget();

        // Subscribe to save status updates if store is available
        if (this.store && typeof this.store.subscribeSaveStatus === 'function') {
            if (this.saveStatusUnsubscribe) {
                this.saveStatusUnsubscribe(); // Cleanup old subscription
            }
            this.saveStatusUnsubscribe = this.store.subscribeSaveStatus((status) => {
                this.updateSaveStatus(status);
            });
        }

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
                if (!m || !this.store?.update) return;
                const s = (this.store.getState && this.store.getState()) || (this.store.get && this.store.get()) || {};
                this.store.update('appSettings', { ...(s.appSettings || {}), mode: m });
                this.container.querySelectorAll('.btn-mode-sidebar').forEach(b => {
                    b.classList.toggle('active', b.dataset.mode === m);
                    b.style.background = b.dataset.mode === m ? 'var(--c-p-500)' : 'transparent';
                    b.style.color = b.dataset.mode === m ? '#fff' : '';
                });
                const msg = m === 'quick' ? 'الوضع السريع' : 'الوضع المفصل';
                toast.info('تم التبديل إلى ' + msg, 2500);

                // Reload to apply changes cleanly (step filtering affects everything)
                setTimeout(() => window.location.reload(), 500);
            });
        });
        // تطبيق نمط الزر النشط عند العرض
        this.container.querySelectorAll('.btn-mode-sidebar').forEach(b => {
            const isActive = b.dataset.mode === mode;
            b.style.background = isActive ? 'var(--c-p-500)' : 'transparent';
            b.style.color = isActive ? '#fff' : '';
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
                        <h3>📊 تفاصيل نسبة الاكتمال</h3>
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
                                <div class="font-medium mb-2">💡 توصيات للإكمال:</div>
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
