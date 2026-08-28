/**
 * @vitest-environment jsdom
 *
 * تدقيق أمني 2026-08-27: ShareModal.js كان يُعرِّف escapeHtml محلياً ناقصاً —
 * لا يُهرِّب علامتي التنصيص (" ولا ') رغم أن القيم تُستخدَم داخل سمات HTML
 * مقتبسة بعلامة تنصيص مزدوجة (value="…", data-url="…"). استُبدلت بالنسخة
 * الموحّدة في web/js/utils/escape.js. الاستغلال الواقعي منخفض (المعرّف/الرمز
 * مولَّدان من الخادم لا نصاً حراً من المستخدم)، لكن الإصلاح دفاع بالعمق.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const listSharesMock = vi.fn();

vi.mock('../../services/ShareService.js', () => ({
    createShareLink: vi.fn(),
    listShares: (...a) => listSharesMock(...a),
    revokeShare: vi.fn(),
}));
vi.mock('../../utils/toast.js', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../utils/modalA11y.js', () => ({ attachModalA11y: () => ({ release: vi.fn() }) }));
vi.mock('../../utils/analytics.js', () => ({ trackEvent: vi.fn() }));

describe('ShareModal — تهريب سمات HTML بالكامل (لا "<" فقط)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        listSharesMock.mockReset();
    });

    it('رمز مشاركة يحوي علامة تنصيص مزدوجة لا يكسر سمة value المقتبسة', async () => {
        listSharesMock.mockResolvedValue([
            { id: 'share-1"onmouseover="alert(1)', shareToken: 'tok"onfocus="alert(1)', revoked: false, expiresAt: null },
        ]);

        const { ShareModal } = await import('../ShareModal.js');
        const store = { getState: () => ({ projectInfo: { id: 'study-1' } }) };
        const modal = new ShareModal('shareModalOverlay', store);
        await modal.open();

        const html = document.getElementById('shareModalOverlay').innerHTML;
        expect(html).not.toContain('"onmouseover="alert(1)');
        expect(html).not.toContain('"onfocus="alert(1)');
        expect(html).toContain('&quot;onmouseover=&quot;alert(1)');
    });

    it('[إثبات الحارس] الدالة المحلية القديمة لم تكن تُهرِّب علامة التنصيص المزدوجة', () => {
        function oldEscapeHtml(str) {
            return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        const attack = 'x"onmouseover="alert(1)';
        expect(oldEscapeHtml(attack)).toContain('"onmouseover="alert(1)');
    });
});
