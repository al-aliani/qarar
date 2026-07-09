/**
 * @vitest-environment jsdom
 *
 * إصلاح: عتبة "استرداد طويل" في ProjectAlternativesView كانت ثابتة (7 سنوات) بصرف
 * النظر عن حجم الاستثمار. الآن تتدرّج مع حجم التكلفة (longPaybackThreshold):
 *   cost < 500,000        → 5 سنوات
 *   500,000 ≤ cost < 2M    → 7 سنوات
 *   cost ≥ 2,000,000       → 9 سنوات
 *
 * سيناريوهات تمييزية (لا يمكن أن تنجح بالصدفة تحت الثابت القديم):
 *  - مشروع كبير (تكلفة 3,000,000، استرداد 8 سنوات): تحت الثابت القديم (7) كان
 *    سيُعلَّم "طويل" رغم أن 8 سنوات دورة طبيعية لمشروع بهذا الحجم (فرنشايز/سلسلة).
 *    بعد الإصلاح (عتبة 9 لهذا الحجم) يجب ألا يظهر التحذير.
 *  - مشروع صغير (تكلفة 300,000، استرداد 6 سنوات): تحت الثابت القديم (7) لم يكن
 *    يُعلَّم "طويل" رغم أن 6 سنوات استرداد طويلة جداً لمشروع صغير كهذا.
 *    بعد الإصلاح (عتبة 5 لهذا الحجم) يجب أن يظهر التحذير.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const { ProjectAlternativesView } = await import('../ProjectAlternativesView.js');

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {}, updatePath: () => {}, notify: () => {} };
}

describe('ProjectAlternativesView — عتبة استرداد طويل متدرّجة مع حجم الاستثمار', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('_computeMetrics يُعيد cost ضمن كل مقياس صالح (مطلوب لحساب العتبة المتدرجة)', () => {
        const state = { projectAlternatives: { ideas: [], selectedIndex: 0 } };
        const view = new ProjectAlternativesView('c', fakeStore(state), null);
        const ideas = [
            { name: 'مشروع', estimatedCost: 1000000, estimatedReturn: 200000, risk: 'medium', notes: '' }
        ];
        const { metrics } = view._computeMetrics(ideas);
        expect(metrics[0].valid).toBe(true);
        expect(metrics[0].cost).toBe(1000000);
    });

    it('مشروع كبير باسترداد 8 سنوات لا يُعلَّم "طويل" (العتبة لحجمه 9، لا 7 الثابتة القديمة)', () => {
        const state = {
            projectAlternatives: {
                ideas: [
                    // تكلفة 3,000,000 (>= 2M) → عتبة 9 سنوات. عائد 375,000 → استرداد = 8 سنوات (8 <= 9، لا تحذير)
                    { name: 'فرنشايز كبير', estimatedCost: 3000000, estimatedReturn: 375000, risk: 'medium', notes: '' }
                ],
                selectedIndex: 0
            }
        };
        const view = new ProjectAlternativesView('c', fakeStore(state), null);
        view.render();
        const row = document.querySelector('#alternativesBody tr[data-idx="0"]');
        const calcCell = row.querySelectorAll('.pa-calc')[0];

        expect(calcCell.textContent).toContain('8.0 سنة');
        expect(calcCell.querySelector('.pa-flag--warn')).toBeNull();
    });

    it('مشروع صغير باسترداد 6 سنوات يُعلَّم "طويل" (العتبة لحجمه 5، أدنى من 7 الثابتة القديمة)', () => {
        const state = {
            projectAlternatives: {
                ideas: [
                    // تكلفة 300,000 (< 500K) → عتبة 5 سنوات. عائد 50,000 → استرداد = 6 سنوات (6 > 5، تحذير)
                    { name: 'مقهى صغير', estimatedCost: 300000, estimatedReturn: 50000, risk: 'medium', notes: '' }
                ],
                selectedIndex: 0
            }
        };
        const view = new ProjectAlternativesView('c', fakeStore(state), null);
        view.render();
        const row = document.querySelector('#alternativesBody tr[data-idx="0"]');
        const calcCell = row.querySelectorAll('.pa-calc')[0];

        expect(calcCell.textContent).toContain('6.0 سنة');
        expect(calcCell.querySelector('.pa-flag--warn')).not.toBeNull();
        expect(calcCell.textContent).toContain('طويل');
    });

    it('_refreshCalc (إعادة الحساب الحية دون إعادة رسم) يطبّق نفس العتبة المتدرجة', () => {
        // ابدأ بمشروع كبير بلا تحذير، ثم بدّل القيم مباشرة في الـ DOM إلى مشروع صغير
        // بمعطيات تُفعّل التحذير تحت العتبة الجديدة، واستدعِ _refreshCalc (مسار الاستخدام الثاني للعتبة).
        const state = {
            projectAlternatives: {
                ideas: [
                    { name: 'مشروع', estimatedCost: 3000000, estimatedReturn: 375000, risk: 'medium', notes: '' }
                ],
                selectedIndex: 0
            }
        };
        const view = new ProjectAlternativesView('c', fakeStore(state), null);
        view.render();

        const row = document.querySelector('#alternativesBody tr[data-idx="0"]');
        row.querySelector('[data-field="estimatedCost"]').value = '300,000';
        row.querySelector('[data-field="estimatedReturn"]').value = '50,000';

        view._refreshCalc();

        const calcCell = row.querySelectorAll('.pa-calc')[0];
        expect(calcCell.textContent).toContain('6.0 سنة');
        expect(calcCell.querySelector('.pa-flag--warn')).not.toBeNull();
    });
});
