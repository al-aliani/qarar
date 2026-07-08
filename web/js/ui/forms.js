/**
 * @deprecated غير مستخدم — المولّد الفعلي للنماذج هو ui/Wizard.js + ui/DynamicTable.js
 * لا تستورد هذا الملف؛ تسمياته مفاتيح إنجليزية خام بلا ترجمة.
 *
 * UI Form Generator
 * Dynamically binds Schema sections to HTML forms.
 */
import { SECTIONS } from '../core/schema.js';
import { store } from '../core/store.js';

export function renderInputForms(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const state = store.get();

    // Create Tabs for each section
    const tabsNav = document.createElement('nav');
    tabsNav.className = 'section-tabs';

    const tabsContent = document.createElement('div');
    tabsContent.className = 'section-content';

    const sections = Object.values(SECTIONS);
    sections.forEach((sectionKey, index) => {
        // Tab Button
        const btn = document.createElement('button');
        btn.textContent = formatSectionTitle(sectionKey);
        btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
        btn.onclick = (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`pane-${sectionKey}`).classList.add('active');
        };
        tabsNav.appendChild(btn);

        // Tab Pane
        const pane = document.createElement('div');
        pane.id = `pane-${sectionKey}`;
        pane.className = `tab-pane ${index === 0 ? 'active' : ''}`;
        pane.innerHTML = `<h3>${formatSectionTitle(sectionKey)}</h3>`;

        // Render fields for this section
        renderSectionFields(pane, sectionKey, state[sectionKey]);

        tabsContent.appendChild(pane);
    });

    container.appendChild(tabsNav);
    container.appendChild(tabsContent);
}

function formatSectionTitle(key) {
    const titles = {
        project_info: 'معلومات المشروع',
        technical: 'الدراسة الفنية (الأصول)',
        marketing: 'التسويق والمبيعات',
        hr: 'الموارد البشرية',
        operations: 'التشغيل والمنيو',
        financial: 'الهيكل المالي والتمويل',
        legal: 'التراخيص والقانونية',
        risk: 'المخاطر والحساسية'
    };
    return titles[key] || key;
}

function renderSectionFields(container, sectionKey, data) {
    if (!data) return;

    Object.keys(data).forEach(key => {
        const value = data[key];
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = key;
        wrapper.appendChild(label);

        let input;

        if (typeof value === 'boolean') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = value;
            input.onchange = (e) => store.updateSection(sectionKey, { [key]: e.target.checked });
        } else if (typeof value === 'number') {
            input = document.createElement('input');
            input.type = 'number';
            input.value = value;
            input.onchange = (e) => store.updateSection(sectionKey, { [key]: parseFloat(e.target.value) });
        } else if (typeof value === 'string') {
            input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            input.onchange = (e) => store.updateSection(sectionKey, { [key]: e.target.value });
        } else if (Array.isArray(value)) {
            input = document.createElement('div');
            input.className = 'array-info';
            input.textContent = `[Table: ${value.length} items]`;
        } else if (typeof value === 'object') {
            input = document.createElement('div');
            input.className = 'nested-group';
            renderSectionFields(input, sectionKey, value);
        }

        if (input) wrapper.appendChild(input);
        container.appendChild(wrapper);
    });
}
