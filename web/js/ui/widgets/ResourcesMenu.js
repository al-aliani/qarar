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
        button.className = 'btn btn--ghost btn--sm flex items-center gap-2 text-muted hover:text-gold transition-colors';
        button.innerHTML = `
            <span>📚</span>
            <span>مركز المعرفة والموارد</span>
            <span class="text-xs opacity-50">▼</span>
        `;

        button.onclick = (e) => {
            e.stopPropagation();
            this.toggleMenu();
        };

        container.appendChild(button);

        // Menu Dropdown
        const menu = document.createElement('div');
        menu.id = `${this.containerId}-dropdown`;
        menu.className = 'absolute top-full left-0 mt-2 w-64 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 hidden opacity-0 transform -translate-y-2 transition-all duration-200';
        menu.innerHTML = `
            <div class="p-2 space-y-1">
                <div class="px-3 py-2 text-xs font-bold text-muted uppercase tracking-wider border-b border-white/5 mb-1">تعلم وإرشاد</div>
                ${this.renderLink('📖 دليل المبتدئين', 'beginnerGuide')}
                ${this.renderLink('💡 تقييم الفكرة (Startup)', 'ideaAssessment')}
                ${this.renderLink('🎓 مركز المعرفة', 'knowledgeCenter')}
                
                <div class="px-3 py-2 text-xs font-bold text-muted uppercase tracking-wider border-b border-white/5 mb-1 mt-2">أدوات مساعدة</div>
                ${this.renderLink('🏦 دليل التمويل', 'financingGuide')}
                ${this.renderLink('📋 معايير منشآت', 'monshaatCompliance')}
                ${this.renderLink('🚀 نصائح المسرّعات', 'acceleratorTips')}
                
                <div class="px-3 py-2 text-xs font-bold text-muted uppercase tracking-wider border-b border-white/5 mb-1 mt-2">دعم</div>
                ${this.renderLink('💬 طلب استشارة', 'advisory')}
                ${this.renderLink('📂 موارد وإرشاد', 'resourcesGuide')}
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

    renderLink(text, actionKey) {
        return `
            <button class="w-full text-right px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white rounded transition-colors flex items-center justify-between group" data-action="${actionKey}">
                <span>${text}</span>
                <span class="opacity-0 group-hover:opacity-100 transition-opacity">←</span>
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
