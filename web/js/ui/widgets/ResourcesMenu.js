export class ResourcesMenu {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = options;
        this.isOpen = false;
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Clean up existing if any
        container.innerHTML = '';

        const button = document.createElement('button');
        button.className = 'btn btn--ghost btn--sm';
        button.innerHTML = `
            <span></span>
            <span>مركز المعرفة والموارد</span>
            <span class="dv-resources__caret" aria-hidden="true">▼</span>
        `;

        button.onclick = (e) => {
            e.stopPropagation();
            this.toggleMenu();
        };

        container.appendChild(button);

        // Menu Dropdown — التموضع/الألوان/الحدود الفعلية تأتي بالكامل من محددات المعرّف
        // #resources-menu-root-dropdown في decision-dashboard.css؛ الفئات هنا مجرد خطاطيف
        // تبديل حالة (hidden/opacity-0/-translate-y-2) يستخدمها toggleMenu/openMenu/closeMenu.
        const menu = document.createElement('div');
        menu.id = `${this.containerId}-dropdown`;
        menu.className = 'hidden opacity-0 -translate-y-2';
        menu.innerHTML = `
            <div class="dv-resources__body">
                <div class="dv-resources__group-label">تعلم وإرشاد</div>
                ${this.renderLink('', 'دليل المبتدئين', 'beginnerGuide')}
                ${this.renderLink('', 'تقييم الفكرة (Startup)', 'ideaAssessment')}
                ${this.renderLink('', 'مركز المعرفة', 'knowledgeCenter')}

                <div class="dv-resources__group-label dv-resources__group-label--sp">أدوات مساعدة</div>
                ${this.renderLink('', 'دليل التمويل', 'financingGuide')}
                ${this.renderLink('', 'معايير منشآت', 'monshaatCompliance')}
                ${this.renderLink('', 'نصائح المسرّعات', 'acceleratorTips')}

                <div class="dv-resources__group-label dv-resources__group-label--sp">دعم</div>
                ${this.renderLink('', 'طلب استشارة', 'advisory')}
                ${this.renderLink('', 'موارد وإرشاد', 'resourcesGuide')}
            </div>
        `;

        container.appendChild(menu);
        this.menu = menu;

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !container.contains(e.target)) {
                this.closeMenu();
            }
        });
    }

    // إيموجي الأيقونة في <span> منفصل عن نص التسمية — نفس أسلوب إخفاء إيموجي زر الفتح
    // (decision-dashboard.css:1072) — بدل نص خام "📖 دليل المبتدئين" لا يمكن لـCSS فصله.
    renderLink(iconChar, label, actionKey) {
        return `
            <button data-action="${actionKey}">
                <span class="dv-resources__link-ic" aria-hidden="true">${iconChar}</span>
                <span class="dv-resources__link-label">${label}</span>
                <span class="dv-resources__link-arrow" aria-hidden="true">←</span>
            </button>
        `;
    }

    toggleMenu() {
        if (this.isOpen) this.closeMenu();
        else this.openMenu();
    }

    openMenu() {
        if (!this.menu) return;
        this.menu.classList.remove('hidden');
        // Trigger reflow
        void this.menu.offsetWidth;
        this.menu.classList.remove('opacity-0', '-translate-y-2');
        this.isOpen = true;
        this.bindActions();
    }

    closeMenu() {
        if (!this.menu) return;
        this.menu.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => {
            this.menu.classList.add('hidden');
        }, 200);
        this.isOpen = false;
    }

    bindActions() {
        this.menu.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                this.handleAction(action);
                this.closeMenu();
            };
        });
    }

    handleAction(action) {
        const actions = {
            beginnerGuide: this.options.onShowBeginnerGuide,
            ideaAssessment: this.options.onShowIdeaAssessment,
            knowledgeCenter: this.options.onShowKnowledgeCenter,
            financingGuide: this.options.onShowFinancingGuide,
            monshaatCompliance: this.options.onShowMonshaatCompliance,
            acceleratorTips: this.options.onShowAcceleratorTips,
            advisory: this.options.onShowAdvisory,
            resourcesGuide: this.options.onShowResourcesGuide
        };

        if (actions[action]) {
            actions[action]();
        }
    }
}
