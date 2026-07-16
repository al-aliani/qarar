/**
 * @vitest-environment jsdom
 *
 * تحديث حي للسلايدرات في محاكاة التشغيل (OperationalSim.js) — مهمة C، دفعة 4:
 * تحريك أي سلايدر (arrivalRate/serviceTime/servers/peakFactor) يُحدّث لوحات النتائج
 * فوراً (بعد تأخير خفيف 150ms) بلا حاجة لزر «تشغيل المحاكاة»، والزر يبقى يعمل
 * ويُثبّت (commit) النتيجة في المخزن كسابقاً + يرسم القماش.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OperationalSim } from '../OperationalSim.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {}, updatePath: () => {} };
}

describe('OperationalSim — تحديث حي عند سحب السلايدرات (مهمة C)', () => {
    let activeView = null;
    let originalGetContext;

    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        activeView = null;
        originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = () => ({
            clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {}
        });
    });
    afterEach(() => {
        if (activeView?.simInterval) clearInterval(activeView.simInterval);
        HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    it('تحريك سلايدر عدد الموظفين يُحدّث النتائج المعروضة بلا نقر زر التشغيل', async () => {
        const state = { operational: { arrivalRate: 100, serviceTime: 5, servers: 2 } };
        const view = new OperationalSim('root', fakeStore(state), null);
        activeView = view;
        view.render(0);

        expect(document.getElementById('resWaitTime').textContent).toBe('-- دقيقة');
        expect(document.getElementById('simResults').style.opacity).toBe('0.5');

        const serversInput = document.getElementById('servers');
        serversInput.value = '9';
        serversInput.dispatchEvent(new Event('input'));

        // لم تتحدّث فوراً (قبل انتهاء التأخير الخفيف)
        expect(document.getElementById('resWaitTime').textContent).toBe('-- دقيقة');

        await new Promise(r => setTimeout(r, 200));

        expect(document.getElementById('resWaitTime').textContent).not.toBe('-- دقيقة');
        expect(document.getElementById('simResults').style.opacity).toBe('1');
        // لا رسم/بدء رسوم متحركة عند التحديث الحي فقط (يبقى محصوراً بزر التشغيل)
        expect(document.getElementById('simOverlay').style.display).not.toBe('none');
    });

    it('سحب سريع متكرر (عدة أحداث input) يُنتج تحديثاً واحداً مؤجَّلاً لا حساباً لكل حركة', async () => {
        const state = { operational: { arrivalRate: 30, serviceTime: 5, servers: 2 } };
        const view = new OperationalSim('root', fakeStore(state), null);
        activeView = view;
        view.render(0);

        const spy = vi.spyOn(view, 'computeQueueStats');
        const arrivalInput = document.getElementById('arrivalRate');
        for (let v = 10; v <= 50; v += 10) {
            arrivalInput.value = String(v);
            arrivalInput.dispatchEvent(new Event('input'));
        }
        expect(spy).not.toHaveBeenCalled();

        await new Promise(r => setTimeout(r, 200));

        // مرة واحدة فقط (متوسط + ذروة = استدعاءان)، لا 5 مرات لكل حركة سحب
        expect(spy).toHaveBeenCalledTimes(2);
        spy.mockRestore();
    });

    it('زر «تشغيل المحاكاة» لا يزال يعمل ويُثبّت (commit) النتيجة في المخزن، ويرسم القماش', () => {
        let saved = null;
        const state = { operational: { arrivalRate: 30, serviceTime: 5, servers: 2 } };
        const store = {
            getState: () => state, get: () => state,
            update: (key, value) => { if (key === 'operational') saved = value; },
            updatePath: () => {}
        };
        const view = new OperationalSim('root', store, null);
        activeView = view;
        view.render(0);

        document.getElementById('btnRunSim').click();

        expect(saved).toBeTruthy();
        expect(saved.lastResult).toBeTruthy();
        expect(document.getElementById('simOverlay').style.display).toBe('none');
    });
});
