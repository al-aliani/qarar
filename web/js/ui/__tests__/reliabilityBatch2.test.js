// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Wizard } from '../Wizard.js';
import { CentralAssumptionsView } from '../CentralAssumptionsView.js';
import { generateBusinessModel } from '../../services/InternalAIGenerator.js';

describe('دفعة الموثوقية الثانية', () => {
    it('يربط زري التراجع والإعادة بتاريخ store ويحدّث حالتهما', () => {
        const app = readFileSync(resolve(process.cwd(), 'app.js'), 'utf8');
        expect(app).toContain("document.getElementById('headerUndoStudy')");
        expect(app).toContain('await store.undo()');
        expect(app).toContain('await store.redo()');
        expect(app).toContain('store.subscribe(syncHistoryControls)');
    });

    it('يصحح الملكية الأجنبية في الويزارد إلى 100% قبل التخزين والعرض', () => {
        const field = { dataset: { key: 'foreignOwnershipRate' }, value: '101' };
        const updatePath = vi.fn();
        const wizard = Object.create(Wizard.prototype);
        wizard.store = { updatePath };
        wizard.container = { querySelectorAll: () => [field] };

        wizard.updateStore('assumptions', 'foreignOwnershipRate', 'number', '101', false);

        expect(updatePath).toHaveBeenCalledWith('assumptions', 'foreignOwnershipRate', 1);
        expect(field.value).toBe('100');
    });

    it('يصحح نسبة الملكية في لوحة المعايرة إلى النطاق نفسه', () => {
        const updatePath = vi.fn();
        const view = Object.create(CentralAssumptionsView.prototype);
        view.store = {
            getState: () => ({ assumptions: { foreignOwnershipRate: 0 } }),
            updatePath
        };
        const field = { value: '101' };

        view._commitPercentAssumption('foreignOwnershipRate', '101', field);

        expect(updatePath).toHaveBeenCalledWith('assumptions', 'foreignOwnershipRate', 1);
        expect(field.value).toBe('100');
    });

    it('لا يقترح فرعاً أو إيجاراً تلقائياً لمشروع منصة رقمية', () => {
        const model = generateBusinessModel({
            projectInfo: { name: 'منصة', concept: 'منصة إدارة رقمية', sector: 'تقنية وبرمجيات', description: 'خدمة سحابية للشركات', city: 'الرياض' },
            marketing: { campaigns: [] },
            technical: {}, hr: {}, revenue: {}, riskAnalysis: {}
        });

        expect(model.channels).toContain('المنصة الرقمية');
        expect(model.channels).not.toContain('الموقع الفعلي أو الفرع');
        expect(model.keyResources).toContain('البنية السحابية');
        expect(model.costStructure).not.toContain('إيجار');
    });

    it('يفصح سطح التصدير عن النسخ السحابية بنفس نص سياسة الخصوصية', () => {
        const source = readFileSync(resolve(process.cwd(), 'js/ui/ExportMenu.js'), 'utf8');
        expect(source).toContain('Excel وWord وPowerPoint');
        expect(source).toContain('مركز التنزيلات');
        expect(source).not.toContain('تُعالَج ملفات التصدير محلياً على جهازك، باستثناء');
    });
});
