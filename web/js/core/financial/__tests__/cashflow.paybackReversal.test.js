/**
 * مسار موازٍ لعيب فترة الاسترداد المُصحَّح في engine.js (2026-08-25):
 * calculatePaybackPeriod في cashflow.js كانت تعود عند **أول** عبور للتراكمي فوق الصفر
 * (return داخل الحلقة) بلا أي فحص انتكاس. مستهلكها الوحيد ServiceAnalysis.js يعرض الناتج
 * في بطاقة كل خدمة، فخدمةٌ تعبر مبكراً ثم ينهار تراكميها كانت تُعرض «1.7 سنة» رغم أنها
 * لا تسترد رأس مالها إطلاقاً خلال الأفق.
 *
 * الاصطلاح بعد الإصلاح (نفس منطق المحرك): عبورٌ يُلغى بأي انتكاس لاحق لم يتعافَ ⟶ null،
 * وعبورٌ جديد بعد الانتكاس يُسجَّل من جديد. «لم يعبر الصفر قط» يبقى Infinity كما كان.
 */
import { describe, it, expect } from 'vitest';
import { calculatePaybackPeriod } from '../cashflow.js';

describe('calculatePaybackPeriod — الانتكاس بعد العبور يُلغي الاسترداد', () => {
    it('عبور في السنة 2 ثم انتكاس دائم: null لا رقم', () => {
        // التراكمي: −100 ⟶ −40 ⟶ +20 (عبور) ⟶ −180 (انتكاس، ونهاية السلسلة سالبة)
        const series = [-100, 60, 60, -200];
        expect(calculatePaybackPeriod(series)).toBeNull();
    });

    it('نفس السلسلة قبل الانتكاس (مقطوعة عند العبور) تعطي الرقم الذي كان يُعرض خطأً', () => {
        // إثبات أن السلسلة أعلاه فعلاً تعبر مبكراً — الفارق هو ما بعد العبور وحده.
        expect(calculatePaybackPeriod([-100, 60, 60])).toBeCloseTo(1 + 40 / 60, 12);
    });

    it('عبور ويبقى التراكمي ≥ 0 حتى النهاية: الرقم كما هو (لا انحدار في المسار السليم)', () => {
        // التراكمي: −100 ⟶ −40 ⟶ +20 ⟶ +80 — لا انتكاس
        expect(calculatePaybackPeriod([-100, 60, 60, 60])).toBeCloseTo(1 + 40 / 60, 12);
    });

    it('انتكاس ثم تعافٍ دائم: يُعتمد العبور الأخير لا الأول', () => {
        // التراكمي: −100 ⟶ −40 ⟶ +20 ⟶ −180 ⟶ +320
        expect(calculatePaybackPeriod([-100, 60, 60, -200, 500])).toBeCloseTo(3 + 180 / 500, 12);
    });

    it('لم يعبر الصفر إطلاقاً: Infinity (سلوك قائم لم يتغيّر — تعرضه الشاشة «∞»)', () => {
        expect(calculatePaybackPeriod([-100, 10, 10])).toBe(Infinity);
    });

    it('حراس المدخلات كما هي: لا مصفوفة/فارغة/بلا تدفق أولي سالب ⟶ null', () => {
        expect(calculatePaybackPeriod(null)).toBeNull();
        expect(calculatePaybackPeriod([])).toBeNull();
        expect(calculatePaybackPeriod([100, -50])).toBeNull();
    });
});
