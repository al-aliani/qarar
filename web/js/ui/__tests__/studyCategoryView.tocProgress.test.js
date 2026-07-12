/**
 * @vitest-environment jsdom
 *
 * بند 2.3: عدّاد «أنجزت X من Y» داخل .category-toc (من progressTracker الحي الموجود
 * أصلاً في app.js) + scroll-spy بـIntersectionObserver مع فصل المراقب القديم عند كل
 * إعادة render حتى لا تتراكم عدة مراقبات حية معاً.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SIDEBAR_SECTIONS, STEPS } from '../../core/wizardSteps.js';
import { StudyCategoryView } from '../StudyCategoryView.js';

// محاكاة بسيطة لـIntersectionObserver غير المتوفر في jsdom افتراضياً — تسجّل النسخ
// المُنشأة والمفصولة كي نتحقق من عدم تراكمها.
class FakeIntersectionObserver {
    constructor(callback) {
        this.callback = callback;
        this.observed = [];
        this.disconnected = false;
        FakeIntersectionObserver.instances.push(this);
    }
    observe(el) { this.observed.push(el); }
    disconnect() { this.disconnected = true; }
}
FakeIntersectionObserver.instances = [];

function fakeProgressTracker(completedIndexes) {
    const completed = new Set(completedIndexes);
    return { isCompleted: (index) => completed.has(index) };
}

describe('StudyCategoryView — عدّاد التقدم وscroll-spy', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="wizardContainer"></main>';
        FakeIntersectionObserver.instances = [];
        global.IntersectionObserver = FakeIntersectionObserver;
    });

    function createView(options = {}) {
        const onNavigateCategory = vi.fn();
        const view = new StudyCategoryView('wizardContainer', {}, {}, {
            steps: STEPS,
            categories: SIDEBAR_SECTIONS,
            onNavigateCategory,
            ...options
        });
        vi.spyOn(view, 'renderStepInto').mockResolvedValue();
        return view;
    }

    it('بلا progressTracker: لا يُعرض عدّاد إطلاقاً (لا «0 من N» مضلِّل)', async () => {
        const view = createView();
        await view.render(0);
        expect(document.querySelector('.category-toc__progress')).toBeNull();
    });

    it('مع progressTracker: يعرض عدد الأقسام المكتملة ضمن هذا التصنيف تحديداً', async () => {
        // التصنيف 0 يغطي الأقسام 0..6 (7 أقسام) — نكمل ثلاثة منها فقط.
        const tracker = fakeProgressTracker([0, 2, 6]);
        const view = createView({ progressTracker: tracker });
        await view.render(0);
        const progressEl = document.querySelector('.category-toc__progress');
        expect(progressEl).not.toBeNull();
        expect(progressEl.textContent).toContain('٣');
        expect(progressEl.textContent).toContain('٧');
    });

    it('لا يحسب اكتمال تصنيف آخر ضمن عدّاد هذا التصنيف', async () => {
        // إكمال قسم من تصنيف آخر (مثلاً الفهرس 30) لا يجب أن يُحتسب ضمن تصنيف 0 (0..6).
        const tracker = fakeProgressTracker([30]);
        const view = createView({ progressTracker: tracker });
        await view.render(0);
        const progressEl = document.querySelector('.category-toc__progress');
        expect(progressEl.querySelector('strong').textContent).toBe('٠');
    });

    it('scroll-spy: يراقب كل قسم ويُفصَل المراقب القديم عند إعادة render دون تراكم', async () => {
        const view = createView();
        await view.render(0);
        expect(FakeIntersectionObserver.instances).toHaveLength(1);
        const first = FakeIntersectionObserver.instances[0];
        expect(first.observed.length).toBe(7); // أقسام التصنيف الأول السبعة
        expect(first.disconnected).toBe(false);

        await view.render(1);
        expect(first.disconnected).toBe(true); // المراقب القديم فُصل
        expect(FakeIntersectionObserver.instances).toHaveLength(2);
        expect(FakeIntersectionObserver.instances[1].disconnected).toBe(false);
    });

    it('لا يرمي خطأ إذا كان IntersectionObserver غير متوفر في البيئة', async () => {
        delete global.IntersectionObserver;
        const view = createView();
        await expect(view.render(0)).resolves.toBe(true);
    });
});
