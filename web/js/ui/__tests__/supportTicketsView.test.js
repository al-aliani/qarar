/**
 * @vitest-environment jsdom
 *
 * تحقق من ربط SupportTicketsView بخدمة TicketService — الخدمة نفسها (اتصال Supabase
 * الحقيقي) مموَّهة هنا؛ منطقها الخاص مُختبر في
 * web/js/services/__tests__/TicketService.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1' } })),
}));

const submitTicketMock = vi.fn();
const listMyTicketsMock = vi.fn();
const getTicketWithMessagesMock = vi.fn();
const addMessageMock = vi.fn();

vi.mock('../../services/TicketService.js', () => ({
    submitTicket: (...a) => submitTicketMock(...a),
    listMyTickets: (...a) => listMyTicketsMock(...a),
    getTicketWithMessages: (...a) => getTicketWithMessagesMock(...a),
    addMessage: (...a) => addMessageMock(...a),
}));

describe('SupportTicketsView', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        submitTicketMock.mockReset();
        listMyTicketsMock.mockReset().mockResolvedValue({ ok: true, tickets: [] });
        getTicketWithMessagesMock.mockReset();
        addMessageMock.mockReset();
    });

    async function renderView() {
        const { SupportTicketsView } = await import('../SupportTicketsView.js');
        const view = new SupportTicketsView(document.getElementById('root'));
        await view.render();
        return view;
    }

    it('بلا تذاكر: يعرض "لا توجد تذاكر دعم بعد"', async () => {
        await renderView();
        expect(document.getElementById('supportTicketsList').textContent).toContain('لا توجد تذاكر دعم بعد');
    });

    it('إرسال تذكرة جديدة يستدعي submitTicket بالعنوان والنص الصحيحين', async () => {
        submitTicketMock.mockResolvedValue({ ok: true, ticketId: 't1' });
        await renderView();

        document.getElementById('supportSubject').value = 'مشكلة تصدير';
        document.getElementById('supportBody').value = 'الملف لا يفتح بعد التنزيل';
        document.getElementById('btnSupportSubmit').click();
        await new Promise((r) => setTimeout(r, 0));

        expect(submitTicketMock).toHaveBeenCalledWith({ subject: 'مشكلة تصدير', body: 'الملف لا يفتح بعد التنزيل', issueType: 'technical', priority: 'normal' });
    });

    it('فشل الإرسال: يعرض رسالة الخطأ ولا يعيد الرسم', async () => {
        submitTicketMock.mockResolvedValue({ ok: false, error: 'أدخل عنوان التذكرة.' });
        await renderView();

        document.getElementById('btnSupportSubmit').click();
        await new Promise((r) => setTimeout(r, 0));

        const errEl = document.getElementById('supportSubmitError');
        expect(errEl.textContent).toBe('أدخل عنوان التذكرة.');
        expect(errEl.style.display).toBe('block');
    });

    it('زر الإرسال يُعطَّل أثناء الطلب (منع نقر مزدوج) ويُعاد تفعيله بعد الفشل', async () => {
        let resolveSubmit;
        submitTicketMock.mockReturnValue(new Promise((resolve) => { resolveSubmit = resolve; }));
        await renderView();

        const btn = document.getElementById('btnSupportSubmit');
        btn.click();
        await new Promise((r) => setTimeout(r, 0));
        expect(btn.disabled).toBe(true);
        expect(btn.textContent).toBe('جارٍ الإرسال...');

        resolveSubmit({ ok: false, error: 'فشل الإرسال' });
        await new Promise((r) => setTimeout(r, 0));
        expect(btn.disabled).toBe(false);
        expect(btn.textContent).toBe('إرسال التذكرة');
    });

    it('يعرض تذاكر موجودة بشاراتها الصحيحة (مفتوحة/تم الرد/مُغلقة)', async () => {
        listMyTicketsMock.mockResolvedValue({
            ok: true,
            tickets: [
                { id: 't1', subject: 'الأولى', status: 'open', updated_at: '2026-07-18T00:00:00Z' },
                { id: 't2', subject: 'الثانية', status: 'answered', updated_at: '2026-07-17T00:00:00Z' },
                { id: 't3', subject: 'الثالثة', status: 'closed', updated_at: '2026-07-16T00:00:00Z' },
            ],
        });
        await renderView();

        const badges = [...document.querySelectorAll('[data-ticket-row] .badge')].map((b) => b.textContent.trim());
        expect(badges).toEqual(['مفتوحة', 'تم الرد', 'مُغلقة']);
    });

    it('فشل جلب التذاكر: يعرض رسالة خطأ منفصلة عن "لا توجد تذاكر"', async () => {
        listMyTicketsMock.mockResolvedValue({ ok: false, tickets: [], error: 'تعذّر الاتصال بالخادم' });
        await renderView();

        const listEl = document.getElementById('supportTicketsList');
        expect(listEl.textContent).toContain('تعذّر الاتصال بالخادم');
        expect(listEl.textContent).not.toContain('لا توجد تذاكر دعم بعد');
    });

    it('النقر على تذكرة يفتح محادثتها عبر getTicketWithMessages', async () => {
        listMyTicketsMock.mockResolvedValue({
            ok: true,
            tickets: [{ id: 't1', subject: 'الأولى', status: 'open', updated_at: '2026-07-18T00:00:00Z' }],
        });
        getTicketWithMessagesMock.mockResolvedValue({
            ok: true,
            ticket: { id: 't1', status: 'open' },
            messages: [{ sender_type: 'user', body: 'نص المشكلة', created_at: '2026-07-18T00:00:00Z' }],
        });
        await renderView();

        document.querySelector('[data-ticket-row="t1"]').click();
        await new Promise((r) => setTimeout(r, 0));

        expect(getTicketWithMessagesMock).toHaveBeenCalledWith('t1');
        expect(document.getElementById('ticketThread-t1').textContent).toContain('نص المشكلة');
    });
});
