import { describe, it, expect } from 'vitest';
import { DecisionDashboard } from '../DecisionDashboard.js';

/**
 * تدقيق 2026-08-27: تأثير الاحتفال (confetti) في render() كان مشروطاً بـ
 * `state.projectInfo?.readinessStatus === 'ready' || (results.indicators.npv > 0)`.
 * الحقل الأول ميت (لا يُكتب في أي مكان بالمستودع، دائماً undefined — تحقق
 * grep شامل)، فالشرط الفعلي كان يسقط دوماً لـ`npv > 0` وحدها: مشروع بفجوة
 * تمويل حرجة أو DSCR مرفوض أو حتى توصية «راجع» صريحة كان يحتفل به المستخدم
 * فوق قرار محجوب فعلياً، طالما NPV رقمياً موجب.
 *
 * shouldCelebrateDecision(readiness, financingDiagnostics) الآن هي البوابة
 * الوحيدة — تُختبر مباشرة بمدخلات readiness/financingDiagnostics الحقيقية
 * (نفس الشكل الذي يُنتجه calculateReadiness/getFinancingDiagnostics) بلا
 * حاجة لتركيب DOM كامل أو محاكاة استيراد canvas-confetti الديناميكي.
 */
const dd = Object.create(DecisionDashboard.prototype);

const goReadiness = { recommendation: { status: 'go' } };
const nogoReadiness = { recommendation: { status: 'nogo' } };
const reviewReadiness = { recommendation: { status: 'review' } };
const cleanFinancing = { hasBlockers: false, dscrBlocked: false };

describe('shouldCelebrateDecision — بوابة الاحتفال تتبع القرار الفعلي لا NPV وحدها', () => {
    it('توصية go + تمويل نظيف ⇒ يحتفل', () => {
        expect(dd.shouldCelebrateDecision(goReadiness, cleanFinancing)).toBe(true);
    });

    it('توصية «راجع» (review) حتى مع تمويل نظيف ⇒ لا يحتفل', () => {
        expect(dd.shouldCelebrateDecision(reviewReadiness, cleanFinancing)).toBe(false);
    });

    it('توصية nogo ⇒ لا يحتفل', () => {
        expect(dd.shouldCelebrateDecision(nogoReadiness, cleanFinancing)).toBe(false);
    });

    it('توصية go لكن حاجز تمويل قائم (hasBlockers) ⇒ لا يحتفل رغم "go"', () => {
        expect(dd.shouldCelebrateDecision(goReadiness, { hasBlockers: true, dscrBlocked: false })).toBe(false);
    });

    it('توصية go لكن DSCR مرفوض (dscrBlocked) ⇒ لا يحتفل رغم "go"', () => {
        expect(dd.shouldCelebrateDecision(goReadiness, { hasBlockers: false, dscrBlocked: true })).toBe(false);
    });

    it('مدخلات ناقصة (undefined) لا تكسر الدالة ولا تحتفل زوراً', () => {
        expect(dd.shouldCelebrateDecision(undefined, undefined)).toBe(false);
        expect(dd.shouldCelebrateDecision({}, {})).toBe(false);
    });

    it('[إثبات الحارس] الحقل الميت القديم readinessStatus="ready" لا يؤثر إطلاقاً على القرار الجديد', () => {
        // لو أُعيد نفس النمط القديم (قراءة حقل غير مكتوب)، فلن يغيّر ذلك نتيجة
        // shouldCelebrateDecision لأنها لا تقرأ state.projectInfo إطلاقاً بعد الآن —
        // التوصية الفعلية (go/nogo/review) هي الإشارة الوحيدة، لا حقل واجهة ميت.
        const readinessWithDeadField = { recommendation: { status: 'review' } };
        const fakeState = { projectInfo: { readinessStatus: 'ready' } };
        expect(fakeState.projectInfo.readinessStatus).toBe('ready'); // الحقل "يبدو" جاهزاً
        expect(dd.shouldCelebrateDecision(readinessWithDeadField, cleanFinancing)).toBe(false); // لكن التوصية الفعلية review تمنع الاحتفال
    });

    it('[إثبات الحارس] NPV موجبة وحدها بلا توصية go لا تكفي للاحتفال بعد الإصلاح', () => {
        // يحاكي بالضبط الحالة التي كانت تُفلت من الشرط القديم: results.indicators.npv > 0
        // مع توصية فعلية "review" (فجوة تمويل مثلاً) — النمط القديم كان OR فيحتفل رغم ذلك.
        expect(dd.shouldCelebrateDecision(reviewReadiness, cleanFinancing)).toBe(false);
    });
});
