/**
 * @vitest-environment jsdom
 *
 * الزر العائم «المستشار الذكي» يخفت (‎.is-editing‎) أثناء التركيز على حقل إدخال كي
 * لا يحجب ما تحته. المنطق كان معتمداً على أن الزر *شهد* حدث focusin — وهذا سباق:
 * الوحدة تُحمَّل باستيراد ديناميكي (web/app.js) بينما نافذة الدخول تركّز حقل البريد
 * بعد 30ms (focusDelay في AuthModalStub.js). إن اكتمل التحميل بعد لحظة التركيز فات
 * الزرَّ الحدثُ فبقي بكامل التعتيم فوق النافذة إلى أي حدث تركيز لاحق. ظهر السباق
 * كحالتين مختلفتين للقطة homepage-layout من نفس الالتزام.
 *
 * الحلّ المُختبَر هنا: الحالة مشتقّة من document.activeElement لحظة التركيب.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const fakeStore = () => ({
    getState: () => ({ projectInfo: { name: 'مشروع اختبار', id: 'p1' }, results: {}, assumptions: {} }),
    get: () => ({}),
    save: vi.fn(),
    notify: vi.fn(),
    state: {}
});

async function mountChat() {
    const { AIChatModal } = await import('../AIChatModal.js');
    const chat = new AIChatModal(fakeStore());
    chat.mount();
    return chat;
}

describe('AIChatModal — حالة الزر العائم الأولية مشتقّة من الواقع لا من الأحداث', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="appMain"><input id="authEmail" type="email"></main>';
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('حقل مركَّز قبل تركيب الزر ⟹ الزر يُولَد باهتاً (لا ينتظر focusin فائتاً)', async () => {
        document.getElementById('authEmail').focus();
        expect(document.activeElement.id).toBe('authEmail'); // تركيز حقيقي قبل التركيب

        const chat = await mountChat();

        expect(chat.fab.classList.contains('is-editing')).toBe(true);
    });

    it('لا شيء مركَّز عند التركيب ⟹ الزر بكامل التعتيم، وتركيز لاحق يُخفته', async () => {
        const chat = await mountChat();
        expect(chat.fab.classList.contains('is-editing')).toBe(false);

        document.getElementById('authEmail').focus();
        expect(chat.fab.classList.contains('is-editing')).toBe(true);
    });

    it('عنصر مركَّز ليس حقل إدخال (زر) عند التركيب ⟹ الزر بكامل التعتيم', async () => {
        document.body.insertAdjacentHTML('beforeend', '<button id="opener">افتح</button>');
        document.getElementById('opener').focus();

        const chat = await mountChat();

        expect(chat.fab.classList.contains('is-editing')).toBe(false);
    });

    it('رفع التركيز بعد تركيب باهت يُعيد الزر لكامل التعتيم (focusout يبقى عاملاً)', async () => {
        vi.useFakeTimers();
        try {
            document.getElementById('authEmail').focus();
            const chat = await mountChat();
            expect(chat.fab.classList.contains('is-editing')).toBe(true);

            document.getElementById('authEmail').blur();
            await vi.advanceTimersByTimeAsync(200); // مهلة 150ms المضادة للوميض

            expect(chat.fab.classList.contains('is-editing')).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });
});
