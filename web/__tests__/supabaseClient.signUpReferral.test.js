/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-18 — حلقة نمو المشاركة: signUp() يقبل الآن referredByToken اختيارياً
 * (خامس معامل)، يمرَّر ضمن raw_user_meta_data.referred_by_token فيلتقطه
 * handle_new_user() (migration 20260718010000_share_growth_and_tracking.sql) ويعبّئ
 * profiles.referred_by_token. لا يجب أن يُرسَل الحقل إطلاقاً لو لم يُمرَّر توكن (لا قيمة
 * فارغة مضلِّلة في raw_user_meta_data).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const signUpMock = vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: { signUp: signUpMock },
    })),
}));

describe('signUp() — إرفاق referredByToken بحلقة النمو', () => {
    beforeEach(() => {
        signUpMock.mockClear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    it('referredByToken مُمرَّر ⇒ يصل ضمن options.data.referred_by_token', async () => {
        const { signUp } = await import('../supabaseClient.js');
        await signUp('user@example.com', 'password123', null, 'أحمد', 'share-tok-123');

        expect(signUpMock).toHaveBeenCalledTimes(1);
        const [payload] = signUpMock.mock.calls[0];
        expect(payload.options.data.referred_by_token).toBe('share-tok-123');
        expect(payload.options.data.full_name).toBe('أحمد');
    });

    it('بلا referredByToken ⇒ الحقل غائب كلياً من metadata (لا قيمة فارغة/null مضلِّلة)', async () => {
        const { signUp } = await import('../supabaseClient.js');
        await signUp('user@example.com', 'password123', null, 'أحمد');

        const [payload] = signUpMock.mock.calls[0];
        expect(payload.options.data).not.toHaveProperty('referred_by_token');
    });
});
