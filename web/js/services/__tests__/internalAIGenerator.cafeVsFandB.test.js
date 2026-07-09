/**
 * تدقيق 2026-07-09 (اختبار عميل حي: دراسة مقهى مختص): generateProducts/generateIntroServices/
 * generateBuildings/generateEquipment كانت تُصنّف "كافيه/مقهى مختص" ضمن دلو "isFandB" العام
 * فتقترح "الأطباق الرئيسية" و"مطبخ تجاري وتهوية" (120,000 ريال) — تناقض مباشر مع
 * generatePositions لنفس النشاط الذي لا يقترح أي شيف أو مطبخ (باريستا فقط). الإصلاح: فحص
 * isCafe قبل isFandB في الدوال الأربع، بنفس النمط المستخدم أصلاً في generatePositions.
 */
import { describe, it, expect } from 'vitest';
import { generateProducts, generateIntroServices, generateBuildings, generateEquipment, generatePositions, generateCustomerValues, generateRevenueStreams } from '../InternalAIGenerator.js';

describe('مقهى مختص لا يُعامَل كمطعم كامل الطهي (#cafe-vs-fandb)', () => {
    const cafeState = { projectInfo: { concept: 'كافيه/مقهى مختص', sector: 'كافيه/مقهى مختص' } };
    const restaurantState = { projectInfo: { concept: 'مطعم', sector: 'مطعم' } };

    it('generateProducts: مقهى لا يقترح "الأطباق الرئيسية"، ويقترح مشروبات مختصة وحبوب بن', () => {
        const products = generateProducts(cafeState);
        const names = products.map(p => p.name);
        expect(names.some(n => n.includes('الأطباق الرئيسية'))).toBe(false);
        expect(names.some(n => n.includes('المشروبات المختصة'))).toBe(true);
        expect(names.some(n => n.includes('حبوب بن'))).toBe(true);
    });

    it('generateProducts: مطعم عادي ما زال يقترح الأطباق الرئيسية (لا تراجع في السلوك الأصلي)', () => {
        const products = generateProducts(restaurantState);
        expect(products.map(p => p.name)).toContain('الأطباق الرئيسية');
    });

    it('generateIntroServices: مقهى لا يقترح خدمة كيترنق/مناسبات، ويقترح سفري وبيع حبوب بن', () => {
        const services = generateIntroServices(cafeState);
        const names = services.map(s => s.name);
        expect(names.some(n => n.includes('كيترنق'))).toBe(false);
        expect(names.some(n => n.includes('السفري'))).toBe(true);
    });

    it('generateBuildings: مقهى لا يُحمَّل ببند "مطبخ تجاري وتهوية" (120,000 ريال)', () => {
        const buildings = generateBuildings(cafeState);
        const names = buildings.map(b => b.name);
        expect(names.some(n => n.includes('مطبخ تجاري'))).toBe(false);
        expect(names.some(n => n.includes('بار تحضير المشروبات'))).toBe(true);
    });

    it('generateBuildings: مطعم عادي ما زال يُحمَّل ببند المطبخ التجاري (لا تراجع)', () => {
        const buildings = generateBuildings(restaurantState);
        const item = buildings.find(b => b.name.includes('مطبخ تجاري'));
        expect(item).toBeDefined();
        expect(item.price).toBe(120000);
    });

    it('generateEquipment: مقهى لا يقترح "فرن ومعدات طهي"، ويقترح ماكينة اسبريسو ومطاحن', () => {
        const equipment = generateEquipment(cafeState);
        const names = equipment.map(e => e.name);
        expect(names.some(n => n.includes('فرن ومعدات طهي'))).toBe(false);
        expect(names.some(n => n.includes('اسبريسو'))).toBe(true);
    });

    it('الاتساق مع generatePositions: مقهى بلا شيف/مطبخ في المناصب، ومتّسق مع عدم وجود بند مطبخ تجاري', () => {
        const positions = generatePositions(cafeState);
        expect(positions.some(p => /شيف|مطبخ/i.test(p.position))).toBe(false);
        expect(positions.some(p => /باريستا/i.test(p.position))).toBe(true);
    });

    it('generateCustomerValues: مقهى لا يقترح "وجبة عائلية"/"وجبة سريعة"، ويقترح شرائح مرتبطة بالقهوة', () => {
        const values = generateCustomerValues(cafeState);
        const needs = values.map(v => v.customerNeed);
        expect(needs.some(n => /وجبة/i.test(n))).toBe(false);
        expect(values.some(v => /قهوة/i.test(v.customerNeed) || /قهوة/i.test(v.valueWeProvide))).toBe(true);
    });

    it('generateRevenueStreams: مقهى بمتوسط فاتورة مشروب (٢٠) لا فاتورة وجبة مطعم كاملة (٤٥)', () => {
        const streams = generateRevenueStreams(cafeState);
        expect(streams.every(s => s.avgPrice < 35)).toBe(true);
        expect(streams.some(s => s.avgPrice === 45)).toBe(false);
    });

    it('generateRevenueStreams: مطعم عادي ما زال بمتوسط فاتورة ٤٥ (لا تراجع)', () => {
        const streams = generateRevenueStreams(restaurantState);
        expect(streams.some(s => s.avgPrice === 45)).toBe(true);
    });
});
