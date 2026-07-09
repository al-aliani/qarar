/**
 * حارس انحدار: بذرة أشهر «مراقبة الأداء الفعلي» (SECTIONS.ACTUALS) يجب أن تبدأ فارغة.
 * السبب: كانت createEmptyStudy() تُغذّي 3 أشهر افتراضية بقيم {revenue:0, opex:0} فيقرأها
 * PostLaunchTracker.renderVarianceSummary كـ"أداء فعلي صفري" منذ اللحظة الأولى، فيظهر
 * انحراف إيرادات -100% ووسم "🔴 أداء أقل من المخطط" لدراسة لم تُفتتح بعد (تدقيق 2026-07-09).
 */
import { describe, it, expect } from 'vitest';
import { createEmptyStudy, SECTIONS } from '../schema.js';

// نفس منطق hasNum في web/js/ui/PostLaunchTracker.js (renderVarianceSummary) — منسوخ حرفياً
// هنا لتفادي استيراد وحدة تتطلب DOM (document.getElementById) في اختبار منطق بيانات بحت.
const hasNum = (v) => v !== '' && v != null && !Number.isNaN(parseFloat(v));

describe('SECTIONS.ACTUALS: بذرة فارغة افتراضياً', () => {
  it('createEmptyStudy().actuals.months مصفوفة فارغة (لا 3 أشهر بصفر ولا أي قيمة أخرى)', () => {
    const study = createEmptyStudy();
    expect(study[SECTIONS.ACTUALS]).toBeTruthy();
    expect(Array.isArray(study[SECTIONS.ACTUALS].months)).toBe(true);
    expect(study[SECTIONS.ACTUALS].months).toEqual([]);
  });

  it('hasNum لا يعتبر أي شهر "مُدخلاً" في مصفوفة فارغة — أي دراسة جديدة تُعامَل كـ"لم تُدخل بيانات بعد"', () => {
    const study = createEmptyStudy();
    const entered = study[SECTIONS.ACTUALS].months.filter(m => hasNum(m.revenue));
    expect(entered.length).toBe(0);
  });

  it('hasNum يميّز شهراً فارغ الحقول ({revenue:"",opex:""}) عن شهر مُدخل فعلياً', () => {
    // محاكاة الشهر الذي يضيفه زر "+ إضافة شهر جديد" في PostLaunchTracker.bindEvents
    const freshMonth = { id: 1, revenue: '', opex: '', notes: '' };
    expect(hasNum(freshMonth.revenue)).toBe(false);

    const enteredMonth = { id: 1, revenue: 5000, opex: 2000, notes: '' };
    expect(hasNum(enteredMonth.revenue)).toBe(true);

    // القيمة الافتراضية القديمة (0 رقمي) كانت تُحسب خطأً كـ"مُدخلة" — نوثّق الفرق صراحة
    const oldBuggySeed = { id: 1, revenue: 0, opex: 0, notes: '' };
    expect(hasNum(oldBuggySeed.revenue)).toBe(true); // 0 رقم صالح فعلاً؛ المشكلة كانت في تواجده أصلاً لا في hasNum
  });
});
