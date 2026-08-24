/**
 * countSignChanges — عدّاد تغيّرات الإشارة (قاعدة ديكارت) المستخدم للتحذير من احتمال
 * تعدد جذور IRR. الأصفار تُتجاهَل تماماً ولا تُحتسَب كتغيّر.
 */
import { describe, it, expect } from 'vitest';
import { countSignChanges } from '../cashflow.js';

describe('countSignChanges', () => {
    it('صفر تغيّرات: كل التدفقات بنفس الإشارة (لا استثمار متبوع بعائد)', () => {
        expect(countSignChanges([100, 300, 400, 500, 600])).toBe(0);
    });

    it('تغيّر واحد: استثمار ثم عوائد موجبة (الحالة التقليدية)', () => {
        expect(countSignChanges([-1600, 5000, 6000])).toBe(1);
    });

    it('تغيّران: استثمار ثم عائد موجب ثم تدفق سالب كبير (استبدال معدات) — تعدد جذور محتمل', () => {
        expect(countSignChanges([-1600, 10000, -10000])).toBe(2);
    });

    it('يتجاهل الأصفار تماماً ولا يعاملها كإشارة', () => {
        expect(countSignChanges([-1000, 0, 500, 0, 600])).toBe(1);
    });
});
