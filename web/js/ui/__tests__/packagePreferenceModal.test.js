/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateUserProfileMock = vi.fn();

vi.mock('../../../supabaseClient.js', () => ({
    updateUserProfile: (...a) => updateUserProfileMock(...a),
}));

describe('PackagePreferenceModal', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        updateUserProfileMock.mockReset().mockResolvedValue({ ok: true, profile: {} });
    });

    it('لا يوجد زر إغلاق (X) — خيار "استخدم مجاناً الآن" يغطي معنى التخطي بدل ذلك', async () => {
        const { PackagePreferenceModal } = await import('../PackagePreferenceModal.js');
        const modal = new PackagePreferenceModal();
        modal.open();
        expect(modal.overlay.querySelector('.btn-close')).toBeNull();
    });

    it('يعرض 4 خيارات: الباقات الثلاث + استخدم مجاناً الآن، بنفس ترتيب PRICING_PACKAGES', async () => {
        const { PackagePreferenceModal } = await import('../PackagePreferenceModal.js');
        const modal = new PackagePreferenceModal();
        modal.open();
        const buttons = modal.overlay.querySelectorAll('[data-tier]');
        expect(buttons.length).toBe(4);
        const tiers = Array.from(buttons).map((b) => b.dataset.tier);
        expect(tiers).toEqual(['self', 'reviewed', 'full', 'free']);
    });

    it('اختيار باقة: يحفظ preferred_tier، يستدعي onSelected، ويغلق النافذة', async () => {
        const onSelected = vi.fn();
        const { PackagePreferenceModal } = await import('../PackagePreferenceModal.js');
        const modal = new PackagePreferenceModal({ onSelected });
        modal.open();
        modal.overlay.querySelector('[data-tier="reviewed"]').click();
        await new Promise((r) => setTimeout(r, 10));
        expect(updateUserProfileMock).toHaveBeenCalledWith({ preferred_tier: 'reviewed' });
        expect(onSelected).toHaveBeenCalledWith('reviewed');
        expect(modal.overlay).toBeNull();
    });

    it('اختيار "استخدم مجاناً الآن": يحفظ preferred_tier="free" (لا سعر معروض له)', async () => {
        const { PackagePreferenceModal } = await import('../PackagePreferenceModal.js');
        const modal = new PackagePreferenceModal();
        modal.open();
        modal.overlay.querySelector('[data-tier="free"]').click();
        await new Promise((r) => setTimeout(r, 10));
        expect(updateUserProfileMock).toHaveBeenCalledWith({ preferred_tier: 'free' });
    });

    it('فشل الحفظ: يعرض خطأ ويُعيد تفعيل الأزرار، لا يغلق النافذة', async () => {
        updateUserProfileMock.mockResolvedValue({ ok: false, error: 'network error' });
        const { PackagePreferenceModal } = await import('../PackagePreferenceModal.js');
        const modal = new PackagePreferenceModal();
        modal.open();
        modal.overlay.querySelector('[data-tier="self"]').click();
        await new Promise((r) => setTimeout(r, 10));
        expect(modal.overlay).not.toBeNull();
        expect(modal.overlay.querySelector('#packagePreferenceError').textContent).toContain('network error');
        expect(modal.overlay.querySelector('[data-tier="self"]').disabled).toBe(false);
    });
});
