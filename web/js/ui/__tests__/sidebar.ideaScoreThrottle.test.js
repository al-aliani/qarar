/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-09 (علة #2): calculateIdeaScore(state) بلا results جاهزة يُشغّل
 * calculateStudy() الكاملة داخلياً (المحرك المالي بأكمله). وSidebar.render() يُستدعى
 * مئات المرات في جلسة إدخال واحدة — عبر اشتراك store.subscribe (مُهدَّأ 500ms) وأيضاً
 * عبر نداءات مباشرة (نقر رأس قسم قابل للطي، setActive عند التنقل) لا تمر بأي تهدئة
 * إطلاقاً. الإصلاح: تخزين مؤقت زمني بسيط (this._ideaCache/_ideaCacheAt) يعيد استخدام
 * آخر نتيجة idea محسوبة إن مرّ أقل من 400ms منذ آخر حساب فعلي — بلا حذف للحساب ذاته،
 * فقط تحديد وتيرته الأقصى. هذا الاختبار يثبت فعلياً أن calculateIdeaScore لا يُستدعى
 * إلا مرة واحدة عبر نداءات render() متلاحقة خلال أقل من 400ms، ويُعاد استدعاؤه بعد
 * تجاوز 400ms.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const calculateIdeaScoreMock = vi.fn(() => ({
    score: 42,
    color: 'yellow',
    breakdown: { completeness: 10, margin: 20, tam: 22 },
    message: 'فكرة جيدة'
}));

vi.mock('../../core/calculateIdeaScore.js', () => ({
    calculateIdeaScore: (...args) => calculateIdeaScoreMock(...args)
}));

// تفادي أي نشاط شبكي حقيقي (Supabase الفعلي) أثناء render() -> updateAuthWidget()
vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: null, ok: false, error: '' })),
    signOut: vi.fn(async () => {})
}));

const { Sidebar } = await import('../Sidebar.js');

function fakeStore(state) {
    return {
        getState: () => state,
        get: () => state,
        subscribe: () => () => {}
    };
}

describe('Sidebar — تهدئة حساب نتيجة الفكرة داخل render() (علة #2)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        calculateIdeaScoreMock.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('نداءات render() متلاحقة خلال أقل من 400ms تعيد استخدام نفس النتيجة (لا حساب مكرر)', async () => {
        const sidebar = new Sidebar('c', [], () => {}, fakeStore({ projectInfo: { name: 'مشروع' } }));

        await sidebar.render();
        expect(calculateIdeaScoreMock).toHaveBeenCalledTimes(1);

        // نداءات متكررة فورية (تحاكي نقرات أقسام متتالية) — لا تتجاوز 400ms بينها
        await sidebar.render();
        await sidebar.render();
        await sidebar.render();

        expect(calculateIdeaScoreMock).toHaveBeenCalledTimes(1);
    });

    it('بعد تجاوز 400ms منذ آخر حساب فعلي، يُعاد استدعاء calculateIdeaScore', async () => {
        vi.useFakeTimers();
        try {
            const sidebar = new Sidebar('c', [], () => {}, fakeStore({ projectInfo: { name: 'مشروع' } }));

            await sidebar.render();
            expect(calculateIdeaScoreMock).toHaveBeenCalledTimes(1);

            // أقل من 400ms — يجب ألا يُعاد الحساب
            vi.advanceTimersByTime(200);
            await sidebar.render();
            expect(calculateIdeaScoreMock).toHaveBeenCalledTimes(1);

            // تجاوز 400ms منذ الحساب الأول — يجب إعادة الحساب فعلياً
            vi.advanceTimersByTime(250); // المجموع منذ آخر حساب: 450ms
            await sidebar.render();
            expect(calculateIdeaScoreMock).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });
});
