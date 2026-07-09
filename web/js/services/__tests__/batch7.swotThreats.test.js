/**
 * دفعة 7 (2026-07-09): generateSWOT()'s threats كانت 3 نصوص ثابتة حرفياً لكل مشروع
 * بلا استثناء (خلافاً لـ weaknesses/opportunities المبنيتين فعلياً من إشارات الحالة).
 * الإصلاح: نفس الأساس الثلاثي أصبح يتفرّع بحسب:
 *   1) عدد المنافسين المرصودين فعلياً (marketing.competitors.length)
 *   2) طبيعة النشاط الفعلي (مطعم/مقهى → تقلب أسعار المواد الغذائية تحديداً، وإلا تكاليف تشغيل عامة)
 *   3) تنوع مصادر الإيراد (streams.length) بنفس منطق weaknesses
 * منطق إلحاق riskList.slice(0,2) الإضافي لم يُمس.
 */
import { describe, it, expect } from 'vitest';
import { generateSWOT } from '../InternalAIGenerator.js';

describe('batch7 — generateSWOT threats ديناميكية بدل 3 نصوص ثابتة', () => {
    it('مشروع مطعم بمنافسين قليلين ومصدر إيراد واحد ينتج تهديدات مختلفة عن مشروع خدمي متنوع بمنافسين كُثر', () => {
        const restaurantState = {
            projectInfo: { sector: 'مطعم وجبات سريعة', concept: 'مطعم', city: 'الرياض', name: 'مشروع أ' },
            marketing: { competitors: [] }, // لا منافسين مرصودين إطلاقاً
            revenue: { revenueStreams: ['بيع الوجبات'] } // مصدر إيراد واحد فقط
        };

        const consultingState = {
            projectInfo: { sector: 'خدمات استشارية إدارية', concept: 'استشارات', city: 'جدة', name: 'مشروع ب' },
            marketing: { competitors: [{ name: 'م1' }, { name: 'م2' }, { name: 'م3' }, { name: 'م4' }] }, // 4 منافسين مرصودين
            revenue: { revenueStreams: ['استشارات', 'تدريب', 'تقارير'] } // مصادر إيراد متنوعة
        };

        const swotRestaurant = generateSWOT(restaurantState);
        const swotConsulting = generateSWOT(consultingState);

        expect(Array.isArray(swotRestaurant.threats)).toBe(true);
        expect(Array.isArray(swotConsulting.threats)).toBe(true);

        // 1) تهديد المنافسة: يختلف بحسب عدد المنافسين المرصودين فعلياً
        expect(swotRestaurant.threats[0]).not.toBe(swotConsulting.threats[0]);
        expect(swotConsulting.threats[0]).toMatch(/4 منافسين مرصودين/);
        expect(swotRestaurant.threats[0]).not.toMatch(/\d+ منافسين مرصودين/);

        // 2) تهديد تقلب أسعار المدخلات: يختلف بحسب طبيعة النشاط (مطعم مقابل خدمي)
        expect(swotRestaurant.threats[1]).not.toBe(swotConsulting.threats[1]);
        expect(swotRestaurant.threats[1]).toMatch(/المواد الغذائية/);
        expect(swotConsulting.threats[1]).not.toMatch(/المواد الغذائية/);

        // 3) تهديد تغير الأذواق: يختلف بحسب تنوع مصادر الإيراد
        expect(swotRestaurant.threats[2]).not.toBe(swotConsulting.threats[2]);
        expect(swotRestaurant.threats[2]).toMatch(/مصدر إيراد واحد/);
        expect(swotConsulting.threats[2]).not.toMatch(/مصدر إيراد واحد/);

        // إثبات أن الأساس الثلاثي لم يعد ثابتاً حرفياً لكل المشاريع (جوهر العلة)
        expect(swotRestaurant.threats.slice(0, 3)).not.toEqual(swotConsulting.threats.slice(0, 3));
        expect(swotRestaurant.threats.slice(0, 3)).not.toEqual([
            'منافسة محلية ودولية',
            'تقلب أسعار المدخلات والمواد',
            'تغير أذواق واحتياجات العملاء'
        ]);
    });

    it('منطق إلحاق أهم مخاطر السجل (riskList) الإضافي ما زال يعمل فوق الأساس الديناميكي', () => {
        const state = {
            projectInfo: { sector: 'مطعم', concept: 'مطعم', city: 'الرياض' },
            marketing: { competitors: [] },
            revenue: { revenueStreams: ['بيع الوجبات'] },
            riskAnalysis: { risks: [{ name: 'مخاطرة تشغيلية محددة من سجل المخاطر' }, { name: 'مخاطرة تنظيمية محددة' }] }
        };
        const swot = generateSWOT(state);
        expect(swot.threats).toContain('مخاطرة تشغيلية محددة من سجل المخاطر');
        // النتيجة النهائية محدودة بأول 4 عناصر (3 أساسية + عنصر واحد من السجل)
        expect(swot.threats.length).toBe(4);
    });

    it('مشروع بلا سجل مخاطر مملوء (الحالة الشائعة مبكراً بالمعالج) لا يزال يحصل على 3 تهديدات أساسية متفرعة من الحالة لا نصوصاً فارغة', () => {
        const state = {
            projectInfo: { sector: 'صالون تجميل نسائي', concept: 'صالون تجميل', city: 'الدمام' },
            marketing: { competitors: [{ name: 'منافس' }, { name: 'منافس آخر' }] }, // منافسان فقط (أقل من 3)
            revenue: { revenueStreams: ['خدمات تجميل', 'منتجات عناية'] } // متنوع
        };
        const swot = generateSWOT(state);
        expect(swot.threats.length).toBe(3);
        expect(swot.threats[0]).toMatch(/احتمالية دخول منافسين/);
        expect(swot.threats[1]).toMatch(/تكاليف التشغيل الأساسية/);
        expect(swot.threats[2]).toMatch(/تغير تدريجي/);
    });
});
