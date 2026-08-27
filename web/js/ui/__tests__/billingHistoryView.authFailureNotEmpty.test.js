/**
 * @vitest-environment jsdom
 *
 * العلة (مسح 2026-08-26، BillingHistoryView.js:60): `if (user) { orders = await
 * listOrders(); }` بلا فرع else — فمع user=null تبقى orders=[] وتُطبع «لا توجد
 * عمليات دفع حتى الآن» لعميل **دافع** لمجرد أن جلسته انتهت أو أن الشبكة سقطت.
 * أي أن فشل الوصول يُقدَّم للعميل كحقيقة عن حسابه، ومعه زر «عرض الباقات» يدعوه
 * لشراء ما اشتراه أصلاً. نفس صنف عيب قائمة الدراسات السحابية (d214838).
 *
 * الاختبار يثبّت أن العميل **يرى رسالة تفرّق بين الحالتين** — لا مجرد أن render()
 * لا ترمي: انتهاء الجلسة ⟵ دعوة لتسجيل الدخول، وتعذّر الوصول ⟵ إعادة محاولة،
 * وكلتاهما ليست جملة الفراغ. والفراغ الحقيقي يبقى كما هو.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let authResult = { user: { id: 'u1' } };
let ordersResult = [];

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => authResult),
}));

vi.mock('../../services/PaymentService.js', () => ({
    listOrders: vi.fn(async () => ordersResult),
}));

const EMPTY_TEXT = 'لا توجد عمليات دفع حتى الآن';

async function renderView() {
    const { BillingHistoryView } = await import('../BillingHistoryView.js');
    const view = new BillingHistoryView(document.getElementById('root'), {});
    await view.render();
    return view;
}

describe('BillingHistoryView — فشل الوصول ليس «لا توجد عمليات دفع»', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        authResult = { user: { id: 'u1' } };
        ordersResult = [];
    });

    it('انتهاء الجلسة: يدعو لتسجيل الدخول ولا يزعم أن العميل لم يدفع', async () => {
        authResult = { user: null, ok: false, error: 'Auth session missing!' };
        await renderView();

        const panel = document.getElementById('billingSignInRequired');
        expect(panel).not.toBeNull();
        expect(panel.textContent).toContain('سجّل الدخول');
        expect(document.body.textContent).not.toContain(EMPTY_TEXT);
        // لا زر «عرض الباقات»: دعوة لشراء ما قد يكون مشترى أصلاً
        expect(document.getElementById('billingEmptyPricingLink')).toBeNull();
        expect(document.getElementById('btnBillingSignIn')).not.toBeNull();
    });

    it('تعذّر الوصول: رسالة اتصال وزر إعادة محاولة، لا دعوة لتسجيل الدخول', async () => {
        authResult = { user: null, ok: false, error: 'TypeError: Failed to fetch' };
        await renderView();

        const panel = document.getElementById('billingLoadError');
        expect(panel).not.toBeNull();
        expect(panel.textContent).toContain('تعذّر الوصول');
        expect(document.body.textContent).not.toContain(EMPTY_TEXT);
        expect(document.getElementById('btnRetryBilling')).not.toBeNull();
        // الحالتان متمايزتان فعلاً، لا رسالة واحدة تُعرض للاثنتين
        expect(document.getElementById('billingSignInRequired')).toBeNull();
    });

    it('زر إعادة المحاولة يعيد الجلب فعلاً، ويعرض الطلبات حين تعود الشبكة', async () => {
        authResult = { user: null, ok: false, error: 'TypeError: Failed to fetch' };
        await renderView();

        authResult = { user: { id: 'u1' } };
        ordersResult = [
            { id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', tier: 'full', amount_sar: 4999, currency: 'SAR', status: 'paid', created_at: '2026-08-01T00:00:00Z', paid_at: '2026-08-01T00:00:00Z' },
        ];
        document.getElementById('btnRetryBilling').click();
        await vi.waitFor(() => {
            expect(document.getElementById('billingLoadError')).toBeNull();
        });
        expect(document.body.textContent).toContain('#3fa85f64');
    });

    it('الفراغ الحقيقي (جلسة سليمة وصفر طلبات) يبقى كما هو', async () => {
        authResult = { user: { id: 'u1' } };
        ordersResult = [];
        await renderView();

        expect(document.body.textContent).toContain(EMPTY_TEXT);
        expect(document.getElementById('billingSignInRequired')).toBeNull();
        expect(document.getElementById('billingLoadError')).toBeNull();
    });
});

/**
 * إتمام 2026-08-26: `listOrders` صارت ترمي عند فشل الاستعلام (PaymentService) بدل
 * إعادة قائمة فارغة. لكن الرمي وحده لا يُظهر لوح «تعذّر الوصول» — ذلك اللوح لا
 * يُبلَّغ إلا من `classifyAuthFailure` أي حين `user === null` فقط. فبلا حراسة هنا
 * ترفض `render()` ويلتقطها حارس المسار في app.js فيعرض توستاً **بلا رسم الصفحة**.
 *
 * هذه الحالة تحديداً — جلسة **سليمة** واستعلام فاشل — كانت خارج تغطية الاختبارات
 * أعلاه، وهي الحالة الأكثر شيوعاً عملياً (شبكة متقطعة لعميل مسجَّل).
 */
describe('BillingHistoryView — جلسة سليمة واستعلام فاشل', () => {
    it('يعرض لوح «تعذّر الوصول» وزر إعادة المحاولة، لا صفحة فارغة ولا «لا توجد مدفوعات»', async () => {
        vi.resetModules();
        vi.doMock('../../../supabaseClient.js', () => ({
            getAuthUser: async () => ({ user: { id: 'u-1' }, error: null }),
        }));
        vi.doMock('../../services/PaymentService.js', () => ({
            listOrders: async () => { throw new Error('network down'); },
        }));
        const { BillingHistoryView } = await import('../BillingHistoryView.js');

        document.body.innerHTML = '<div id="c"></div>';
        const view = new BillingHistoryView(document.getElementById('c'), {});
        await view.render();

        const box = document.getElementById('c');
        expect(box.querySelector('#billingLoadError'),
            'لوح «تعذّر الوصول» غائب — العميل يرى صفحة بلا تفسير'
        ).not.toBeNull();
        expect(box.textContent).not.toContain('لا توجد عمليات دفع حتى الآن');
        expect(box.querySelector('#btnRetryBilling'),
            'زر إعادة المحاولة غائب — لا مخرج للعميل'
        ).not.toBeNull();
    });
});
