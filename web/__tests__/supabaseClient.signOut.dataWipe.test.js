/**
 * @vitest-environment jsdom
 *
 * تدقيق حي 2026-07-22: signOut() كان يمسح فقط مفاتيح localStorage التي تبدأ بـ
 * sb-/feas_project_ — يترك على جهاز مشترك: آخر خطوة/تصنيف وصل إليها المستخدم
 * السابق، تنظيم مجلداته، تفضيل وضع الدراسة، مفتاح OpenAI الذي أدخله في «أدوات
 * مساندة» (بيانات اعتماد بنص صريح)، ونسخ IndexedDB الاحتياطية لمشاريع كبيرة
 * (storageManager.js يُرآة feas_project_* الكبيرة هناك أيضاً). هذا يثبّت أن كل
 * هذه المفاتيح تُمسح الآن، وأن مفاتيح تفضيلات الجهاز غير الشخصية (الثيم/اللغة) لا تُمسّ.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const authSignOutMock = vi.fn(async () => ({ error: null }));
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: { signOut: authSignOutMock },
    })),
}));

const removeItemMock = vi.fn(async () => {});
vi.mock('../js/utils/storageManager.js', () => ({
    storageManager: { removeItem: (...a) => removeItemMock(...a) },
}));

describe('signOut() — مسح بيانات المستخدم من جهاز مشترك', () => {
    beforeEach(() => {
        authSignOutMock.mockClear();
        removeItemMock.mockClear();
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');

        delete window.location;
        window.location = { reload: vi.fn(), hostname: 'sahib.sa' };
    });

    it('يمسح كل المفاتيح الشخصية عبر storageManager.removeItem (localStorage + مرآة IndexedDB معاً)', async () => {
        localStorage.setItem('sb-auth-token', 'x');
        localStorage.setItem('feas_project_abc123', '{}');
        localStorage.setItem('feas_last_step_index', '5');
        localStorage.setItem('feas_last_category_index', '2');
        localStorage.setItem('feas_folders', '["مطعم"]');
        localStorage.setItem('study_mode_preference', 'simple');
        localStorage.setItem('qarar_integration_openai_key', 'sk-secret123');
        sessionStorage.setItem('selected_package', 'reviewed');

        const { signOut } = await import('../supabaseClient.js');
        await signOut();

        const wipedKeys = removeItemMock.mock.calls.map(([k]) => k).sort();
        expect(wipedKeys).toEqual([
            'feas_folders',
            'feas_last_category_index',
            'feas_last_step_index',
            'feas_project_abc123',
            'qarar_integration_openai_key',
            'sb-auth-token',
            'study_mode_preference',
        ]);
        expect(sessionStorage.getItem('selected_package')).toBeNull();
        expect(window.location.reload).toHaveBeenCalledTimes(1);
    });

    it('لا يمسّ تفضيلات الجهاز غير الشخصية (الثيم/اللغة) — ليست بيانات مستخدم', async () => {
        localStorage.setItem('feas_theme', 'dark');
        localStorage.setItem('qarar_language', 'ar');

        const { signOut } = await import('../supabaseClient.js');
        await signOut();

        const wipedKeys = removeItemMock.mock.calls.map(([k]) => k);
        expect(wipedKeys).not.toContain('feas_theme');
        expect(wipedKeys).not.toContain('qarar_language');
        expect(localStorage.getItem('feas_theme')).toBe('dark');
        expect(localStorage.getItem('qarar_language')).toBe('ar');
    });
});
