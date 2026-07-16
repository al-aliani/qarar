/**
 * @vitest-environment jsdom
 *
 * زر «طبّق التوصية» في محاكاة التشغيل (OperationalSim.js) — مهمة B، دفعة 4: يكتب
 * عدد نقاط الخدمة الموصى بها (state.operational.lastResult.recommendedServers) إلى
 * صف وظيفة مُختار صراحة (قائمة منسدلة، لا تخمين) في hr.positions، بعد تأكيد صريح
 * (confirm) إن كان للصف عدد حالي غير صفري. هذا منفصل تماماً عن زر «جرّب هذا الرقم
 * هنا» المحلي القائم (btnApplyOptim) الذي يبقى لا يكتب لأي حالة خارج هذه الشاشة
 * (راجع batch6.operationalSimDisclosure.test.js).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OperationalSim } from '../OperationalSim.js';

function makeStore(initialState) {
    let state = initialState;
    return {
        getState: () => state,
        get: () => state,
        update: (section, data) => {
            state = { ...state, [section]: { ...(state[section] || {}), ...data } };
        },
        updatePath: (section, path, value) => {
            state = { ...state, [section]: { ...(state[section] || {}), [path]: value } };
        }
    };
}

describe('OperationalSim — زر «طبّق التوصية» على جدول الرواتب (مهمة B)', () => {
    let activeView = null;
    let originalGetContext;
    let originalConfirm;

    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        activeView = null;
        originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = () => ({
            clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {}
        });
        originalConfirm = window.confirm;
    });
    afterEach(() => {
        if (activeView?.simInterval) clearInterval(activeView.simInterval);
        HTMLCanvasElement.prototype.getContext = originalGetContext;
        window.confirm = originalConfirm;
    });

    function runToRecommendation(store) {
        const view = new OperationalSim('root', store, null);
        activeView = view;
        view.render(0);
        // معاملات تُنتج اقتراح توظيف (rho<1 لكن wait>5) — نفس معاملات batch6 disclosure
        view.runSimulation({ arrivalRate: 100, serviceTime: 5, servers: 9 });
        return view;
    }

    it('لا تظهر اللوحة قبل أي تشغيل للمحاكاة', () => {
        const store = makeStore({ operational: { arrivalRate: 30, serviceTime: 5, servers: 2 }, hr: { positions: [] } });
        const view = new OperationalSim('root', store, null);
        activeView = view;
        view.render(0);
        expect(document.getElementById('applyToHrPanel').innerHTML.trim()).toBe('');
    });

    it('تظهر دعوة لإضافة وظيفة إن كان جدول الرواتب فارغاً بعد ظهور توصية', () => {
        const store = makeStore({ operational: {}, hr: { positions: [] } });
        runToRecommendation(store);
        const panel = document.getElementById('applyToHrPanel');
        expect(panel.textContent).toMatch(/لا توجد وظائف/);
        expect(document.getElementById('btnApplyToHr')).toBeNull();
    });

    it('تكتب العدد الموصى به مباشرة إن كان عدد الوظيفة الحالي صفراً (بلا تأكيد)', () => {
        const confirmSpy = vi.fn(() => true);
        window.confirm = confirmSpy;
        const store = makeStore({
            operational: {},
            hr: { positions: [{ position: 'موظف استقبال', nationality: 'expat', count: 0, salary: 4000 }] }
        });
        runToRecommendation(store);

        const btn = document.getElementById('btnApplyToHr');
        expect(btn).toBeTruthy();
        btn.click();

        expect(confirmSpy).not.toHaveBeenCalled();
        const recommended = store.getState().operational.lastResult.recommendedServers;
        expect(store.getState().hr.positions[0].count).toBe(recommended);
    });

    it('تطلب تأكيداً قبل استبدال عدد حالي غير صفري، ولا تكتب إن أُلغي', () => {
        const confirmSpy = vi.fn(() => false);
        window.confirm = confirmSpy;
        const store = makeStore({
            operational: {},
            hr: { positions: [{ position: 'موظف استقبال', nationality: 'expat', count: 2, salary: 4000 }] }
        });
        runToRecommendation(store);

        const btn = document.getElementById('btnApplyToHr');
        btn.click();

        expect(confirmSpy).toHaveBeenCalledOnce();
        expect(store.getState().hr.positions[0].count).toBe(2); // لم يتغيّر
    });

    it('تكتب العدد الموصى به بعد تأكيد المستخدم لاستبدال عدد غير صفري', () => {
        const confirmSpy = vi.fn(() => true);
        window.confirm = confirmSpy;
        const store = makeStore({
            operational: {},
            hr: { positions: [{ position: 'موظف استقبال', nationality: 'expat', count: 2, salary: 4000 }] }
        });
        runToRecommendation(store);

        const btn = document.getElementById('btnApplyToHr');
        btn.click();

        expect(confirmSpy).toHaveBeenCalledOnce();
        const recommended = store.getState().operational.lastResult.recommendedServers;
        expect(store.getState().hr.positions[0].count).toBe(recommended);
    });

    it('تختار الصف الصحيح عبر القائمة المنسدلة حين توجد أكثر من وظيفة (لا تخمين صامت)', () => {
        const store = makeStore({
            operational: {},
            hr: {
                positions: [
                    { position: 'محاسب', nationality: 'saudi', count: 1, salary: 9000 },
                    { position: 'موظف استقبال', nationality: 'expat', count: 0, salary: 4000 }
                ]
            }
        });
        runToRecommendation(store);

        const select = document.getElementById('applyToHrSelect');
        expect(select.options.length).toBe(2);
        select.value = '1'; // موظف استقبال
        document.getElementById('btnApplyToHr').click();

        const recommended = store.getState().operational.lastResult.recommendedServers;
        expect(store.getState().hr.positions[1].count).toBe(recommended);
        expect(store.getState().hr.positions[0].count).toBe(1); // الصف الآخر لم يتأثر
    });
});
