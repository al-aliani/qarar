import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

export async function getWalletSummary() {
    const { user } = await getAuthUser();
    if (!user) return { balance: 0, transactions: [] };
    const { supabase, ok } = await getSupabaseClient();
    if (!ok || !supabase) return { balance: 0, transactions: [] };
    try {
        const { data, error } = await supabase
            .from('wallet_transactions')
            .select('id, amount_sar, transaction_type, description, created_at')
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) return { balance: 0, transactions: [] };
        const transactions = data || [];
        const balance = transactions.reduce((sum, item) => sum + Number(item.amount_sar || 0), 0);
        return { balance, transactions };
    } catch (_) {
        // تراجع آمن عند ترحيل قديم أو mock اختبار لا يعرف جدول المحفظة بعد.
        return { balance: 0, transactions: [] };
    }
}
