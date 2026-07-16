/**
 * @vitest-environment jsdom
 *
 * نفس ملاحظة authModalStub.mfaAndAudit.test.js: موك '@supabase/supabase-js' (حزمة
 * خارجية) بدل محاولة موك supabaseClient.js عبر import() ديناميكي غير موثوقة هنا.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUserMock = vi.fn(async () => ({ data: { user: { id: 'u1' } } }));
const updateMock = vi.fn(() => ({
    eq: () => ({
        select: () => ({
            single: async () => ({ data: { id: 'u1', phone: '+966512345678' }, error: null })
        })
    })
}));
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: getUserMock },
        from: fromMock
    }))
}));

async function waitUntil(predicate, { timeout = 2000, interval = 10 } = {}) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeout) throw new Error('waitUntil: timed out');
        await new Promise((r) => setTimeout(r, interval));
    }
}

describe('CompletePhoneModal', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        getUserMock.mockClear();
        updateMock.mockClear();
        fromMock.mockClear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    it('رقم غير صالح: يعرض خطأ ولا يستدعي updateUserProfile', async () => {
        const { CompletePhoneModal } = await import('../CompletePhoneModal.js');
        const modal = new CompletePhoneModal();
        modal.open();
        modal.overlay.querySelector('#completePhoneInput').value = '123';
        modal.overlay.querySelector('#completePhoneForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitUntil(() => modal.overlay.querySelector('#completePhoneError')?.textContent);

        expect(fromMock).not.toHaveBeenCalled();
        expect(modal.overlay.querySelector('#completePhoneError').textContent).toContain('رقم جوال سعودي صحيح');
    });

    it('رقم صالح: يحفظه بصيغة E.164 ويغلق النافذة', async () => {
        const { CompletePhoneModal } = await import('../CompletePhoneModal.js');
        const modal = new CompletePhoneModal();
        modal.open();
        modal.overlay.querySelector('#completePhoneInput').value = '0512345678';
        modal.overlay.querySelector('#completePhoneForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitUntil(() => modal.overlay === null);

        expect(fromMock).toHaveBeenCalledWith('profiles');
        expect(updateMock).toHaveBeenCalledWith({ phone: '+966512345678' });
        expect(modal.overlay).toBeNull();
    });

    it('لا يوجد زر إغلاق (X) في النافذة — رقم الجوال مطلوب فعلياً', async () => {
        const { CompletePhoneModal } = await import('../CompletePhoneModal.js');
        const modal = new CompletePhoneModal();
        modal.open();
        expect(modal.overlay.querySelector('.btn-close')).toBeNull();
    });
});
