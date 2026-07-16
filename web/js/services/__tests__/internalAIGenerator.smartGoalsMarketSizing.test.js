/**
 * generateSmartGoals كان يضع أرقام هدف مالي عامة ثابتة (50/80/100 ألف ريال) لكل مشروع
 * بصرف النظر عن مدينته أو قطاعه الفعليين — نفس الرقم لمطعم في جازان ومطعم في الرياض.
 * الإصلاح: عند توفر SOM حقيقي محسوب لهذه الدراسة تحديداً (عبر SaudiMarketEngine —
 * marketSizing المخزَّن له الأسبقية، وإلا اشتقاق حي من المدينة/القطاع)، يُستبدل الرقم
 * العام بثلث SOM (SOM موثَّق كحصة "3-5 سنوات أولى" — هدف بأفق سنة واحدة يأخذ الثلث).
 * بلا مدينة وبلا SOM مخزَّن، يبقى القالب العام تماماً كما كان (لا اختلاق رقم بلا مصدر).
 */
import { describe, it, expect } from 'vitest';
import { generateSmartGoals } from '../InternalAIGenerator.js';
import { analyzeSaudiMarket } from '../../core/SaudiMarketEngine.js';

describe('generateSmartGoals — هدف الإيراد المالي مشتق من SOM الحقيقي عند توفره (#smart-goals-market-sizing)', () => {
    it('مدينة حقيقية مُدخلة (بلا marketSizing مخزَّن، فرع default): الهدف المالي = ثلث SOM المشتق حياً، لا الرقم العام', () => {
        const state = { projectInfo: { concept: 'خدمات استشارية إدارية', sector: 'استشارات', city: 'جدة' } };
        const { som } = analyzeSaudiMarket(state, {});
        expect(som).toBeGreaterThan(0);

        const goals = generateSmartGoals(state);
        const financialGoal = goals.find(g => g.category === 'financial');
        const expectedTarget = Math.round(som / 3);

        expect(financialGoal.targetValue).toBe(expectedTarget);
        expect(financialGoal.targetValue).not.toBe(100000); // لم يعد الرقم العام الثابت
        // نص default الأصلي لا يحمل رقماً أصلاً ("تغطية التكاليف") — يبقى كما هو؛
        // targetValue وحده هو ما يتغيّر (نفس بنية القالب، مصدر الرقم فقط تغيّر).
        expect(financialGoal.measurable).toBe('تغطية التكاليف');

        // الأهداف غير المرتبطة بحجم السوق (سوقي/موارد بشرية) تبقى كما هي دون تغيير
        const marketGoal = goals.find(g => g.category === 'market');
        expect(marketGoal.specific).toBe('الحصول على 500 عميل جديد');
        expect(marketGoal.targetValue).toBe(500);
        const hrGoal = goals.find(g => g.category === 'hr');
        expect(hrGoal.targetValue).toBe(3);
    });

    it('مدينة حقيقية مُدخلة (فرع retail): النص أيضاً يعكس الرقم الحقيقي لا "100 ألف" الثابتة', () => {
        const state = { projectInfo: { concept: 'متجر إلكتروني للأزياء', sector: 'تجزئة', city: 'الرياض' } };
        const { som } = analyzeSaudiMarket(state, {});
        const expectedTarget = Math.round(som / 3);

        const goals = generateSmartGoals(state);
        const financialGoal = goals.find(g => g.category === 'financial');
        expect(financialGoal.targetValue).toBe(expectedTarget);
        expect(financialGoal.measurable).toBe(`${expectedTarget.toLocaleString('ar-SA')} ريال`);
        expect(financialGoal.measurable).not.toBe('100,000 ريال');
        expect(financialGoal.specific).toContain(expectedTarget.toLocaleString('ar-SA'));
    });

    it('marketSizing.som مخزَّن مسبقاً (من خطوة تحجيم السوق) له الأسبقية على أي اشتقاق حي', () => {
        const state = {
            projectInfo: { concept: 'متجر إلكتروني للأزياء', sector: 'تجزئة' },
            marketSizing: { som: { value: 900000 } }
        };
        const goals = generateSmartGoals(state);
        const financialGoal = goals.find(g => g.category === 'financial');
        expect(financialGoal.targetValue).toBe(300000); // 900,000 / 3

        const operationalGoal = goals.find(g => g.category === 'operational');
        expect(operationalGoal.specific).toBe('رفع معدل تحويل الزوار إلى مشترين إلى 20%');
        expect(operationalGoal.targetValue).toBe(20);
    });

    it('قطاع المطاعم: الهدف الشهري = (ثلث SOM) ÷ 12 — تحويل وحدة صحيح لا خطأ ×12', () => {
        const state = { projectInfo: { concept: 'مطعم شرقي', sector: 'مطاعم', city: 'الدمام' } };
        const { som } = analyzeSaudiMarket(state, {});
        const expectedYear1 = Math.round(som / 3);
        const expectedMonthly = Math.round(expectedYear1 / 12);

        const goals = generateSmartGoals(state);
        const financialGoal = goals.find(g => g.category === 'financial');
        expect(financialGoal.targetValue).toBe(expectedMonthly);
        expect(financialGoal.targetValue).not.toBe(80000);

        // هدف الطلبات اليومية (سوقي) وهدف الهدر (تشغيلي) غير مرتبطين بحجم السوق — بلا تغيير
        const marketGoal = goals.find(g => g.category === 'market');
        expect(marketGoal.targetValue).toBe(100);
        const wasteGoal = goals.find(g => g.specific.includes('الهدر'));
        expect(wasteGoal.targetValue).toBe(5);
    });

    it('بلا مدينة وبلا marketSizing مخزَّن: يبقى القالب العام تماماً كما كان لكل الفروع', () => {
        const techState = { projectInfo: { concept: 'تطبيق توصيل', sector: 'تقنية' } };
        const techGoals = generateSmartGoals(techState);
        expect(techGoals.find(g => g.category === 'financial').targetValue).toBe(50000);
        expect(techGoals.find(g => g.category === 'market').targetValue).toBe(1000);

        const foodState = { projectInfo: { concept: 'مطعم شرقي', sector: 'مطاعم' } };
        const foodGoals = generateSmartGoals(foodState);
        expect(foodGoals.find(g => g.category === 'financial').targetValue).toBe(80000);
        expect(foodGoals.find(g => g.category === 'financial').measurable).toBe('80,000 ريال');

        const retailState = { projectInfo: { concept: 'متجر إلكتروني للأزياء', sector: 'تجزئة' } };
        const retailGoals = generateSmartGoals(retailState);
        expect(retailGoals.find(g => g.category === 'financial').targetValue).toBe(100000);

        const defaultState = { projectInfo: { concept: 'خدمات استشارية إدارية', sector: 'استشارات' } };
        const defaultGoals = generateSmartGoals(defaultState);
        expect(defaultGoals.find(g => g.category === 'financial').targetValue).toBe(100000);
        expect(defaultGoals.find(g => g.category === 'market').targetValue).toBe(500);
    });
});
