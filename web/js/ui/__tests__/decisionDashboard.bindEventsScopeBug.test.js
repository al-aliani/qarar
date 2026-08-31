/**
 * @vitest-environment jsdom
 *
 * [مراجعة عدائية] خلل حرج: bindEvents(state, results) كانت تستقبل معاملين فقط، لكن
 * جسمها (حارس الاحتفال بالقرار) يستخدم `this.shouldCelebrateDecision(readiness,
 * financingDiagnostics)` — وreadiness/financingDiagnostics متغيّران محليّان داخل
 * render() فقط، لم يُمرَّرا إلى bindEvents إطلاقاً. النتيجة: ReferenceError غير محاط
 * بـtry/catch يُرمى بمجرد تحقّق canPlayConfetti (شرط يتحقق في كل متصفح حقيقي تقريباً؛
 * الشرط الوحيد المانع فعلياً في jsdom هو غياب سياق canvas 2D الحقيقي دون حزمة
 * `canvas`، لا فحص userAgent وحده). لأن الرمي غير محاط، تتوقف بقية bindEvents فوراً:
 * كل أزرار الحفظ/التصدير (Excel/PDF بنكي/نسخة احتياطية) المُسجَّلة بعد سطر الاحتفال
 * في ترتيب الكود لا تُربط أبداً، ولا announce()/bindStressTestSliders()/animateCounter()
 * التي تُستدعى بعد bindEvents() في render() (لأن الاستثناء يجعل وعد render() مرفوضاً).
 *
 * اختبارات decisionDashboard.confettiGating.test.js الموجودة تختبر shouldCelebrateDecision
 * مباشرة بمدخلات صريحة — لا تمرّ عبر bindEvents إطلاقاً فلا تكشف الخلل. بقية اختبارات
 * الملف (coherence/themeColor/engineVersionNotice/importRestoreNoLeak) تستدعي render()
 * الحقيقية لكن تحت jsdom القياسي حيث canPlayConfetti=false دائماً (لا سياق canvas حقيقي)،
 * فحارس قصر الدائرة (canPlayConfetti && ...) يمنع الوصول لسطر الاستثناء أصلاً — هذا بالضبط
 * سبب غياب أي فشل في كل الاختبارات الحالية رغم الخلل.
 *
 * هنا نُجبر canPlayConfetti=true فعلياً (سياق canvas 2D مزيَّف truthy + userAgent متصفح
 * حقيقي، لا jsdom) كي يصل التنفيذ فعلاً إلى سطر الاستثناء بالضبط — نفس الشرط الحقيقي في
 * DecisionDashboard.js، لا نسخة مبسَّطة منه.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('gridstack', () => ({ GridStack: { initAll: vi.fn() } }));
vi.mock('../../utils/toast.js', () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../utils/analytics.js', () => ({ trackEvent: vi.fn() }));

const { DecisionDashboard } = await import('../DecisionDashboard.js');
const { createEmptyStudy } = await import('../../core/schema.js');

/** دراسة تجتاز بوابتَي hasMinimumRevenueData/hasMinimumFinancialData بأقل بيانات ممكنة
 *  (نفس نمط decisionDashboard.engineVersionNotice.test.js). */
function minimalViableStudy() {
    const s = createEmptyStudy();
    s.projectInfo.name = 'مقهى تجريبي';
    s.revenue.streams = [{ service: 'قهوة', customersPerMonth: 200, avgPrice: 20, type: 'operating' }];
    s.hr.positions = [{ position: 'باريستا', count: 1, salary: 4000, months: 12, nationality: 'saudi' }];
    return s;
}

function makeStore(state) {
    return { getState: () => state, updateSectionInMemory: vi.fn(), update: vi.fn() };
}

/** يجبر canPlayConfetti=true فعلياً: userAgent متصفح حقيقي (لا jsdom) + سياق canvas 2D
 *  مزيَّف truthy (jsdom القياسي بلا حزمة `canvas` يُعيد null من getContext('2d')، وهو ما
 *  كان يخفي الخلل ضمناً في كل اختبارات الملف الأخرى — لا نعتمد على هذا الإخفاء هنا). */
function forceCanPlayConfetti() {
    const realUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    Object.defineProperty(navigator, 'userAgent', { value: realUA, configurable: true });

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (type === '2d') return {};
        return originalGetContext ? originalGetContext.call(this, type, ...rest) : null;
    };
    return () => {
        delete navigator.userAgent;
        HTMLCanvasElement.prototype.getContext = originalGetContext;
    };
}

describe('DecisionDashboard.bindEvents — readiness/financingDiagnostics يجب أن يصلا فعلياً (لا ReferenceError)', () => {
    let restore;

    beforeEach(() => {
        document.body.innerHTML = '<div id="dd"></div>';
        restore = forceCanPlayConfetti();
    });

    afterEach(() => {
        restore();
    });

    it('render() تكتمل بلا استثناء حين canPlayConfetti=true (الشرط الحقيقي في كل متصفح تقريباً)', async () => {
        const state = minimalViableStudy();
        const store = makeStore(state);
        const dd = new DecisionDashboard('dd', store, null);

        await expect(dd.render()).resolves.toBe(true);
    });

    it('shouldCelebrateDecision تُستدعى بكائنَي readiness/financingDiagnostics حقيقيين، لا undefined', async () => {
        const state = minimalViableStudy();
        const store = makeStore(state);
        const dd = new DecisionDashboard('dd', store, null);
        const spy = vi.spyOn(dd, 'shouldCelebrateDecision');

        await expect(dd.render()).resolves.toBe(true);

        expect(spy).toHaveBeenCalledTimes(1);
        const [readinessArg, financingArg] = spy.mock.calls[0];
        // شكل readiness الحقيقي من calculateReadiness — لا undefined كما كان يحدث قبل
        // الإصلاح (كان الاستثناء يُرمى قبل الوصول لهذا الاستدعاء أصلاً).
        expect(readinessArg).toBeTruthy();
        expect(typeof readinessArg.recommendation?.status).toBe('string');
        expect(readinessArg.dimensions).toBeTruthy();
        // شكل financingDiagnostics الحقيقي من buildFinancingDiagnostics.
        expect(financingArg).toBeTruthy();
        expect(typeof financingArg.hasBlockers).toBe('boolean');
    });

    it('أزرار الحفظ/التصدير الرئيسية (بعد سطر الاحتفال في ترتيب الكود) مرتبطة فعلياً بحدث النقر', async () => {
        const state = minimalViableStudy();
        const store = makeStore(state);
        const dd = new DecisionDashboard('dd', store, null);

        await dd.render();

        const boundIds = dd._eventListeners.map((l) => l.element?.id).filter(Boolean);
        // الثلاثة هذه مُسجَّلة في bindEvents بعد سطر «حارس الاحتفال» مباشرة في ترتيب
        // الكود — لو رُمي الاستثناء هناك (الخلل قبل الإصلاح) لَما وصل التنفيذ إليها أبداً.
        expect(boundIds, `الأزرار المرتبطة فعلياً: ${JSON.stringify(boundIds)}`).toEqual(
            expect.arrayContaining(['btnSaveStudy', 'btnExportPDF', 'btnExportExcel'])
        );
    });

    it('[إثبات الحارس] الاختبار كان سيفشل بدارة قصر jsdom القياسية (canPlayConfetti=false) — تجاوزناها هنا عمداً', () => {
        // توثيق: بلا forceCanPlayConfetti أعلاه، /jsdom/i.test(navigator.userAgent) صحيح
        // في jsdom الافتراضي، فيقصر canPlayConfetti إلى false ولا يصل التنفيذ لسطر
        // الاستثناء أصلاً — هذا بالضبط سبب غياب أي فشل في اختبارات الملف الأخرى.
        expect(/jsdom/i.test(navigator.userAgent)).toBe(false); // نحن غيّرناه أعلاه عمداً لفضح الخلل
    });
});
