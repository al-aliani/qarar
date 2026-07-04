/**
 * Organization Structure Component
 * Visual org chart, governance, Saudization, and operational KPIs
 * Based on MISA and Monsha'at requirements
 */

import { DataService } from '../services/DataService.js';
import { DynamicTable } from './DynamicTable.js';
import { TABLE_SCHEMAS } from '../core/schema.js';
import { InternalAIGenerator } from '../services/InternalAIGenerator.js';

export class OrgStructure {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        const orgStructure = state.orgStructure || {};
        const hrData = state.hr || {};

        this.container.innerHTML = `
            <div class="org-structure">
                <h2 class="section-title">🏢 الهيكل التنظيمي والحوكمة</h2>
                
                <!-- Org Chart -->
                <div class="card analysis-card">
                    <h3 class="card-title">الهيكل التنظيمي</h3>
                    <p class="text-muted text-sm mb-3">قم بإضافة الأقسام والإدارات</p>
                    ${this.renderOrgChart(orgStructure.departments || [])}
                </div>

                <!-- Board of Directors -->
                <div class="card analysis-card">
                    <h3 class="card-title">مجلس الإدارة</h3>
                    ${this.renderBoardOfDirectors(orgStructure.boardOfDirectors || [])}
                </div>

                <!-- المجلس الاستشاري (الفجوة المعيارية) -->
                <div class="card analysis-card">
                    <h3 class="card-title">المجلس الاستشاري</h3>
                    <p class="text-muted text-sm mb-3">مقترح أعضاء استشاريين (المالك، مدير، خبير تطوير أعمال...)</p>
                    ${this.renderAdvisoryBoard(orgStructure.advisoryBoard || [])}
                </div>

                <!-- Governance -->
                <div class="card analysis-card">
                    <h3 class="card-title">الحوكمة</h3>
                    ${this.renderGovernance(orgStructure.governance || {})}
                </div>

                <!-- مؤشرات قياس الأداء التشغيلية (KPI) -->
                <div class="card analysis-card">
                    <h3 class="card-title">📊 مؤشرات قياس الأداء التشغيلية</h3>
                    <p class="text-muted text-sm mb-3">الهدف، المؤشر، طريقة الحساب، وحدة القياس، القيمة المعيارية</p>
                    <div id="operationalKpisTable"></div>
                </div>

                <!-- Saudization -->
                <div class="card analysis-card">
                    <h3 class="card-title">الهيكل التنظيمي</h3>
                    <div id="orgChart" class="org-chart-container"></div>
                </div>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.renderOperationalKpisTable();
        this.bindEvents();
    }

    renderOperationalKpisTable() {
        const container = this.container.querySelector('#operationalKpisTable');
        if (!container) return;
        const schema = TABLE_SCHEMAS.operationalKpis;
        if (!schema) return;
        const state = this.store.getState();
        const data = state.orgStructure?.operationalKpis || [];
        const table = new DynamicTable(null, {
            ...schema,
            id: 'operationalKpis',
            initialData: [...data],
            onChange: (newData) => {
                this.store.update('orgStructure', { ...this.store.getState().orgStructure, operationalKpis: newData });
            },
            onSuggest: async (btn) => {
                if (btn?.disabled) return;
                const orig = btn?.textContent || '';
                if (btn) { btn.disabled = true; btn.textContent = 'جاري التوليد...'; }
                try {
                    const sug = InternalAIGenerator.generateOperationalKpis({ projectInfo: this.store.getState().projectInfo || {} });
                    if (sug?.length) {
                        const merged = [...(this.store.getState().orgStructure?.operationalKpis || []), ...sug];
                        this.store.update('orgStructure', { ...this.store.getState().orgStructure, operationalKpis: merged });
                        this.render();
                    }
                } finally {
                    if (btn) { btn.disabled = false; btn.textContent = orig; }
                }
            }
        });
        table.container = container;
        table.data = data;
        table.render();
    }

    renderOrgChart(departments) {
        const defaultDepts = [
            { id: 'ceo', name: 'المدير التنفيذي', parentId: null, head: '', responsibilities: 'القيادة العامة والاستراتيجية' },
            { id: 'ops', name: 'مدير العمليات', parentId: 'ceo', head: '', responsibilities: 'إدارة العمليات اليومية' },
            { id: 'fin', name: 'المدير المالي', parentId: 'ceo', head: '', responsibilities: 'المالية والمحاسبة' },
            { id: 'mkt', name: 'مدير التسويق', parentId: 'ceo', head: '', responsibilities: 'التسويق والمبيعات' },
            { id: 'hr', name: 'مدير الموارد البشرية', parentId: 'ceo', head: '', responsibilities: 'شؤون الموظفين' }
        ];

        const depts = departments.length > 0 ? departments : defaultDepts;

        return `
            <div class="org-chart-container">
                <div class="org-chart">
                    ${this.buildOrgTree(depts, null)}
                </div>
            </div>
            <div class="departments-table">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>القسم/المنصب</th>
                            <th>المسؤول</th>
                            <th>المسؤوليات</th>
                            <th>يتبع لـ</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="departmentsBody">
                        ${depts.map((dept, idx) => `
                            <tr data-idx="${idx}">
                                <td><input type="text" class="input input--sm dept-field" data-field="name" value="${dept.name || ''}"></td>
                                <td><input type="text" class="input input--sm dept-field" data-field="head" value="${dept.head || ''}"></td>
                                <td><input type="text" class="input input--sm dept-field" data-field="responsibilities" value="${dept.responsibilities || ''}"></td>
                                <td>
                                    <select class="input input--sm dept-field" data-field="parentId">
                                        <option value="">لا يوجد</option>
                                        ${depts.filter(d => d.id !== dept.id).map(d => `
                                            <option value="${d.id}" ${dept.parentId === d.id ? 'selected' : ''}>${d.name}</option>
                                        `).join('')}
                                    </select>
                                </td>
                                <td><button class="btn-icon btn-remove-dept" data-idx="${idx}">🗑️</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <button class="btn btn--sm btn--ghost btn-add-dept">+ إضافة قسم</button>
            </div>
        `;
    }

    buildOrgTree(departments, parentId, level = 0) {
        const children = departments.filter(d => d.parentId === parentId);
        if (children.length === 0) return '';

        return `
            <div class="org-level level-${level}">
                ${children.map(dept => `
                    <div class="org-node">
                        <div class="org-card">
                            <div class="org-title">${dept.name}</div>
                            <div class="org-head">${dept.head || '(شاغر)'}</div>
                        </div>
                        ${this.buildOrgTree(departments, dept.id, level + 1)}
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderAdvisoryBoard(advisors) {
        const esc = (s) => (s || '').toString().replace(/</g, '&lt;').replace(/"/g, '&quot;');
        return `
            <div class="advisory-container">
                <table class="data-table">
                    <thead>
                        <tr><th>الاسم</th><th>الدور/التخصص</th><th></th></tr>
                    </thead>
                    <tbody id="advisoryBody">
                        ${advisors.map((a, idx) => `
                            <tr data-idx="${idx}">
                                <td><input type="text" class="input input--sm advisory-field" data-field="name" value="${esc(a.name)}" placeholder="الاسم"></td>
                                <td><input type="text" class="input input--sm advisory-field" data-field="role" value="${esc(a.role)}" placeholder="مثال: خبير تطوير أعمال"></td>
                                <td><button class="btn-icon btn-remove-advisory" data-idx="${idx}">🗑️</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <button class="btn btn--sm btn--ghost btn-add-advisory">+ إضافة عضو</button>
            </div>
        `;
    }

    renderBoardOfDirectors(board) {
        return `
            <div class="board-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الاسم</th>
                            <th>المنصب</th>
                            <th>الحصة %</th>
                            <th>مستقل</th>
                            <th>اللجان</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="boardBody">
                        ${board.map((member, idx) => `
                            <tr data-idx="${idx}">
                                <td><input type="text" class="input input--sm board-field" data-field="name" value="${member.name || ''}"></td>
                                <td>
                                    <select class="input input--sm board-field" data-field="position">
                                        <option value="chairman" ${member.position === 'chairman' ? 'selected' : ''}>رئيس المجلس</option>
                                        <option value="vice" ${member.position === 'vice' ? 'selected' : ''}>نائب الرئيس</option>
                                        <option value="member" ${member.position === 'member' ? 'selected' : ''}>عضو</option>
                                    </select>
                                </td>
                                <td><input type="number" class="input input--sm board-field" data-field="share" value="${member.share ?? ''}" min="0" max="100" step="0.1" placeholder="%"></td>
                                <td><input type="checkbox" class="board-field" data-field="independent" ${member.independent ? 'checked' : ''}></td>
                                <td><input type="text" class="input input--sm board-field" data-field="committees" value="${member.committees || ''}"></td>
                                <td><button class="btn-icon btn-remove-board" data-idx="${idx}">🗑️</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <button class="btn btn--sm btn--ghost btn-add-board">+ إضافة عضو</button>
            </div>
        `;
    }

    renderGovernance(governance) {
        return `
            <div class="governance-grid">
                <div class="governance-item">
                    <label for="gov-boardMeetings">اجتماعات مجلس الإدارة</label>
                    <select id="gov-boardMeetings" class="input governance-field" data-field="boardMeetings">
                        <option value="monthly" ${governance.boardMeetings === 'monthly' ? 'selected' : ''}>شهرياً</option>
                        <option value="quarterly" ${governance.boardMeetings === 'quarterly' ? 'selected' : ''}>ربع سنوي</option>
                        <option value="biannual" ${governance.boardMeetings === 'biannual' ? 'selected' : ''}>نصف سنوي</option>
                        <option value="annual" ${governance.boardMeetings === 'annual' ? 'selected' : ''}>سنوياً</option>
                    </select>
                </div>
                <div class="governance-item">
                    <label for="gov-auditCommittee">لجنة المراجعة</label>
                    <input type="checkbox" id="gov-auditCommittee" class="governance-field" data-field="auditCommittee" ${governance.auditCommittee ? 'checked' : ''}>
                    <span class="text-muted text-sm">موجودة</span>
                </div>
                <div class="governance-item">
                    <label for="gov-complianceOfficer">مسؤول الالتزام</label>
                    <input type="text" id="gov-complianceOfficer" class="input governance-field" data-field="complianceOfficer" 
                           value="${governance.complianceOfficer || ''}" placeholder="اسم المسؤول">
                </div>
            </div>
        `;
    }

    renderSaudization(saudization, hrData) {
        const totalEmployees = (hrData.positions || []).reduce((sum, p) => sum + (p.count || 0), 0);
        const currentPct = saudization.currentPercentage || 0;
        const targetPct = saudization.targetPercentage || 0;

        // Determine Nitaqat color
        let nitaqatColor = 'red';
        if (currentPct >= 40) nitaqatColor = 'green';
        else if (currentPct >= 25) nitaqatColor = 'lightgreen';
        else if (currentPct >= 10) nitaqatColor = 'yellow';

        return `
            <div class="saudization-container">
                <div class="saudization-visual">
                    <div class="nitaqat-indicator nitaqat-${nitaqatColor}">
                        <div class="nitaqat-label">نطاقات</div>
                        <div class="nitaqat-color">${nitaqatColor === 'green' ? 'أخضر مرتفع' : nitaqatColor === 'lightgreen' ? 'أخضر منخفض' : nitaqatColor === 'yellow' ? 'أصفر' : 'أحمر'}</div>
                    </div>
                    <div class="saudization-progress">
                        <div class="progress-bar">
                            <div class="progress-bar-fill" style="width: ${currentPct}%"></div>
                        </div>
                        <div class="progress-labels">
                            <span>الحالي: ${currentPct}%</span>
                            <span>المستهدف: ${targetPct}%</span>
                        </div>
                    </div>
                </div>
                <div class="saudization-inputs">
                    <div class="input-group">
                        <label for="saud-totalEmployees">إجمالي الموظفين</label>
                        <input type="number" id="saud-totalEmployees" class="input" value="${totalEmployees}" readonly>
                    </div>
                    <div class="input-group">
                        <label for="saud-currentPct">نسبة السعودة الحالية %</label>
                        <input type="number" id="saud-currentPct" class="input saudization-field" data-field="currentPercentage"
                               value="${currentPct}" min="0" max="100">
                    </div>
                    <div class="input-group">
                        <label for="saud-targetPct">نسبة السعودة المستهدفة %</label>
                        <input type="number" id="saud-targetPct" class="input saudization-field" data-field="targetPercentage"
                               value="${targetPct}" min="0" max="100">
                    </div>
                    <div class="input-group">
                        <label for="saud-plan">خطة تحقيق السعودة</label>
                        <textarea id="saud-plan" class="input saudization-field" data-field="plan" rows="2"
                                  placeholder="كيف ستحقق نسبة السعودة المستهدفة؟">${saudization.plan || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        // Navigation
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });

        // Department fields
        this.container.querySelectorAll('.dept-field').forEach(input => {
            input.addEventListener('change', (e) => this.updateDepartment(e));
        });
        this.container.querySelector('.btn-add-dept')?.addEventListener('click', () => this.addDepartment());
        this.container.querySelectorAll('.btn-remove-dept').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeDepartment(e));
        });

        // Board fields
        this.container.querySelectorAll('.board-field').forEach(input => {
            input.addEventListener('change', (e) => this.updateBoard(e));
        });
        this.container.querySelector('.btn-add-board')?.addEventListener('click', () => this.addBoardMember());
        this.container.querySelectorAll('.btn-remove-board').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeBoardMember(e));
        });

        // Advisory board
        this.container.querySelectorAll('.advisory-field').forEach(input => {
            input.addEventListener('change', (e) => this.updateAdvisory(e));
        });
        this.container.querySelector('.btn-add-advisory')?.addEventListener('click', () => this.addAdvisoryMember());
        this.container.querySelectorAll('.btn-remove-advisory').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeAdvisoryMember(e));
        });

        // Governance fields
        this.container.querySelectorAll('.governance-field').forEach(input => {
            input.addEventListener('change', (e) => this.updateGovernanceField(e));
        });

        // Saudization fields
        this.container.querySelectorAll('.saudization-field').forEach(input => {
            input.addEventListener('change', (e) => this.updateSaudization(e));
        });
    }

    updateDepartment(e) {
        const row = e.target.closest('tr');
        const idx = parseInt(row.dataset.idx);
        const field = e.target.dataset.field;
        const value = e.target.value;

        const state = this.store.getState();
        const departments = [...(state.orgStructure?.departments || this.getDefaultDepts())];

        if (departments[idx]) {
            departments[idx] = { ...departments[idx], [field]: value };
            this.store.update('orgStructure', { ...state.orgStructure, departments });
        }
    }

    getDefaultDepts() {
        return [
            { id: 'ceo', name: 'المدير التنفيذي', parentId: null, head: '', responsibilities: 'القيادة العامة والاستراتيجية' },
            { id: 'ops', name: 'مدير العمليات', parentId: 'ceo', head: '', responsibilities: 'إدارة العمليات اليومية' },
            { id: 'fin', name: 'المدير المالي', parentId: 'ceo', head: '', responsibilities: 'المالية والمحاسبة' },
            { id: 'mkt', name: 'مدير التسويق', parentId: 'ceo', head: '', responsibilities: 'التسويق والمبيعات' },
            { id: 'hr', name: 'مدير الموارد البشرية', parentId: 'ceo', head: '', responsibilities: 'شؤون الموظفين' }
        ];
    }

    addDepartment() {
        const state = this.store.getState();
        const departments = [...(state.orgStructure?.departments || this.getDefaultDepts())];
        departments.push({
            id: crypto.randomUUID().slice(0, 8),
            name: 'قسم جديد',
            parentId: 'ceo',
            head: '',
            responsibilities: ''
        });
        this.store.update('orgStructure', { ...state.orgStructure, departments });
        this.render();
    }

    removeDepartment(e) {
        const idx = parseInt(e.target.dataset.idx);
        const state = this.store.getState();
        const departments = (state.orgStructure?.departments || []).filter((_, i) => i !== idx);
        this.store.update('orgStructure', { ...state.orgStructure, departments });
        this.render();
    }

    updateBoard(e) {
        const row = e.target.closest('tr');
        const idx = parseInt(row.dataset.idx);
        const field = e.target.dataset.field;
        let value = e.target.value;
        if (field === 'independent') value = e.target.checked;
        else if (field === 'share') value = e.target.value === '' ? null : (parseFloat(e.target.value) || 0);

        const state = this.store.getState();
        const board = [...(state.orgStructure?.boardOfDirectors || [])];

        if (board[idx]) {
            board[idx] = { ...board[idx], [field]: value };
            this.store.update('orgStructure', { ...state.orgStructure, boardOfDirectors: board });
        }
    }

    addBoardMember() {
        const state = this.store.getState();
        const board = [...(state.orgStructure?.boardOfDirectors || [])];
        board.push({ name: '', position: 'member', share: null, independent: false, committees: '' });
        this.store.update('orgStructure', { ...state.orgStructure, boardOfDirectors: board });
        this.render();
    }

    removeBoardMember(e) {
        const idx = parseInt(e.target.dataset.idx);
        const state = this.store.getState();
        const board = (state.orgStructure?.boardOfDirectors || []).filter((_, i) => i !== idx);
        this.store.update('orgStructure', { ...state.orgStructure, boardOfDirectors: board });
        this.render();
    }

    updateAdvisory(e) {
        const row = e.target.closest('tr');
        const idx = parseInt(row.dataset.idx);
        const field = e.target.dataset.field;
        const value = e.target.value;

        const state = this.store.getState();
        const advisors = [...(state.orgStructure?.advisoryBoard || [])];
        if (advisors[idx]) {
            advisors[idx] = { ...advisors[idx], [field]: value };
            this.store.update('orgStructure', { ...state.orgStructure, advisoryBoard: advisors });
        }
    }

    addAdvisoryMember() {
        const state = this.store.getState();
        const advisors = [...(state.orgStructure?.advisoryBoard || [])];
        advisors.push({ name: '', role: '' });
        this.store.update('orgStructure', { ...state.orgStructure, advisoryBoard: advisors });
        this.render();
    }

    removeAdvisoryMember(e) {
        const idx = parseInt(e.target.dataset.idx);
        const state = this.store.getState();
        const advisors = (state.orgStructure?.advisoryBoard || []).filter((_, i) => i !== idx);
        this.store.update('orgStructure', { ...state.orgStructure, advisoryBoard: advisors });
        this.render();
    }

    updateGovernanceField(e) {
        const field = e.target.dataset.field;
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

        const state = this.store.getState();
        const governance = { ...state.orgStructure?.governance, [field]: value };
        this.store.update('orgStructure', { ...state.orgStructure, governance });
    }

    updateSaudization(e) {
        const field = e.target.dataset.field;
        const value = ['currentPercentage', 'targetPercentage'].includes(field)
            ? parseFloat(e.target.value) || 0
            : e.target.value;

        const state = this.store.getState();
        const saudization = { ...state.orgStructure?.saudization, [field]: value };
        this.store.update('orgStructure', { ...state.orgStructure, saudization });
        this.render();
    }
}
