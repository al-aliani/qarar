/**
 * @vitest-environment jsdom
 *
 * دفعة 5 من خطة إغلاق فجوات الطبقات الـ16 (2026-08-27، طبقة Availability):
 * مؤشر الحفظ العلوي كان يعرض "محفوظ محلياً" المحايدة نفسها سواء المستخدم
 * غير مسجَّل دخول (طبيعي) أو مسجَّل لكن فشلت مزامنته السحابية فعلياً — الآن
 * حالة ثالثة صريحة (لون تحذيري) لهذه الحالة تحديداً.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let capturedSaveStatusCallback = null;
vi.mock('../../core/store.js', () => ({
    store: {
        subscribeSaveStatus: (cb) => { capturedSaveStatusCallback = cb; return () => {}; },
        subscribe: () => () => {},
        getState: () => ({}),
    },
}));
vi.mock('../../core/engine.js', () => ({ calculateStudy: vi.fn() }));

async function mountAndInit() {
    document.body.innerHTML = `
        <div id="cloudSyncIndicator"><span class="sync-text"></span></div>
        <div id="liveFinancialTicker"><span class="ticker-text"></span></div>
    `;
    const { initHeaderIndicators } = await import('../HeaderIndicators.js');
    initHeaderIndicators();
}

describe('HeaderIndicators — تمييز فشل المزامنة السحابية عن "غير مسجَّل دخول"', () => {
    beforeEach(() => {
        vi.resetModules();
        capturedSaveStatusCallback = null;
    });

    it('location=local بلا cloudSyncFailed (غير مسجَّل دخول، طبيعي) ⇒ نص محايد بلا تحذير', async () => {
        await mountAndInit();
        capturedSaveStatusCallback({ success: true, location: 'local', cloudSyncFailed: false });

        const syncText = document.querySelector('#cloudSyncIndicator .sync-text');
        expect(syncText.textContent).toBe('محفوظ محلياً');
        expect(document.getElementById('cloudSyncIndicator').style.color).toBe('var(--c-text-muted)');
    });

    it('location=local مع cloudSyncFailed=true (مسجَّل دخول لكن فشلت المزامنة) ⇒ نص تحذيري صريح مختلف', async () => {
        await mountAndInit();
        capturedSaveStatusCallback({ success: true, location: 'local', cloudSyncFailed: true });

        const syncText = document.querySelector('#cloudSyncIndicator .sync-text');
        expect(syncText.textContent).toContain('تعذّرت المزامنة السحابية');
        expect(document.getElementById('cloudSyncIndicator').style.color).toBe('var(--c-warning)');
    });

    it('location=both (نجاح كامل) يبقى بلا تغيير', async () => {
        await mountAndInit();
        capturedSaveStatusCallback({ success: true, location: 'both' });

        const syncText = document.querySelector('#cloudSyncIndicator .sync-text');
        expect(syncText.textContent).toBe('محفوظ في السحابة');
        expect(document.getElementById('cloudSyncIndicator').style.color).toBe('var(--c-success)');
    });

    it('[إثبات الحارس] العطل الأصلي: نفس نص "محفوظ محلياً" بصرف النظر عن cloudSyncFailed', () => {
        const oldRender = (status) => (status.location === 'both' ? 'محفوظ في السحابة' : 'محفوظ محلياً');
        expect(oldRender({ location: 'local', cloudSyncFailed: true })).toBe('محفوظ محلياً');
        expect(oldRender({ location: 'local', cloudSyncFailed: false })).toBe('محفوظ محلياً');
        // نفس النص حرفياً في الحالتين — هذا بالضبط العطل الذي أُصلح.
    });
});
