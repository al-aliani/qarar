/**
 * @vitest-environment jsdom
 *
 * دفعة 6: زر «تطبيق الاقتراح» في محاكاة التشغيل والازدحام (OperationalSim.js) كان يوحي
 * بأنه يطبّق عدد الموظفين المقترح فعلياً على خطة التوظيف/الرواتب في الدراسة (state.hr.positions)،
 * بينما هو فعلياً محلي بالكامل لهذه الشاشة (queueing simulation) ولا يكتب إلى hr.positions
 * إطلاقاً — موثَّق فقط بتعليق في schema.js دون أي إشعار مرئي للمستخدم. هذا الاختبار يثبّت:
 * 1) وجود ملاحظة إفصاح مرئية بجانب نتائج المحاكاة توضّح أنها استرشادية ولا تُحدّث خطة التوظيف
 *    الفعلية تلقائياً.
 * 2) أن نص الزر لم يعد يوحي بتطبيق تلقائي فعلي («تطبيق الاقتراح»).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OperationalSim } from '../OperationalSim.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {} };
}

describe('OperationalSim — إفصاح الاستشارية وعدم تطبيق الاقتراح تلقائياً (دفعة 6)', () => {
    // animateDots() تستدعي canvas.getContext('2d') غير المتوفر فعلياً في jsdom (بلا حزمة
    // canvas)، فنموّه بكائن وهمي بلا عمليات — لا علاقة له بمنطق الإفصاح قيد الاختبار هنا،
    // والغرض فقط منع استثناءات setInterval غير مُعالَجة تُسمِّم بقية مجموعة الاختبارات.
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

    it('يعرض ملاحظة إفصاح مرئية دائمة بأن المحاكاة استرشادية ولا تُحدّث خطة التوظيف/الرواتب الفعلية', () => {
        const state = { operational: { arrivalRate: 30, serviceTime: 5, servers: 2 } };
        const view = new OperationalSim('root', fakeStore(state), null);
        activeView = view;
        view.render(0);

        const html = document.getElementById('root').innerHTML;
        // إفصاح واضح عن الطابع الاستشاري/الاستكشافي للأداة
        expect(html).toMatch(/استرشادي/);
        // وأنها لا تحدّث تلقائياً خطة التوظيف/الرواتب الفعلية في الدراسة
        expect(html).toMatch(/لا تُحدّث تلقائياً/);
        expect(html).toMatch(/الموارد البشرية/);
    });

    it('عند ظهور اقتراح تعيين موظفين، لم يعد نص الزر «تطبيق الاقتراح» الموحي بتطبيق فعلي تلقائي', () => {
        const state = { operational: { arrivalRate: 100, serviceTime: 5, servers: 9 } };
        const view = new OperationalSim('root', fakeStore(state), null);
        activeView = view;
        view.render(0);

        // معاملات تُنتج نظاماً مستقراً (rho<1) لكن بوقت انتظار > 5 دقائق فيظهر زر الاقتراح
        view.runSimulation({ arrivalRate: 100, serviceTime: 5, servers: 9 });

        const alertHtml = document.getElementById('simAlert').innerHTML;
        expect(alertHtml).toContain('id="btnApplyOptim"');
        expect(alertHtml).not.toContain('>تطبيق الاقتراح<');
        // النص الجديد لا يوحي بتطبيق تلقائي على خطة التوظيف الفعلية
        expect(alertHtml).not.toMatch(/^تطبيق /);
    });

    it('زر الاقتراح لا يزال يُعيد تشغيل المحاكاة محلياً بالرقم المقترح (لا يكتب لأي حالة خارج هذه الشاشة)', async () => {
        const state = { operational: { arrivalRate: 100, serviceTime: 5, servers: 9 } };
        let savedOperational = null;
        const store = {
            getState: () => state,
            get: () => state,
            update: (key, value) => { if (key === 'operational') savedOperational = value; }
        };
        const view = new OperationalSim('root', store, null);
        activeView = view;
        view.render(0);
        view.runSimulation({ arrivalRate: 100, serviceTime: 5, servers: 9 });

        const btn = document.getElementById('btnApplyOptim');
        expect(btn).toBeTruthy();

        // ننتظر ربط الحدث المؤجَّل (setTimeout 100ms) قبل المحاكاة
        await new Promise(r => setTimeout(r, 150));
        btn.click();

        // لا يزال يحفظ فقط في شريحة "operational" المحلية، وليس في hr.positions
        expect(savedOperational).toBeTruthy();
        expect(savedOperational.servers).not.toBe(undefined);
        expect(state.hr).toBeUndefined();
    });
});
