import { describe, it, expect } from 'vitest';
import { generateCustomerPersonas } from '../InternalAIGenerator.js';

describe('generateCustomerPersonas — شخصيات عميل من ديموغرافيا SAM', () => {
    it('يعيد 2-3 شخصيات بحقول غير فارغة لدراسة مطعم في الرياض', () => {
        const state = { projectInfo: { concept: 'مطعم وجبات سريعة', city: 'الرياض' } };
        const personas = generateCustomerPersonas(state);
        expect(personas.length).toBeGreaterThanOrEqual(2);
        expect(personas.length).toBeLessThanOrEqual(3);
        personas.forEach(p => {
            expect(p.name).toBeTruthy();
            expect(p.ageBand).toBeTruthy();
            expect(p.incomeBand).toBeTruthy();
            expect(p.need).toBeTruthy();
        });
    });

    it('لا يرمي خطأ مع state فارغ أو ناقص تماماً', () => {
        expect(() => generateCustomerPersonas({})).not.toThrow();
        expect(() => generateCustomerPersonas(undefined)).not.toThrow();
        const personas = generateCustomerPersonas({});
        expect(personas.length).toBeGreaterThanOrEqual(2);
    });

    it('فئة الدخل تختلف باختلاف دخل المدينة الفعلي (الرياض أعلى من نجران)', () => {
        const richer = generateCustomerPersonas({ projectInfo: { concept: 'مطعم', city: 'الرياض' } });
        const poorer = generateCustomerPersonas({ projectInfo: { concept: 'مطعم', city: 'نجران' } });
        expect(richer[0].incomeBand).not.toBe(poorer[0].incomeBand);
    });

    it('القطاع يغيّر نص الحاجة/الأسماء بين مطعم ومنصة SaaS لنفس المدينة', () => {
        const fnb = generateCustomerPersonas({ projectInfo: { concept: 'مطعم مأكولات', city: 'جدة' } });
        const saas = generateCustomerPersonas({ projectInfo: { concept: 'منصة برمجية SaaS اشتراكات', city: 'جدة' } });
        const fnbNames = fnb.map(p => p.name).join('|');
        const saasNames = saas.map(p => p.name).join('|');
        expect(fnbNames).not.toBe(saasNames);
    });
});
