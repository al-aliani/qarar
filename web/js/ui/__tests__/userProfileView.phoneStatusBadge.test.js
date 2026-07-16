/**
 * @vitest-environment jsdom
 *
 * نفس نمط موك completePhoneModal.test.js: موك '@supabase/supabase-js' بدل
 * supabaseClient.js نفسه.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let currentProfile = null;

const getUserMock = vi.fn(async () => ({
    data: { user: { id: 'u1', email: 'a@test.com', created_at: '2026-01-01T00:00:00Z' } }
}));
const fromMock = vi.fn(() => ({
    select: () => ({
        eq: () => ({
            single: async () => ({ data: currentProfile, error: null })
        })
    })
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: getUserMock },
        from: fromMock
    }))
}));

describe('UserProfileView — شارة حالة تأكيد الجوال', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        getUserMock.mockClear();
        fromMock.mockClear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    async function renderWithProfile(profile) {
        currentProfile = profile;
        const { UserProfileView } = await import('../UserProfileView.js');
        const view = new UserProfileView(document.getElementById('root'));
        await view.render();
    }

    it('بلا رقم جوال: لا تظهر أي شارة', async () => {
        await renderWithProfile({ id: 'u1', phone: '', phone_verified: false, whatsapp_contact_prompted: false });
        expect(document.querySelector('.badge--success')).toBeNull();
        expect(document.querySelector('.badge--warning')).toBeNull();
    });

    it('جوال مؤكد: تظهر شارة "مؤكد"', async () => {
        await renderWithProfile({ id: 'u1', phone: '+966512345678', phone_verified: true, whatsapp_contact_prompted: true });
        expect(document.querySelector('.badge--success')?.textContent).toContain('مؤكد');
        expect(document.querySelector('.badge--warning')).toBeNull();
    });

    it('جوال بانتظار تأكيد الأدمن: تظهر شارة "بانتظار تأكيد الفريق"', async () => {
        await renderWithProfile({ id: 'u1', phone: '+966512345678', phone_verified: false, whatsapp_contact_prompted: true });
        expect(document.querySelector('.badge--warning')?.textContent).toContain('بانتظار تأكيد الفريق');
        expect(document.querySelector('.badge--success')).toBeNull();
    });

    it('جوال موجود لكن لم تُطرح دعوة واتساب بعد: لا شارة', async () => {
        await renderWithProfile({ id: 'u1', phone: '+966512345678', phone_verified: false, whatsapp_contact_prompted: false });
        expect(document.querySelector('.badge--success')).toBeNull();
        expect(document.querySelector('.badge--warning')).toBeNull();
    });
});
