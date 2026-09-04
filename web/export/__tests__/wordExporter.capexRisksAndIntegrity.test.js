/**
 * تدقيق 2026-09-04 — رحلة عميل حقيقية وصلت لحظة الشراء:
 *
 * 1) نافذة «معاينة مجانية قبل الشراء — الملف القابل للتعديل» تَعِد بأن النسخة الكاملة
 *    تتضمن «المخاطر» و«طلب التمويل واستخدام الأموال» — وملف Word لم يكن يحوي أياً
 *    منهما إطلاقاً (WORD_SECTION_IDS كان 13 قسماً من 24؛ كلمة 'risks' صفر مرة).
 *    وعد بيعي غير موفّى في منتج يُدفع مقابله 299–4999 ريالاً.
 *
 * 2) انهيار المحرك كان يُبتلع (`catch (_) { this.results = {}; }`) ثم يُكمل بناء
 *    المستند، فيخرج ملف «ناجح» بـNPV صفر وROI 0.0% — العميل يقدّمه للبنك على أنه نتيجة
 *    وهو عطل. الآن يفشل التصدير صراحةً فتصل الرسالة للمستخدم.
 *
 * 3) العملة كانت مثبَّتة 'SAR' رغم أن assumptions.currency حقل حقيقي بست عملات خليجية.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { WORD_SECTION_IDS } from '../wordExporter.js';
import { DEFAULT_REPORT_SECTION_ORDER } from '../../js/core/schema.js';

describe('تقرير Word: الأقسام التي تَعِد بها شاشة البيع موجودة فعلاً', () => {
    it('يتضمن قسم إجمالي الاستثمار المطلوب (capex) وسجل المخاطر (risks)', () => {
        expect(WORD_SECTION_IDS).toContain('capex');
        expect(WORD_SECTION_IDS).toContain('risks');
    });

    it('القسمان المضافان معرَّفان فعلاً في الترتيب المرجعي للتقرير (لا معرّفان مخترعان)', () => {
        expect(DEFAULT_REPORT_SECTION_ORDER).toContain('capex');
        expect(DEFAULT_REPORT_SECTION_ORDER).toContain('risks');
    });

    it('لكل قسم في Word فرع باناء فعلي — لا معرّف يُدرَج ثم يُنتج فراغاً صامتاً', () => {
        const src = readFileSync(
            resolve(dirname(fileURLToPath(import.meta.url)), '../wordExporter.js'),
            'utf8'
        );
        const missing = WORD_SECTION_IDS.filter(id => !src.includes(`case '${id}'`));
        expect(missing, `معرّفات بلا فرع في buildSectionBlocks: ${missing.join(', ')}`).toEqual([]);
    });
});

describe('تقرير Word: انهيار المحرك لا يُنتج مستند أصفار', () => {
    it('يرمي خطأً واضحاً بدل إخراج ملف «ناجح» بمؤشرات صفرية', async () => {
        vi.resetModules();
        vi.doMock('../../js/core/engine.js', () => ({
            calculateStudy: () => { throw new Error('انهيار مُصطنع للاختبار'); },
            resolveDecisionThresholds: () => ({ minNPV: 0, minIRR: 0.15, maxPayback: 3.5, minROI: 0.2 }),
        }));
        const { WordExporter } = await import('../wordExporter.js');
        const store = { getState: () => ({ projectInfo: { name: 'دراسة اختبار' }, assumptions: {} }) };

        expect(() => new WordExporter(store)).toThrow(/تعذّر حساب النموذج المالي/);
        vi.doUnmock('../../js/core/engine.js');
        vi.resetModules();
    });
});
