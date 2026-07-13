/**
 * validateProjectInfo وvalidateAssumptions تحوّلتا من سلسلة if يدوية إلى zod (superRefine)
 * — هذا الاختبار يثبّت أن السلوك الملاحَظ (valid/errors) طابَق النسخة القديمة تماماً عبر بطارية
 * حالات حافة (حدود، NaN، أنواع خاطئة، فراغ)، لا فقط الحالات السعيدة المُغطاة سابقاً.
 */
import { describe, it, expect } from 'vitest';
import { validateProjectInfo, validateAssumptions } from '../validation.js';

describe('validateProjectInfo — حالات حافة', () => {
  const cases = [
    { label: 'null', input: null, valid: false },
    { label: 'undefined', input: undefined, valid: false },
    { label: 'نص بدل كائن', input: 'abc', valid: false },
    { label: 'كائن فارغ', input: {}, valid: true },
    { label: 'اسم موجود، بلا وصف/فكرة', input: { name: '' }, valid: true },
    { label: 'اسم فارغ + وصف موجود ⇒ خطأ', input: { name: '  ', description: 'شيء' }, valid: false },
    { label: 'اسم فارغ + concept موجود ⇒ خطأ', input: { name: '', concept: 'فكرة' }, valid: false },
    { label: 'اسم غير فارغ + وصف ⇒ صالح', input: { name: 'مشروعي', description: 'شيء' }, valid: true },
    { label: 'areaSize موجب ⇒ صالح', input: { areaSize: 120 }, valid: true },
    { label: 'areaSize صفر ⇒ صالح (ليس سالباً)', input: { areaSize: 0 }, valid: true },
    { label: 'areaSize سالب ⇒ خطأ', input: { areaSize: -5 }, valid: false },
    { label: 'areaSize نص رقمي ⇒ يُحوَّل ويُقبل', input: { areaSize: '150' }, valid: true },
    { label: 'areaSize نص غير رقمي ⇒ NaN ⇒ خطأ', input: { areaSize: 'abc' }, valid: false },
    { label: 'areaSize null ⇒ يُتجاهل (لا خطأ)', input: { areaSize: null }, valid: true },
    { label: 'areaSize فارغ "" ⇒ يُتجاهل (لا خطأ)', input: { areaSize: '' }, valid: true },
    { label: 'اسم فارغ + وصف + مساحة سالبة ⇒ خطآن', input: { name: '', description: 'x', areaSize: -1 }, valid: false, errCount: 2 },
  ];

  for (const c of cases) {
    it(c.label, () => {
      const r = validateProjectInfo(c.input);
      expect(r.valid).toBe(c.valid);
      if (c.errCount != null) expect(r.errors).toHaveLength(c.errCount);
    });
  }
});

describe('validateAssumptions — حالات حافة', () => {
  const cases = [
    { label: 'null ⇒ صالح دائماً (لا افتراضات = لا خطأ)', input: null, valid: true },
    { label: 'كائن فارغ ⇒ discountRate وworkingCapitalMonths مفقودان ⇒ خطآن', input: {}, valid: false, errCount: 2 },
    { label: 'كل شيء ضمن الحدود ⇒ صالح', input: { taxRate: 0.15, discountRate: 0.1, projectionYears: 5, workingCapitalMonths: 3 }, valid: true },
    { label: 'taxRate = 1 (حد أعلى) ⇒ صالح', input: { taxRate: 1, discountRate: 0.1, workingCapitalMonths: 1 }, valid: true },
    { label: 'taxRate = 1.01 ⇒ خطأ', input: { taxRate: 1.01, discountRate: 0.1, workingCapitalMonths: 1 }, valid: false },
    { label: 'taxRate سالب ⇒ خطأ', input: { taxRate: -0.01, discountRate: 0.1, workingCapitalMonths: 1 }, valid: false },
    { label: 'discountRate = 0 (حد أدنى) ⇒ صالح', input: { discountRate: 0, workingCapitalMonths: 0 }, valid: true },
    { label: 'discountRate = 0.5 (حد أعلى) ⇒ صالح', input: { discountRate: 0.5, workingCapitalMonths: 0 }, valid: true },
    { label: 'discountRate > 0.5 ⇒ خطأ', input: { discountRate: 0.51, workingCapitalMonths: 0 }, valid: false },
    { label: 'discountRate مفقود ⇒ خطأ واحد فقط لهذا الحقل', input: { workingCapitalMonths: 2 }, valid: false, errCount: 1 },
    { label: 'workingCapitalMonths مفقود ⇒ خطأ واحد فقط لهذا الحقل', input: { discountRate: 0.1 }, valid: false, errCount: 1 },
    { label: 'workingCapitalMonths = 24 (حد أعلى) ⇒ صالح', input: { discountRate: 0.1, workingCapitalMonths: 24 }, valid: true },
    { label: 'workingCapitalMonths > 24 ⇒ خطأ', input: { discountRate: 0.1, workingCapitalMonths: 25 }, valid: false },
    { label: 'inflationRate خارج 0-20% ⇒ خطأ', input: { discountRate: 0.1, workingCapitalMonths: 1, inflationRate: 0.3 }, valid: false },
    { label: 'projectionYears خارج 1-30 ⇒ خطأ', input: { discountRate: 0.1, workingCapitalMonths: 1, projectionYears: 40 }, valid: false },
    { label: 'years (بديل projectionYears) خارج 1-30 ⇒ خطأ', input: { discountRate: 0.1, workingCapitalMonths: 1, years: 0 }, valid: false },
    { label: 'كل الحقول فاسدة معاً ⇒ 4 أخطاء (ضريبة، خصم، تضخم، سنوات) + workingCapital صالح', input: { taxRate: 5, discountRate: 0.9, inflationRate: 1, projectionYears: 100, workingCapitalMonths: 5 }, valid: false, errCount: 4 },
  ];

  for (const c of cases) {
    it(c.label, () => {
      const r = validateAssumptions(c.input);
      expect(r.valid).toBe(c.valid);
      if (c.errCount != null) expect(r.errors).toHaveLength(c.errCount);
    });
  }
});
