/**
 * تدقيق 2026-07-09 (اختبار عميل حي: دراسة مقهى — كشفته نتيجة NPV سالبة غير متوقعة):
 * generateLogistics كان يضيف بند "إيجار الموقع" (8,000 ريال/شهر افتراضياً) لكل القطاعات،
 * بينما schema.js يضيف بالفعل صفاً افتراضياً منفصلاً "إيجار المحل (الصالة/المطبخ)" في جدول
 * الموارد الإدارية (أُضيف في تدقيق سابق خصيصاً لأن الإيجار لم يكن له حقل مستقل). النتيجة:
 * مستخدم يملأ الجدولين عبر "اقتراح بنود" يُحتسب له نفس الإيجار الفعلي مرتين في التكاليف
 * الثابتة — يضخّم المصروفات ويحوّل مشاريع رابحة إلى NPV سالب زوراً. القطاع الصحي كان له
 * نفس المشكلة ("إيجار عيادة/مقر"). الإصلاح: مصدر واحد للإيجار (الإداري) لكل القطاعات.
 */
import { describe, it, expect } from 'vitest';
import { generateLogistics } from '../InternalAIGenerator.js';

describe('generateLogistics لا يضيف بند إيجار مكرر (#rent-double-count)', () => {
    it('مقهى: لا بند "إيجار الموقع" (الإيجار الوحيد مصدره الموارد الإدارية)', () => {
        const items = generateLogistics({ projectInfo: { concept: 'كافيه/مقهى مختص', sector: 'كافيه/مقهى مختص' } });
        expect(items.some(i => /إيجار/.test(i.name))).toBe(false);
    });

    it('صحي: لا بند "إيجار عيادة/مقر" (نفس منطق المصدر الواحد)', () => {
        const items = generateLogistics({ projectInfo: { concept: 'عيادة', sector: 'رعاية صحية / عيادة' } });
        expect(items.some(i => /إيجار/.test(i.name))).toBe(false);
    });

    it('مطعم عادي: لا بند إيجار أيضاً (السلوك موحّد عبر كل القطاعات)', () => {
        const items = generateLogistics({ projectInfo: { concept: 'مطعم', sector: 'مطعم' } });
        expect(items.some(i => /إيجار/.test(i.name))).toBe(false);
    });

    it('لوجستي: يبقى بند "إيجار مستودع/منصة" (مصروف مختلف فعلياً عن إيجار المحل التجاري)', () => {
        const items = generateLogistics({ projectInfo: { concept: 'شحن ونقل', sector: 'نقل وتوزيع وتخزين' } });
        expect(items.some(i => i.name.includes('مستودع'))).toBe(true);
    });
});
