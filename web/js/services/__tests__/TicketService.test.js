import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthUserMock = vi.fn(async () => ({ user: null, ok: false }));
const fromMock = vi.fn();

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: { from: fromMock } })),
    getAuthUser: (...a) => getAuthUserMock(...a),
}));

/** يحاكي بنّاء استعلام supabase-js: قابل للسلسلة (select/insert/update/eq/order) وقابل
 * للانتظار مباشرة (thenable) بنفس القيمة التي يُعيدها .single() — يغطي كلا نمطَي
 * الاستخدام الحقيقيَّين في TicketService.js (await chain مباشرة، أو chain.single()). */
function chainOf(result) {
    const obj = {
        select: vi.fn(() => obj),
        insert: vi.fn(() => obj),
        update: vi.fn(() => obj),
        eq: vi.fn(() => obj),
        order: vi.fn(() => obj),
        single: vi.fn(async () => result),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return obj;
}

beforeEach(() => {
    getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'u1' }, ok: true });
    fromMock.mockReset();
});

describe('submitTicket', () => {
    it('بلا عنوان ⇒ خطأ واضح، لا يستدعي القاعدة', async () => {
        const { submitTicket } = await import('../TicketService.js');
        const result = await submitTicket({ subject: '  ', body: 'نص' });
        expect(result.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('بلا مستخدم مسجَّل ⇒ خطأ واضح، لا يستدعي القاعدة', async () => {
        getAuthUserMock.mockResolvedValue({ user: null });
        const { submitTicket } = await import('../TicketService.js');
        const result = await submitTicket({ subject: 'عنوان', body: 'نص' });
        expect(result.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('نجاح: يُنشئ التذكرة ثم أول رسالة، يُعيد ticketId', async () => {
        fromMock
            .mockImplementationOnce(() => chainOf({ data: { id: 'ticket-1' }, error: null }))
            .mockImplementationOnce(() => chainOf({ error: null }));
        const { submitTicket } = await import('../TicketService.js');
        const result = await submitTicket({ subject: 'مشكلة في التصدير', body: 'الملف لا يفتح' });

        expect(fromMock).toHaveBeenNthCalledWith(1, 'support_tickets');
        expect(fromMock).toHaveBeenNthCalledWith(2, 'support_ticket_messages');
        expect(result).toEqual({ ok: true, ticketId: 'ticket-1' });
    });

    it('category افتراضية "support" لو لم تُمرَّر', async () => {
        const insertSpy = vi.fn(() => chainOf({ data: { id: 'ticket-1' }, error: null }));
        fromMock
            .mockImplementationOnce(() => ({ ...chainOf({ data: { id: 'ticket-1' }, error: null }), insert: insertSpy }))
            .mockImplementationOnce(() => chainOf({ error: null }));
        const { submitTicket } = await import('../TicketService.js');
        await submitTicket({ subject: 'عنوان', body: 'نص' });
        expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ category: 'support' }));
    });

    it('category صريحة (funding_introduction) تُمرَّر كما هي', async () => {
        const insertSpy = vi.fn(() => chainOf({ data: { id: 'ticket-1' }, error: null }));
        fromMock
            .mockImplementationOnce(() => ({ ...chainOf({ data: { id: 'ticket-1' }, error: null }), insert: insertSpy }))
            .mockImplementationOnce(() => chainOf({ error: null }));
        const { submitTicket } = await import('../TicketService.js');
        await submitTicket({ subject: 'طلب تعريف', body: 'نص', category: 'funding_introduction' });
        expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ category: 'funding_introduction' }));
    });

    it('فشل إنشاء الرسالة الأولى بعد نجاح التذكرة: يُعيد ok:false مع ticketId (لا حذف صامت)', async () => {
        fromMock
            .mockImplementationOnce(() => chainOf({ data: { id: 'ticket-1' }, error: null }))
            .mockImplementationOnce(() => chainOf({ error: { message: 'network error' } }));
        const { submitTicket } = await import('../TicketService.js');
        const result = await submitTicket({ subject: 'عنوان', body: 'نص' });

        expect(result.ok).toBe(false);
        expect(result.ticketId).toBe('ticket-1');
    });
});

describe('listMyTickets', () => {
    it('بلا مستخدم مسجَّل ⇒ مصفوفة فارغة، لا يستدعي القاعدة', async () => {
        getAuthUserMock.mockResolvedValue({ user: null });
        const { listMyTickets } = await import('../TicketService.js');
        expect(await listMyTickets()).toEqual([]);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('يُعيد التذاكر بلا أي فلترة user_id يدوية (RLS وحدها)', async () => {
        const rows = [{ id: 't1', subject: 'أ', status: 'open' }];
        const chain = chainOf({ data: rows, error: null });
        fromMock.mockImplementation(() => chain);
        const { listMyTickets } = await import('../TicketService.js');

        const result = await listMyTickets();
        expect(fromMock).toHaveBeenCalledWith('support_tickets');
        expect(chain.eq).not.toHaveBeenCalled();
        expect(result).toEqual(rows);
    });

    it('خطأ استعلام ⇒ مصفوفة فارغة، لا انهيار', async () => {
        fromMock.mockImplementation(() => chainOf({ data: null, error: { message: 'boom' } }));
        const { listMyTickets } = await import('../TicketService.js');
        expect(await listMyTickets()).toEqual([]);
    });
});

describe('addMessage', () => {
    it('بلا نص رسالة ⇒ خطأ، لا يستدعي القاعدة', async () => {
        const { addMessage } = await import('../TicketService.js');
        const result = await addMessage('ticket-1', '  ');
        expect(result.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('نجاح: يُدرج فقط ticket_id وbody — بلا sender_id/sender_type (تُضبَط بالقاعدة)', async () => {
        const chain = chainOf({ error: null });
        fromMock.mockImplementation(() => chain);
        const { addMessage } = await import('../TicketService.js');

        const result = await addMessage('ticket-1', 'رد على الاستفسار');
        expect(fromMock).toHaveBeenCalledWith('support_ticket_messages');
        expect(chain.insert).toHaveBeenCalledWith({ ticket_id: 'ticket-1', body: 'رد على الاستفسار' });
        expect(result).toEqual({ ok: true });
    });
});

describe('updateTicketStatus', () => {
    it('حالة غير صالحة ⇒ خطأ، لا يستدعي القاعدة', async () => {
        const { updateTicketStatus } = await import('../TicketService.js');
        const result = await updateTicketStatus('ticket-1', 'archived');
        expect(result.ok).toBe(false);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('نجاح: يحدّث الحالة (RLS تمنع مستخدماً عادياً من النجاح فعلياً، لا فحص أدمن هنا)', async () => {
        const chain = chainOf({ error: null });
        fromMock.mockImplementation(() => chain);
        const { updateTicketStatus } = await import('../TicketService.js');

        const result = await updateTicketStatus('ticket-1', 'closed');
        expect(chain.update).toHaveBeenCalledWith({ status: 'closed' });
        expect(result).toEqual({ ok: true });
    });
});

describe('getOpenTicketsCount', () => {
    it('يُعيد count الفعلي', async () => {
        fromMock.mockImplementation(() => chainOf({ count: 3, error: null }));
        const { getOpenTicketsCount } = await import('../TicketService.js');
        expect(await getOpenTicketsCount()).toBe(3);
    });

    it('خطأ أو count فارغ ⇒ صفر', async () => {
        fromMock.mockImplementation(() => chainOf({ count: null, error: { message: 'x' } }));
        const { getOpenTicketsCount } = await import('../TicketService.js');
        expect(await getOpenTicketsCount()).toBe(0);
    });
});
