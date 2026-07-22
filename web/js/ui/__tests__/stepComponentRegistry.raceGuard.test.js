/**
 * @vitest-environment jsdom
 *
 * تدقيق حيّ 2026-07-22 (Workflow 11-وكيل على sahib.sa): التنقل المباشر لمعظم خطوات
 * المعالج (#/step/N) كان يفشل بخطأ "Cannot set properties of null (setting
 * 'innerHTML')" — بلا أي رسالة للمستخدم، يبقى عالقاً على محتوى خطوة سابقة خاطئ.
 * السبب: renderStepComponent يستورد المكوّن ديناميكياً (await import) ثم يبنيه
 * ويرسمه بلا إعادة التحقق أن هذا التنقل لا يزال "الحالي" — لو دمّر تنقّل أحدث حاوية
 * DOM هذه الخطوة أثناء انتظار الاستيراد، يسقط الرسم على حاوية null. الإصلاح: تحقّق
 * isCurrent() فوراً بعد كل استيراد، قبل البناء/الرسم.
 */
import { describe, it, expect, vi } from 'vitest';

const MockMarketAnalysis = vi.fn(function (containerId) {
    this.container = document.getElementById(containerId);
});
MockMarketAnalysis.prototype.render = vi.fn();

vi.mock('../MarketAnalysis.js', () => ({ MarketAnalysis: MockMarketAnalysis }));

import { renderStepComponent } from '../stepComponentRegistry.js';

describe('renderStepComponent — حارس سباق التنقّل بعد الاستيراد الديناميكي', () => {
    it('تنقّل أصبح قديماً (isCurrent=false) أثناء انتظار الاستيراد: لا يُبنى المكوّن ولا يُرسَم، ويُعاد rendered:false', async () => {
        MockMarketAnalysis.mockClear();
        MockMarketAnalysis.prototype.render.mockClear();
        document.body.innerHTML = '<div id="category-step-content-8"></div>';

        const step = { isMarketAnalysis: true };
        // يحاكي: هذا التنقّل كان حالياً لحظة الطلب، لكن أصبح قديماً بحلول لحظة اكتمال
        // الاستيراد (تنقّل أحدث بدأ في الأثناء) — بالضبط سيناريو السباق الحقيقي المُكتشَف حياً.
        const isCurrent = vi.fn(() => false);

        const result = await renderStepComponent(step, 'category-step-content-8', 8, {
            store: {}, onNavigate: vi.fn(), isCurrent, cache: null, wizardFactory: vi.fn(),
        });

        expect(result).toEqual({ instance: null, rendered: false });
        expect(MockMarketAnalysis).not.toHaveBeenCalled();
        expect(MockMarketAnalysis.prototype.render).not.toHaveBeenCalled();
    });

    it('تنقّل لا يزال حالياً (isCurrent=true): يُبنى المكوّن ويُرسَم طبيعياً', async () => {
        MockMarketAnalysis.mockClear();
        MockMarketAnalysis.prototype.render.mockClear();
        document.body.innerHTML = '<div id="category-step-content-8"></div>';

        const step = { isMarketAnalysis: true };
        const result = await renderStepComponent(step, 'category-step-content-8', 8, {
            store: {}, onNavigate: vi.fn(), isCurrent: () => true, cache: null, wizardFactory: vi.fn(),
        });

        expect(result.instance).toBeInstanceOf(MockMarketAnalysis);
        expect(MockMarketAnalysis.prototype.render).toHaveBeenCalledWith(8);
    });

    it('بلا isCurrent إطلاقاً (استدعاء المسار القديم غير المصنَّف): يُرسَم طبيعياً كالسابق دون تغيير سلوك', async () => {
        MockMarketAnalysis.mockClear();
        MockMarketAnalysis.prototype.render.mockClear();
        document.body.innerHTML = '<div id="category-step-content-8"></div>';

        const step = { isMarketAnalysis: true };
        const result = await renderStepComponent(step, 'category-step-content-8', 8, {
            store: {}, onNavigate: vi.fn(), cache: null, wizardFactory: vi.fn(),
        });

        expect(result.instance).toBeInstanceOf(MockMarketAnalysis);
    });
});
