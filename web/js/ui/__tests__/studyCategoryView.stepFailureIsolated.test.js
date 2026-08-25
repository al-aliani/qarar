/**
 * @vitest-environment jsdom
 *
 * انحدار 2026-08-26 (نمط هشاشة بنيوي): حلقة رسم أقسام التصنيف كانت تنتظر
 * renderStepInto «عارية» بلا try/catch، ومستدعيها navigateToCategory (app.js)
 * بلا try/catch أيضاً — فرميةٌ واحدة من خطوة واحدة (مثلاً «مقارنة الأفكار»
 * حين يفشل جلب القائمة السحابية) كانت تكسر الحلقة وتترك بقية خطوات التصنيف
 * غير مرسومة إطلاقاً وبلا أي رسالة.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SIDEBAR_SECTIONS, STEPS } from '../../core/wizardSteps.js';
import { StudyCategoryView } from '../StudyCategoryView.js';

const CLOUD_ERROR = 'تعذّر الوصول إلى دراساتك السحابية — تحقق من الاتصال وأعد المحاولة';

describe('StudyCategoryView — فشل خطوة واحدة لا يُسقط بقية التصنيف', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="wizardContainer"></main>';
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    it('خطوة «مقارنة الأفكار» ترمي: باقي الخطوات الست تُرسم، والفاشلة تعرض رسالة', async () => {
        const view = new StudyCategoryView('wizardContainer', {}, {}, {
            steps: STEPS,
            categories: SIDEBAR_SECTIONS,
            onNavigateCategory: vi.fn()
        });

        const renderedIndexes = [];
        vi.spyOn(view, 'renderStepInto').mockImplementation(async (index) => {
            if (index === 1) throw new Error(CLOUD_ERROR);
            renderedIndexes.push(index);
        });

        await expect(view.render(0)).resolves.toBe(true);

        // التصنيف الأول = الخطوات 0..6؛ الفشل في 1 لا يمنع 2..6
        expect(renderedIndexes).toEqual([0, 2, 3, 4, 5, 6]);
        expect(document.getElementById('category-step-content-1').textContent).toContain('تعذّر عرض هذا القسم');
    });
});
