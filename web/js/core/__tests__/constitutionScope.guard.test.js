/**
 * حارس اتساق دستور المنتج (تدقيق 2026-07-08، ملاحظة حرجة مدير المنتج):
 * كان PRODUCT_CONSTITUTION.md يعلن "مطاعم السعودية فقط" بينما fieldOptions.js/
 * sectorBenchmarks.js/InternalAIGenerator.js تدعم فعلياً 6 قطاعات — قرار حُسم بتحديث
 * الدستور رسمياً (لا حذف الكود العامل). هذا يمنع عودة نفس التناقض صامتاً مستقبلاً:
 * إن أُضيف قطاع جديد للمحرك دون ذكره في الدستور، أو رجع ادّعاء "فقط" الحصري، يفشل الاختبار.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SECTOR_BENCHMARKS } from '../sectorBenchmarks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONSTITUTION_PATH = resolve(__dirname, '../../../../PRODUCT_CONSTITUTION.md');

describe('اتساق نطاق الدستور مع القطاعات المدعومة فعلياً في المحرك', () => {
    it('لا يدّعي الدستور حصر النطاق بالمطاعم فقط بينما المحرك يدعم قطاعات أخرى', () => {
        const text = readFileSync(CONSTITUTION_PATH, 'utf8');
        expect(text).not.toMatch(/للمطاعم داخل السعودية فقط/);
        expect(text).not.toMatch(/محاكي جدوى معياري للمطاعم داخل السعودية فقط/);
    });

    it('الدستور يقر صراحة بدعم قطاعات مساندة (لا سكوت عن الواقع الفعلي في الكود)', () => {
        const text = readFileSync(CONSTITUTION_PATH, 'utf8');
        expect(text).toMatch(/قطاعات مساندة/);
    });

    it('كل قطاع فعلي في sectorBenchmarks.js مذكور بكلمة مفتاحية في الدستور — لا قطاع صامت غير مُقَرّ به', () => {
        const text = readFileSync(CONSTITUTION_PATH, 'utf8');
        const sectorKeywordHints = {
            fnb: 'مطاعم',
            retail: 'تجزئة',
            retailHighMargin: 'تجزئة', // متغيّر هامش أعلى من نفس فئة التجزئة، لا قطاع CONCEPT_OPTIONS مستقل
            service: 'خدم',
            industrial: 'تصنيع|صناع',
            logistics: 'نقل وشحن|لوجستي',
            saas: 'تقني|SaaS',
        };
        Object.keys(SECTOR_BENCHMARKS).forEach(sectorKey => {
            const hint = sectorKeywordHints[sectorKey];
            expect(hint, `أضف كلمة مفتاحية لقطاع جديد "${sectorKey}" في sectorKeywordHints أعلاه`).toBeDefined();
            const re = new RegExp(hint);
            expect(re.test(text), `قطاع "${sectorKey}" مدعوم في sectorBenchmarks.js لكن غير مذكور في PRODUCT_CONSTITUTION.md`).toBe(true);
        });
    });
});
