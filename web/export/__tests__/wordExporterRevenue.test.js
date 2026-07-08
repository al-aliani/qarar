/**
 * تكامل: قسم «تفصيل مصادر الإيراد» في تصدير Word (wordExporter.js)
 * كان هذا القسم غائباً كلياً؛ نتحقق أنه يُبنى فعلياً عند وجود مصادر إيراد،
 * ويُحذف (بلا «—») حين لا توجد أي مصادر — اتساقاً مع فلسفة الملف نفسه.
 */
import { describe, it, expect } from 'vitest';
import { WordExporter } from '../wordExporter.js';

function fakeStore(state) {
    return { getState: () => state };
}

function baseState(streams) {
    return {
        projectInfo: { name: 'مطعم اختبار', concept: 'مطعم شاورما سريع' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
        marketSizing: {},
        revenue: { streams }
    };
}

describe('WordExporter — قسم revenue_breakdown', () => {
    it('يُدرَج ضمن ترتيب الأقسام', async () => {
        const state = baseState([
            { name: 'شاورما', customersPerMonth: 800, avgPrice: 25 },
            { name: 'مشروبات', customersPerMonth: 400, avgPrice: 10 }
        ]);
        const exporter = new WordExporter(fakeStore(state));
        expect(exporter.getWordSectionOrder()).toContain('revenue_breakdown');
    });

    it('يبني كتلاً فعلية (عنوان + جدول + ملاحظة) عند وجود مصادر إيراد', async () => {
        const state = baseState([
            { name: 'شاورما', customersPerMonth: 800, avgPrice: 25 },
            { name: 'مشروبات', customersPerMonth: 400, avgPrice: 10 }
        ]);
        const exporter = new WordExporter(fakeStore(state));
        const blocks = exporter.buildSectionBlocks('revenue_breakdown');
        expect(Array.isArray(blocks)).toBe(true);
        expect(blocks.length).toBeGreaterThan(1);
    });

    it('يُعيد مصفوفة فارغة حين لا توجد مصادر إيراد (بلا «—»)', async () => {
        const state = baseState([]);
        const exporter = new WordExporter(fakeStore(state));
        const blocks = exporter.buildSectionBlocks('revenue_breakdown');
        expect(blocks).toEqual([]);
    });

    it('export() ينجح فعلياً وينتج ملف DOCX حين توجد مصادر إيراد', async () => {
        const state = baseState([
            { name: 'شاورما', customersPerMonth: 800, avgPrice: 25 },
            { name: 'مشروبات', customersPerMonth: 400, avgPrice: 10 }
        ]);
        const exporter = new WordExporter(fakeStore(state));
        const result = await exporter.export();
        expect(result.success).toBe(true);
        expect(result.blob).toBeTruthy();
    });
});
