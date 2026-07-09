/**
 * دفعة 6 (تدقيق 2026-07-09):
 * FIX A: كائن [SECTIONS.FINANCIAL_STATEMENTS] داخل createEmptyStudy كان يحمل حقولاً
 *   ميتة (incomeStatement/cashFlow/balanceSheet/taxRate/zakatRate) بلا أي قارئ حي
 *   (كل قراءات taxRate الفعلية من study.assumptions.taxRate، وzakatRate ثابت منفصل
 *   في engine.js) — يوحي بأنها تُقرأ فعلياً في مكان ما بينما هي مجرد قيم زائفة.
 *   أُفرِغ الكائن إلى `{}` (تدقيق 2026-07-09 لاحق لهذا الاختبار) مع تعليق يوثّح أن
 *   المفتاح نفسه أُبقي عمداً (SECTIONS.FINANCIAL_STATEMENTS خطوة معالج حية فعلاً،
 *   وحذف المفتاح بالكامل كان سيكسر حارس schema.guard.test.js «كل قسم له قيمة
 *   افتراضية») لكن حقوله الفرعية الميتة حُذفت بدل تركها موحية بحياة لا وجود لها.
 * FIX B: عمود "% استهلاك" (depreciationRate) كان غائباً عن TABLE_SCHEMAS.techResources
 *   رغم أن lib/calc-style depreciation.js (web/js/core/financial/depreciation.js) يدعم
 *   بالفعل item.depreciationRate كتجاوز لكل بند تقني، وبقية جداول الأصول الشقيقة
 *   (buildings/equipment/furniture/vehicles) تملك هذا العمود مسبقاً.
 * FIX C: لا تحقق كان يمنع تجاوز مجموع partnershipContracts[].sharePercent لـ100%.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createEmptyStudy, TABLE_SCHEMAS, SECTIONS } from '../../core/schema.js';
import { validatePartnershipContracts, validateStudy } from '../validation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('FIX A: تنظيف/توثيق قسم FINANCIAL_STATEMENTS الميت', () => {
  it('لا يزال المفتاح معرَّفاً في createEmptyStudy (حُفظ عمداً لأن حذفه كان سيكسر schema.guard.test.js)', () => {
    const study = createEmptyStudy();
    // موثّق: لم يُحذف المفتاح لأن schema.guard.test.js يفرض أن كل مفتاح في SECTIONS
    // له قيمة معرَّفة في createEmptyStudy() — حذفه الكامل يفشل ذلك الحارس القائم.
    expect(study[SECTIONS.FINANCIAL_STATEMENTS]).not.toBeUndefined();
  });

  it('الحقول الميتة (incomeStatement/cashFlow/balanceSheet/taxRate/zakatRate) حُذفت فعلياً من الكائن', () => {
    // الكائن الآن {} فارغ فعلاً بدل حمل حقول زائفة يوحي وجودها بقراءة حية لا وجود لها.
    const study = createEmptyStudy();
    expect(study[SECTIONS.FINANCIAL_STATEMENTS]).toEqual({});

    const schemaSrc = readFileSync(join(__dirname, '../../core/schema.js'), 'utf8');
    expect(schemaSrc).not.toContain('incomeStatement: []');
    expect(schemaSrc).not.toContain('zakatRate: 0.025');
  });
});

describe('FIX B: عمود depreciationRate في TABLE_SCHEMAS.techResources', () => {
  it('يحتوي على عمود depreciationRate بنفس نمط الجداول الشقيقة', () => {
    const cols = TABLE_SCHEMAS.techResources.columns.map(c => c.key);
    expect(cols).toContain('depreciationRate');
  });

  it('تعريف العمود من نوع number وله قيمة افتراضية معقولة (تطابق depreciation.js: 0.25)', () => {
    const col = TABLE_SCHEMAS.techResources.columns.find(c => c.key === 'depreciationRate');
    expect(col).toBeTruthy();
    expect(col.type).toBe('number');
    expect(col.default).toBe(0.25);
  });
});

describe('FIX C: التحقق من مجموع partnershipContracts[].sharePercent', () => {
  it('60% + 50% = 110% يتجاوز 100% وينتج خطأً يذكر التجاوز', () => {
    const r = validatePartnershipContracts([
      { partnerName: 'أحمد', sharePercent: 60 },
      { partnerName: 'سالم', sharePercent: 50 },
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0]).toContain('110');
    expect(r.errors[0]).toContain('100%');
  });

  it('60% + 40% = 100% لا ينتج أي خطأ', () => {
    const r = validatePartnershipContracts([
      { partnerName: 'أحمد', sharePercent: 60 },
      { partnerName: 'سالم', sharePercent: 40 },
    ]);
    expect(r.valid).toBe(true);
    expect(r.errors.length).toBe(0);
  });

  it('مصفوفة فارغة أو غائبة: بلا أخطاء', () => {
    expect(validatePartnershipContracts([]).valid).toBe(true);
    expect(validatePartnershipContracts(undefined).valid).toBe(true);
  });

  it('validateStudy الكلي يلتقط تجاوز 100% عبر keyPeople.partnershipContracts', () => {
    const state = {
      projectInfo: { name: 'مطعم تجريبي' },
      assumptions: {},
      keyPeople: {
        partnershipContracts: [
          { partnerName: 'أحمد', sharePercent: 60 },
          { partnerName: 'سالم', sharePercent: 50 },
        ],
      },
    };
    const r = validateStudy(state);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('110') && e.includes('100%'))).toBe(true);
  });

  it('validateStudy الكلي: 100% بالضبط لا يولّد خطأ الشراكة', () => {
    const state = {
      projectInfo: { name: 'مطعم تجريبي' },
      assumptions: {},
      keyPeople: {
        partnershipContracts: [
          { partnerName: 'أحمد', sharePercent: 60 },
          { partnerName: 'سالم', sharePercent: 40 },
        ],
      },
    };
    const r = validateStudy(state);
    expect(r.errors.some(e => e.includes('ملكية الشركاء'))).toBe(false);
  });
});
