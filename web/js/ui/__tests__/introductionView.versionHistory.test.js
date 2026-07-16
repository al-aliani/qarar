/**
 * @vitest-environment jsdom
 *
 * سجل التغييرات في خطوة فرضية المشروع: يُستخرج فقط projectInfo.startupHypothesis
 * من سجل الإصدارات العام في store.js (getVersionHistory) — بلا فرق كامل للدراسة،
 * وبلا استدعاء restoreVersion(index) الذي يستبدل الدراسة كاملة (منتجات/أرقام مالية)
 * بنسخة قديمة. الاسترجاع هنا يكتب فقط startupHypothesis عبر store.update('projectInfo', ...).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('sweetalert2', () => ({
    default: { fire: vi.fn() }
}));

import Swal from 'sweetalert2';
import { IntroductionView } from '../IntroductionView.js';
import { createEmptyStudy } from '../../core/schema.js';

function fakeStore(state, history = []) {
    return {
        getState: () => state,
        get: () => state,
        update: vi.fn((section, value) => { state[section] = value; }),
        getVersionHistory: () => history
    };
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('IntroductionView — سجل التغييرات لفرضية المشروع', () => {
    beforeEach(() => {
        Swal.fire.mockReset();
    });

    it('يعرض رسالة "لا يوجد سجل" حين يكون سجل الإصدارات فارغاً، ودون أزرار استرجاع', () => {
        document.body.innerHTML = '<div id="c"></div>';
        const state = createEmptyStudy();
        const view = new IntroductionView('c', fakeStore(state, []), () => {});
        view.render(5);

        const panel = document.querySelector('.version-history-panel');
        expect(panel).toBeTruthy();
        expect(panel.textContent).toContain('لا يوجد سجل تغييرات بعد');
        expect(document.querySelectorAll('.btn-restore-hypothesis')).toHaveLength(0);
    });

    it('يستخرج فقط problem/solution/insight من كل نسخة، متجاهلاً بقية حالة الدراسة المخزّنة في تلك النسخة', () => {
        document.body.innerHTML = '<div id="c"></div>';
        const state = createEmptyStudy();
        state.projectInfo.startupHypothesis = { problem: 'الحالي', solution: 'حل حالي', insight: 'سبب حالي' };

        const history = [
            {
                timestamp: '2026-07-10T10:00:00.000Z',
                state: {
                    projectInfo: { startupHypothesis: { problem: 'مشكلة قديمة', solution: 'حل قديم', insight: 'سبب قديم' } },
                    // بيانات أخرى في نفس النسخة يجب ألا تظهر في هذه اللوحة (لا فرق كامل للدراسة)
                    revenue: { streams: [{ service: 'خدمة قديمة', avgPrice: 999 }] }
                }
            }
        ];
        const view = new IntroductionView('c', fakeStore(state, history), () => {});
        view.render(5);

        const panelText = document.querySelector('.version-history-panel').textContent;
        expect(panelText).toContain('مشكلة قديمة');
        expect(panelText).toContain('حل قديم');
        expect(panelText).toContain('سبب قديم');
        expect(panelText).not.toContain('خدمة قديمة');
        expect(document.querySelectorAll('.btn-restore-hypothesis')).toHaveLength(1);
    });

    it('الاسترجاع بعد التأكيد يكتب فرضية النسخة القديمة فقط عبر store.update، دون لمس بقية الحالة الحالية', async () => {
        document.body.innerHTML = '<div id="c"></div>';
        const state = createEmptyStudy();
        state.projectInfo.name = 'مشروعي الحالي';
        state.projectInfo.startupHypothesis = { problem: 'الحالي', solution: 'حل حالي', insight: 'سبب حالي' };
        state.revenue.streams = [{ service: 'خدمة حالية', avgPrice: 100 }];

        const history = [
            {
                timestamp: '2026-07-10T10:00:00.000Z',
                state: {
                    projectInfo: {
                        name: 'اسم قديم لن يُستخدم',
                        startupHypothesis: { problem: 'مشكلة قديمة', solution: 'حل قديم', insight: 'سبب قديم' }
                    },
                    revenue: { streams: [{ service: 'خدمة قديمة يجب ألا تُستعاد', avgPrice: 1 }] }
                }
            }
        ];
        const store = fakeStore(state, history);
        const view = new IntroductionView('c', store, () => {});
        view.render(5);

        Swal.fire.mockResolvedValue({ isConfirmed: true });
        document.querySelector('.btn-restore-hypothesis').click();
        await flushPromises();

        expect(store.update).toHaveBeenCalledWith('projectInfo', expect.objectContaining({
            name: 'مشروعي الحالي', // لم يتغيّر رغم أن النسخة القديمة فيها اسم مختلف
            startupHypothesis: { problem: 'مشكلة قديمة', solution: 'حل قديم', insight: 'سبب قديم' }
        }));
        // القسم الآخر (الإيرادات) لم يُلمس إطلاقاً — الاسترجاع محصور بـ startupHypothesis فقط
        expect(state.revenue.streams).toEqual([{ service: 'خدمة حالية', avgPrice: 100 }]);
    });

    it('إلغاء نافذة التأكيد لا يُغيّر شيئاً', async () => {
        document.body.innerHTML = '<div id="c"></div>';
        const state = createEmptyStudy();
        state.projectInfo.startupHypothesis = { problem: 'الحالي', solution: 'حل حالي', insight: 'سبب حالي' };
        const history = [{
            timestamp: '2026-07-10T10:00:00.000Z',
            state: { projectInfo: { startupHypothesis: { problem: 'قديم', solution: 'قديم', insight: 'قديم' } } }
        }];
        const store = fakeStore(state, history);
        const view = new IntroductionView('c', store, () => {});
        view.render(5);

        Swal.fire.mockResolvedValue({ isConfirmed: false });
        document.querySelector('.btn-restore-hypothesis').click();
        await flushPromises();

        expect(store.update).not.toHaveBeenCalled();
        expect(state.projectInfo.startupHypothesis.problem).toBe('الحالي');
    });
});
