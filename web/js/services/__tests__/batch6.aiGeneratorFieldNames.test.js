/**
 * دفعة 6 (2026-07-09): ثلاث إصلاحات مترابطة في InternalAIGenerator.js/sectionExporter.js.
 *
 * 1) generateIntroSuggestions() كانت تكتب حقول المنتج المقترحة بالأسماء القديمة
 *    uniqueCharacteristics/addedValue بينما الـschema/IntroductionView.js/التقرير
 *    المُصدَّر جميعها تستخدم uniqueFeatures/valueAdded فعلياً — ما يفقد بيانات
 *    اقتراح الذكاء الداخلي بصمت (لا تُقرأ أبداً في أي مكان آخر بالتطبيق).
 * 2) sectionExporter.js's handleProjectIntroSection() كانت تقرأ نفس الأسماء القديمة
 *    من كائن المنتج فتُصدِّر عمودين فارغين حتى مع إدخال صحيح عبر IntroductionView.js.
 * 3) generateLicenses() لنشاط مطاعم كانت تُغفل تصريح شفاط المطبخ/التهوية (شبه إلزامي
 *    لمطابخ المطاعم بالسعودية).
 * 4) generateSWOT()'s opportunities كانت 4 عبارات شبه ثابتة (فقط الأولى تُقحم فيها
 *    concept/city) — الآن تُبنى فرصتان إضافيتان من بيانات فعلية (marketSizing TAM/SOM
 *    وعدد المنافسين المرصودين في marketing.competitors) على غرار إصلاح threats سابقاً.
 */
import { describe, it, expect } from 'vitest';
import { generateIntroSuggestions, generateLicenses, generateSWOT } from '../InternalAIGenerator.js';
import { handleProjectIntroSection } from '../../utils/sectionExporter.js';

describe('batch6 — إصلاح أسماء حقول المنتج + تصريح شفاط المطبخ + فرص SWOT ديناميكية', () => {
    it('generateIntroSuggestions ينتج منتجات بمفتاح uniqueFeatures لا الأسماء القديمة', () => {
        // تدقيق دفعة 3 (2026-07-12): valueAdded دُمج داخل uniqueFeatures في schema.js
        // (products.uniqueFeatures) — لم يعد عمود schema مستقلاً؛ التحقق هنا يقتصر على
        // uniqueFeatures ولا يفترض وجود valueAdded كمفتاح منفصل بعد الآن.
        // فرع القهوة (منتج مُفصَّل يدوياً بالكامل)
        const coffeeState = { projectInfo: { concept: 'قهوة مختصة', city: 'الرياض', name: 'مقهى تجربة' } };
        const coffeeOut = generateIntroSuggestions(coffeeState);
        expect(coffeeOut.products.length).toBeGreaterThan(0);
        coffeeOut.products.forEach(p => {
            expect(p).toHaveProperty('uniqueFeatures');
            expect(p).not.toHaveProperty('uniqueCharacteristics');
            expect(p).not.toHaveProperty('addedValue');
        });
        expect(coffeeOut.products[0].uniqueFeatures).toMatch(/مذاق مميز/);
        expect(coffeeOut.products[0].uniqueFeatures).toMatch(/الطعم المر/);

        // الفرع العام (concept لا يطابق نمط القهوة)
        const genericState = { projectInfo: { concept: 'خدمات تنظيف مكاتب', city: 'جدة', name: 'مشروع عام' } };
        const genericOut = generateIntroSuggestions(genericState);
        expect(genericOut.products.length).toBeGreaterThan(0);
        genericOut.products.forEach(p => {
            expect(p).toHaveProperty('uniqueFeatures');
            expect(p).not.toHaveProperty('uniqueCharacteristics');
            expect(p).not.toHaveProperty('addedValue');
        });
    });

    it('sectionExporter.handleProjectIntroSection يقرأ uniqueFeatures ويدرجه فعلياً في الإخراج (لا فارغاً)، ويدمج valueAdded القديم إن وُجد في دراسة محفوظة سابقاً', () => {
        const pi = {
            products: [
                {
                    type: 'final',
                    name: 'قهوة مختصة',
                    description: 'وصف المنتج',
                    uniqueFeatures: 'تحميص محلي حسب الطلب',
                    // valueAdded: حقل قديم قد يبقى في دراسات محفوظة قبل الدمج (دفعة 3) —
                    // يُدمج عرضاً فقط مع uniqueFeatures بدل أن يضيع صامتاً.
                    valueAdded: 'هامش ربح أعلى من المنافسين',
                    customerBenefit: 'طعم مميز'
                }
            ]
        };
        const rows = handleProjectIntroSection(pi);
        const productRow = rows.find(r => Array.isArray(r) && r.some(cell => String(cell).includes('تحميص محلي حسب الطلب')));
        expect(productRow).toBeTruthy();
        expect(productRow.join(' | ')).toContain('هامش ربح أعلى من المنافسين');
    });

    it('generateLicenses لمشروع مطاعم يتضمن تصريح شفاط المطبخ/التهوية', () => {
        const licenses = generateLicenses({ projectInfo: { sector: 'مطعم وجبات سريعة' } });
        const names = licenses.map(l => l.name);
        expect(names.some(n => /شفاط|تهوية/.test(n))).toBe(true);

        const hoodLicense = licenses.find(l => /شفاط|تهوية/.test(l.name));
        expect(hoodLicense).toBeTruthy();
        expect(typeof hoodLicense.price).toBe('number');
        expect(hoodLicense.price).toBeGreaterThan(0);
        expect(hoodLicense.notes).toMatch(/البلدية|الدفاع المدني/);

        // لا يُضاف للأنشطة غير المطاعم
        const retailLicenses = generateLicenses({ projectInfo: { sector: 'بقالة تجزئة' } });
        expect(retailLicenses.some(l => /شفاط/.test(l.name))).toBe(false);
    });

    it('generateSWOT: مصفوفة opportunities تختلف بين مشروعين لهما بيانات تحجيم سوق/منافسين مختلفة فعلياً', () => {
        const baseProjectInfo = { concept: 'مطعم', city: 'الرياض', name: 'مشروع تجربة' };

        // مشروع أ: سوق كلي كبير جداً مقارنة بالحصة المستهدفة + منافسون قليلون مرصودون
        const stateA = {
            projectInfo: baseProjectInfo,
            marketSizing: { tam: { value: 500000000 }, som: { value: 2000000 } },
            marketing: { competitors: [{ name: 'منافس واحد' }] }
        };

        // مشروع ب: لا بيانات تحجيم سوق ولا منافسين مرصودين إطلاقاً
        const stateB = {
            projectInfo: baseProjectInfo,
            marketSizing: {},
            marketing: { competitors: [] }
        };

        const swotA = generateSWOT(stateA);
        const swotB = generateSWOT(stateB);

        expect(Array.isArray(swotA.opportunities)).toBe(true);
        expect(Array.isArray(swotB.opportunities)).toBe(true);

        // على الأقل عبارة واحدة يجب أن تختلف بين المشروعين رغم تطابق concept/city
        const differs = swotA.opportunities.some((item, i) => item !== swotB.opportunities[i])
            || swotA.opportunities.length !== swotB.opportunities.length;
        expect(differs).toBe(true);

        // مشروع أ (سوق كبير) يجب أن يذكر حجم السوق (TAM) صراحة في إحدى الفرص
        expect(swotA.opportunities.some(o => /TAM|حجم السوق الكلي/.test(o))).toBe(true);
        // مشروع أ (منافس واحد فقط) يجب أن يذكر محدودية التنافس
        expect(swotA.opportunities.some(o => /محدود التشبع بالمنافسين/.test(o))).toBe(true);
    });
});
