/**
 * @vitest-environment jsdom
 *
 * زر «تقدير تلقائي» لتكلفة الفكرة (ميزة 2026-07-16، مقارنة الأفكار):
 * يكتشف قطاع الفكرة من اسمها/ملاحظتها (sectorBenchmarks.detectSectorBenchmark) ويقترح
 * تكلفة استرشادية بدل الاعتماد على الإدخال اليدوي البحت السابق. يجب ألا يستبدل تكلفة
 * أدخلها المستخدم فعلياً دون تأكيد صريح، ويجب أن يظهر وسم «تقدير تلقائي» على القيمة الناتجة.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));

const { ProjectAlternativesView } = await import('../ProjectAlternativesView.js');
const Swal = (await import('sweetalert2')).default;

function fakeStore(initialState) {
    let state = initialState;
    return {
        getState: () => state,
        get: () => state,
        update: (section, value) => { state = { ...state, [section]: value }; },
        updatePath: (section, path, value) => { if (!path) state = { ...state, [section]: value }; },
        notify: () => {}
    };
}

async function flush() {
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
}

describe('ProjectAlternativesView — زر تقدير تلقائي لتكلفة الفكرة', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        Swal.fire.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('يملأ تكلفة معقولة لفكرة بقطاع قابل للاكتشاف دون طلب تأكيد (لا تكلفة سابقة)', async () => {
        const state = {
            projectAlternatives: {
                ideas: [{ name: 'مطعم شرقي صغير', estimatedCost: 0, estimatedReturn: 0, risk: 'medium', notes: '' }],
                selectedIndex: 0
            }
        };
        const store = fakeStore(state);
        const view = new ProjectAlternativesView('c', store, null);
        view.render();

        const btn = document.querySelector('.pa-estimate[data-idx="0"]');
        expect(btn).toBeTruthy();
        btn.click();
        await flush();

        expect(Swal.fire).not.toHaveBeenCalled();
        const idea = store.getState().projectAlternatives.ideas[0];
        // القيمة تقديرية استرشادية (انظر estimateIdeaCost) — نفحص أنها معقولة الحجم لا رقماً دقيقاً بعينه
        expect(idea.estimatedCost).toBeGreaterThan(50000);
        expect(idea.estimatedCost).toBeLessThan(2000000);
        expect(idea.costIsEstimated).toBe(true);

        const badge = document.querySelector('.pa-estimate-badge');
        expect(badge).toBeTruthy();
        expect(badge.textContent).toContain('تقدير تلقائي');
    });

    it('لا يستبدل تكلفة مُدخلة مسبقاً بصمت — يطلب تأكيداً، وعند الرفض تبقى كما هي', async () => {
        const state = {
            projectAlternatives: {
                ideas: [{ name: 'مقهى مختص', estimatedCost: 250000, estimatedReturn: 90000, risk: 'medium', notes: '' }],
                selectedIndex: 0
            }
        };
        const store = fakeStore(state);
        Swal.fire.mockResolvedValueOnce({ isConfirmed: false });
        const view = new ProjectAlternativesView('c', store, null);
        view.render();

        const btn = document.querySelector('.pa-estimate[data-idx="0"]');
        btn.click();
        await flush();

        expect(Swal.fire).toHaveBeenCalledTimes(1);
        const idea = store.getState().projectAlternatives.ideas[0];
        expect(idea.estimatedCost).toBe(250000);
        expect(idea.costIsEstimated).toBeFalsy();
    });

    it('يستبدل التكلفة السابقة فقط عند تأكيد المستخدم صراحة', async () => {
        const state = {
            projectAlternatives: {
                ideas: [{ name: 'مقهى مختص', estimatedCost: 250000, estimatedReturn: 90000, risk: 'medium', notes: '' }],
                selectedIndex: 0
            }
        };
        const store = fakeStore(state);
        Swal.fire.mockResolvedValueOnce({ isConfirmed: true });
        const view = new ProjectAlternativesView('c', store, null);
        view.render();

        const btn = document.querySelector('.pa-estimate[data-idx="0"]');
        btn.click();
        await flush();

        expect(Swal.fire).toHaveBeenCalledTimes(1);
        const idea = store.getState().projectAlternatives.ideas[0];
        expect(idea.estimatedCost).not.toBe(250000);
        expect(idea.estimatedCost).toBeGreaterThan(0);
        expect(idea.costIsEstimated).toBe(true);
    });

    it('تعديل يدوي للتكلفة بعد التقدير يُسقط وسم «تقدير تلقائي»', () => {
        const state = {
            projectAlternatives: {
                ideas: [{ name: 'مطعم شرقي صغير', estimatedCost: 296000, estimatedReturn: 0, risk: 'medium', notes: '', costIsEstimated: true }],
                selectedIndex: 0
            }
        };
        const store = fakeStore(state);
        const view = new ProjectAlternativesView('c', store, null);
        view.render();

        expect(document.querySelector('.pa-estimate-badge')).toBeTruthy();

        const row = document.querySelector('#alternativesBody tr[data-idx="0"]');
        const costInput = row.querySelector('[data-field="estimatedCost"]');
        costInput.value = '123,456';
        costInput.dispatchEvent(new Event('change', { bubbles: true }));

        const idea = store.getState().projectAlternatives.ideas[0];
        expect(idea.estimatedCost).toBe(123456);
        expect(idea.costIsEstimated).toBe(false);
    });
});
