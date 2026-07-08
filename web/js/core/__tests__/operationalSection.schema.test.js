import { describe, it, expect } from 'vitest';
import { SECTIONS, createEmptyStudy } from '../schema.js';

/**
 * تدقيق 2026-07-08 (ملاحظة عالية #26): OperationalSim.js كانت تكتب مباشرة إلى
 * store.update('operational', ...) بلا أي تعريف لهذا القسم في SECTIONS أو
 * createEmptyStudy — فيهبط كمفتاح يتيم غير موثَّق يُنشأ فقط عبر مسار الاحتياط
 * "Section missing, initializing..." في store.js، لا كجزء أصيل من مخطط الدراسة.
 */
describe('قسم operational مسجَّل رسمياً في المخطط (#26)', () => {
  it('SECTIONS يحتوي مفتاح OPERATIONAL بقيمة operational', () => {
    expect(SECTIONS.OPERATIONAL).toBe('operational');
  });

  it('createEmptyStudy() يهيّئ state.operational بقيمة افتراضية متسقة (لا undefined)', () => {
    const study = createEmptyStudy();
    expect(study.operational).toBeDefined();
    expect(typeof study.operational).toBe('object');
    expect(study.operational).toEqual({ arrivalRate: 30, serviceTime: 5, servers: 2 });
  });
});
