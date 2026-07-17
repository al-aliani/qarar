import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

export async function submitConsultationRequest(input) {
    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً.' };
    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };
    const payload = {
        user_id: user.id,
        study_id: input.studyId || null,
        help_from_start: !!input.helpFromStart,
        consultant_level: input.level,
        specialty: String(input.specialty || '').trim(),
        sector: String(input.sector || '').trim(),
        idea_summary: String(input.idea || '').trim(),
        notes: String(input.notes || '').trim() || null
    };
    if (!payload.specialty || !payload.sector || payload.idea_summary.length < 10) return { ok: false, error: 'أكمل المجال والقطاع واكتب ملخصًا واضحًا للفكرة.' };
    const { data, error: insertError } = await supabase.from('consultation_requests').insert(payload).select('id, amount_sar, status').single();
    if (insertError) return { ok: false, error: insertError.message };
    return { ok: true, request: data };
}

export async function listMyConsultations() {
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return [];
    const { data, error } = await supabase.from('consultation_requests').select('id, consultant_level, specialty, sector, amount_sar, status, payment_status, created_at').order('created_at', { ascending: false });
    return error ? [] : (data || []);
}
