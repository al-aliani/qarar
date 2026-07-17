import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

export async function requestAccountDeletion() {
    const { user } = await getAuthUser();
    if (!user) return { ok: false, error: 'سجّل الدخول أولاً.' };
    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };
    const { error: insertError } = await supabase.from('account_deletion_requests').upsert({ user_id: user.id, status: 'requested' }, { onConflict: 'user_id,status' });
    return insertError ? { ok: false, error: insertError.message } : { ok: true };
}
