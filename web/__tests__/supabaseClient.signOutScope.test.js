/**
 * @vitest-environment jsdom
 *
 * تدقيق شامل 2026-09-16: signOut() كانت تستدعي supabase.auth.signOut() بلا أي
 * معامل — supabase-js يستخدم افتراضياً scope:'global' (موثَّق صراحة في مصدر
 * المكتبة نفسها)، أي يُبطل جلسات المستخدم على **كل** أجهزته. أربعة مسارات تخص
 * الجهاز الحالي فقط (خروج يدوي، خروج تلقائي بعد الخمول، إغلاق نافذة تعيين كلمة
 * مرور جديدة أو تحدي 2FA بلا إكمالها) كانت تُسقط أجهزة أخرى شرعية بلا داعٍ. مسار
 * واحد فقط (استرداد 2FA بفقدان الجهاز) يحتاج فعلاً إسقاط كل الجلسات، ويمرّره صراحة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const authSignOutMock = vi.fn(async () => ({ error: null }));
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: { signOut: authSignOutMock },
    })),
}));
vi.mock('../js/utils/storageManager.js', () => ({
    storageManager: { removeItem: vi.fn(async () => {}) },
}));

describe('signOut() — نطاق الجلسة (scope) لا يُسقط أجهزة أخرى افتراضياً', () => {
    beforeEach(() => {
        authSignOutMock.mockClear();
        localStorage.clear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
        delete window.location;
        window.location = { reload: vi.fn(), hostname: 'sahib.sa' };
    });

    it('بلا معامل (الاستخدام الشائع لكل مسارات الجهاز الحالي) ⟹ scope:"local" — لا يُسقط أجهزة أخرى', async () => {
        const { signOut } = await import('../supabaseClient.js');
        await signOut();
        expect(authSignOutMock).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('مع scope:"global" صريح (استرداد فقدان جهاز 2FA فقط) ⟹ يُمرَّر كما هو، لا يُستبدَل بالافتراضي', async () => {
        const { signOut } = await import('../supabaseClient.js');
        await signOut('global');
        expect(authSignOutMock).toHaveBeenCalledWith({ scope: 'global' });
    });
});
