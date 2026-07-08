/**
 * تدقيق 2026-07-08 (ملاحظة متوسطة #39): قوائم التراخيص المقترحة تلقائياً كانت تقتصر
 * على 4 بنود فقط وتُغفل متطلبات سعودية شائعة (الغرفة التجارية، التسجيل الضريبي/
 * الزكوي ZATCA، الشهادة الصحية، لافتة المحل)، فيكون تقدير تكلفة التأسيس القانوني
 * ناقصاً. GOSI عمداً غير مُضافة هنا — مُمثَّلة فعلياً كنسبة راتب متكررة في قسم
 * الموارد البشرية (hr.gosiRate) لا كرسم ترخيص لمرة واحدة.
 */
import { describe, it, expect } from 'vitest';
import { generateLicenses } from '../InternalAIGenerator.js';

describe('generateLicenses — متطلبات سعودية شائعة مضافة (#39)', () => {
    it('يتضمن الغرفة التجارية والتسجيل الضريبي/الزكوي ورخصة اللافتات لأي نشاط', () => {
        const licenses = generateLicenses({ projectInfo: { sector: 'مطعم وجبات سريعة' } });
        const names = licenses.map(l => l.name);
        expect(names).toContain('انضمام الغرفة التجارية');
        expect(names.some(n => n.includes('ZATCA'))).toBe(true);
        expect(names).toContain('رخصة لافتات المحل');
    });

    it('نشاط مطاعم يتضمن أيضاً شهادة صحية للعاملين إضافة لرخصة هيئة الغذاء والدواء', () => {
        const licenses = generateLicenses({ projectInfo: { sector: 'مطعم' } });
        const names = licenses.map(l => l.name);
        expect(names).toContain('شهادة صحية للعاملين');
        expect(names).toContain('رخصة هيئة الغذاء والدواء');
    });

    it('لا يضيف بند GOSI كرسم ترخيص (مُمثَّل فعلياً في الموارد البشرية لا هنا)', () => {
        const licenses = generateLicenses({ projectInfo: { sector: 'مطعم' } });
        expect(licenses.some(l => /gosi|تأمينات اجتماعية/i.test(l.name))).toBe(false);
    });
});
