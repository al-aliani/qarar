/**
 * TicketService — نظام تذاكر الدعم الفني الداخلي (2026-07-18، بلا مزوّد خارجي).
 * يتطلب تسجيل دخول (RLS تعتمد auth.uid()) وتطبيق migration
 * 20260718000000_support_tickets.sql. لا فلترة user_id يدوية في أي استعلام —
 * RLS وحدها تتكفّل (نفس مبدأ PaymentService.js/AttachmentsService.js).
 * sender_type/sender_id على الرسائل يُضبَطان قسراً بواسطة trigger في القاعدة
 * (handle_new_ticket_message) — لا يُرسَلان من هنا إطلاقاً، لمنع انتحال دور "أدمن".
 */
import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

export const TICKET_STATUSES = ['open', 'answered', 'closed'];

/**
 * إنشاء تذكرة جديدة + أول رسالة فيها.
 * @param {{subject: string, body: string}} params
 * @returns {Promise<{ok: boolean, ticketId?: string, error?: string}>}
 */
export async function submitTicket({ subject, body }) {
    const cleanSubject = String(subject || '').trim();
    const cleanBody = String(body || '').trim();
    if (!cleanSubject) return { ok: false, error: 'أدخل عنوان التذكرة.' };
    if (!cleanBody) return { ok: false, error: 'أدخل نص الرسالة.' };

    const { user, ok: authOk } = await getAuthUser();
    if (!authOk || !user) return { ok: false, error: 'سجّل الدخول أولاً لإرسال تذكرة دعم.' };

    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: error || 'تعذّر الاتصال بخدمة الدعم.' };

    const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({ user_id: user.id, subject: cleanSubject })
        .select('id')
        .single();
    if (ticketError) return { ok: false, error: ticketError.message };

    const { error: messageError } = await supabase
        .from('support_ticket_messages')
        .insert({ ticket_id: ticket.id, body: cleanBody });
    if (messageError) {
        // التذكرة أُنشئت لكن الرسالة الأولى فشلت — نادر (سباق شبكة)؛ لا نحذف التذكرة
        // اليتيمة تلقائياً (حذف صامت لبيانات المستخدم مبدأ مرفوض بهذا المشروع)،
        // نُبلغ الخطأ ونُعيد ticketId كي يستطيع المستدعي إعادة محاولة الرسالة.
        return { ok: false, error: messageError.message, ticketId: ticket.id };
    }
    return { ok: true, ticketId: ticket.id };
}

/**
 * تذاكر المستخدم الحالي (RLS تقصرها على صاحبها).
 * @returns {Promise<Array<{id:string, subject:string, status:string, created_at:string, updated_at:string}>>}
 */
export async function listMyTickets() {
    const { user, ok: authOk } = await getAuthUser();
    if (!authOk || !user) return [];

    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return [];

    const { data, error } = await supabase
        .from('support_tickets')
        .select('id, subject, status, created_at, updated_at')
        .order('updated_at', { ascending: false });
    if (error) {
        console.warn('[TicketService] فشل جلب تذاكرك:', error.message);
        return [];
    }
    return data || [];
}

/**
 * كل التذاكر (أدمن فقط — RLS تعتمد tickets_admin_all؛ لمستخدم عادي تُعيد قائمة فارغة بصمت).
 * @returns {Promise<Array>}
 */
export async function listAllTickets() {
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return [];

    const { data, error } = await supabase
        .from('support_tickets')
        .select('id, user_id, subject, status, created_at, updated_at')
        .order('status', { ascending: true })
        .order('updated_at', { ascending: false });
    if (error) {
        console.warn('[TicketService] فشل جلب كل التذاكر:', error.message);
        return [];
    }
    return data || [];
}

/**
 * تذكرة واحدة + كل رسائلها (RLS: صاحب التذكرة أو أدمن فقط).
 * @returns {Promise<{ok: boolean, ticket?: object, messages?: Array, error?: string}>}
 */
export async function getTicketWithMessages(ticketId) {
    if (!ticketId) return { ok: false, error: 'معرّف تذكرة غير صالح.' };

    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };

    const [{ data: ticket, error: ticketError }, { data: messages }] = await Promise.all([
        supabase.from('support_tickets').select('*').eq('id', ticketId).single(),
        supabase.from('support_ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
    ]);
    if (ticketError) return { ok: false, error: ticketError.message };
    return { ok: true, ticket, messages: messages || [] };
}

/**
 * إضافة رسالة لتذكرة (يعمل لصاحب التذكرة وللأدمن معاً — القاعدة تحسم sender_type تلقائياً).
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function addMessage(ticketId, body) {
    const cleanBody = String(body || '').trim();
    if (!ticketId) return { ok: false, error: 'معرّف تذكرة غير صالح.' };
    if (!cleanBody) return { ok: false, error: 'أدخل نص الرسالة.' };

    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };

    const { error: insertError } = await supabase
        .from('support_ticket_messages')
        .insert({ ticket_id: ticketId, body: cleanBody });
    if (insertError) return { ok: false, error: insertError.message };
    return { ok: true };
}

/**
 * تغيير حالة تذكرة (أدمن فقط — محمي بـRLS، لن ينجح لمستخدم عادي).
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function updateTicketStatus(ticketId, status) {
    if (!ticketId) return { ok: false, error: 'معرّف تذكرة غير صالح.' };
    if (!TICKET_STATUSES.includes(status)) return { ok: false, error: 'حالة غير صالحة.' };

    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };

    const { error: updateError } = await supabase
        .from('support_tickets')
        .update({ status })
        .eq('id', ticketId);
    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true };
}

/** عدد التذاكر المفتوحة (لشارة تبويب لوحة التحكم — أدمن فقط عملياً). */
export async function getOpenTicketsCount() {
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return 0;

    const { count, error } = await supabase
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open');
    if (error) return 0;
    return count || 0;
}
