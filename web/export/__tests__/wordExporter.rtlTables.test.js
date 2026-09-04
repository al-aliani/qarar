/**
 * تدقيق 2026-09-04: لم يكن أي جدول من الأربعة عشر في تقرير Word معرَّفاً كجدول
 * عربي — صفر `visuallyRightToLeft` وصفر ترقيع `<w:bidiVisual/>`. الخاصية
 * `bidirectional: true` المستخدمة في الملف تخصّ **الفقرات** لا الجداول.
 *
 * والأسوأ أن الملف كان يتناقض داخلياً في افتراض الاتجاه: جدولا المؤشرات والسوق
 * مبنيان بترتيب «القيمة ثم التسمية» (تعويض يدوي لعرض RTL)، بينما قائمة الدخل
 * والتدفقات والميزانية والنسب والمنافسون مبنية بترتيب «البند ثم السنوات» (عرض LTR).
 * فمهما كان الاتجاه الفعلي، نصف جداول المستند معكوس.
 *
 * ملاحظة مهمة للمستقبل: كان موثّقاً في هذا المستودع أن «حزمة docx بلا واجهة برمجية
 * لاتجاه الجداول، والحل ترقيع XML خام». هذا لم يعد صحيحاً — النسخة المثبَّتة 9.7.1
 * تدعم `visuallyRightToLeft` في ITableOptions وتُخرج `<w:bidiVisual/>` فعلاً.
 *
 * هذا الاختبار يبني مستنداً حقيقياً ويقرأ word/document.xml من داخل الملف — لا
 * يكتفي بفحص نص المصدر، لأن ما يهمّ هو ما يصل العميل.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { WordExporter } from '../wordExporter.js';

function fakeStore(state) {
    return { getState: () => state };
}

function salonStudy() {
    return {
        projectInfo: { name: 'صالون اختبار', businessModel: 'Independent', city: 'الرياض', concept: 'صالون / مركز تجميل' },
        assumptions: { projectionYears: 3, discountRate: 0.1, inflationRate: 0.02, taxRate: 0, currency: 'SAR' },
        marketSizing: { tam: { value: 1000000 }, sam: { value: 400000 }, som: { value: 90000 } },
        technical: { equipment: [{ price: 250000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        hr: { positions: [{ position: 'حلاق', count: 3, salary: 4200, months: 12, nationality: 'expat' }] },
        logistics: { logistics: [{ name: 'كهرباء ومياه', monthly: 2800 }] },
        administrative: { administrative: [{ name: 'إيجار المقر', monthly: 22000 }] },
        marketing: { campaigns: [{ name: 'إعلانات', monthly: 3000 }] },
        revenue: { streams: [{ type: 'operating', customersPerMonth: 900, avgPrice: 70, variableCostRate: 0.15, growthRate: 0.05 }] },
        services: { items: [] },
        financing: { sources: {} },
        techResources: { techResources: [] },
        legal: { licenses: [{ name: 'رخصة بلدية', cost: 5000 }] },
        riskAnalysis: {
            risks: [
                { name: 'ارتفاع الإيجار عند التجديد', probability: 'medium', impact: 'high', mitigation: 'عقد ثلاث سنوات بسعر ثابت', owner: 'المالك' },
            ],
        },
    };
}

async function documentXml(state) {
    const exporter = new WordExporter(fakeStore(state));
    const result = await exporter.export();
    expect(result?.blob, 'لم يُنتَج ملف').toBeTruthy();
    const buffer = Buffer.from(await result.blob.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    return zip.file('word/document.xml').async('string');
}

describe('تقرير Word: الجداول معرَّفة كجداول عربية فعلاً', () => {
    it('يُخرج <w:bidiVisual/> لكل جدول في المستند', async () => {
        const xml = await documentXml(salonStudy());
        const tables = (xml.match(/<w:tbl>/g) || []).length;
        const bidi = (xml.match(/<w:bidiVisual\/?>/g) || []).length;
        expect(tables, 'المستند بلا جداول — الثبات غير ذي معنى').toBeGreaterThan(3);
        expect(bidi, `جداول: ${tables} · بـbidiVisual: ${bidi}`).toBe(tables);
    }, 30000);

    it('جدول المؤشرات يبدأ بالتسمية لا بالقيمة (أول عمود يُعرض يميناً مع bidiVisual)', async () => {
        const xml = await documentXml(salonStudy());
        // في RTL البصري، أول خلية في الصف هي أقصى اليمين — فيجب أن تكون «المؤشر»
        const idxIndicator = xml.indexOf('المؤشر');
        const idxValue = xml.indexOf('القيمة');
        expect(idxIndicator).toBeGreaterThan(-1);
        expect(idxValue).toBeGreaterThan(-1);
        expect(idxIndicator, 'التسمية يجب أن تسبق القيمة في ترتيب الخلايا').toBeLessThan(idxValue);
    }, 30000);

    it('سجل المخاطر يبدأ بالخطر لا بالمسؤول', async () => {
        const xml = await documentXml(salonStudy());
        const idxRisk = xml.indexOf('الخطر');
        const idxOwner = xml.indexOf('المسؤول');
        expect(idxRisk).toBeGreaterThan(-1);
        expect(idxOwner).toBeGreaterThan(-1);
        expect(idxRisk).toBeLessThan(idxOwner);
    }, 30000);

    it('قسما الاستثمار والمخاطر يظهران فعلاً في المستند الناتج', async () => {
        const xml = await documentXml(salonStudy());
        expect(xml).toContain('إجمالي الاستثمار المطلوب');
        expect(xml).toContain('سجل المخاطر');
        expect(xml).toContain('ارتفاع الإيجار عند التجديد');
    }, 30000);
});
