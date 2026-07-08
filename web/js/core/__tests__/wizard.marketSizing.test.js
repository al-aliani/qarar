import { describe, it, expect } from 'vitest';
import { STEPS, SIDEBAR_SECTIONS, STEP_HELP, PHASE_LABELS, stepIndexById } from '../wizardSteps.js';

/**
 * حارس ضد عودة عطب «تحجيم السوق غير قابل للوصول»:
 * app.js يعرض مكوّن MarketAnalysis (الذي يحرّر marketSizing.tam/sam/som)
 * فقط عند step.isMarketAnalysis. لوحة القرار (DecisionDashboard.js:739)
 * تقيس جاهزية السوق بـ marketSizing.som.value > 0. إن لم توجد خطوة تحمل
 * العلم، يستحيل على المستخدم إدخال SOM وتبقى جاهزية السوق «تحتاج عمل» أبداً.
 */
describe('وصول خطوة تحجيم السوق (TAM/SAM/SOM)', () => {
  it('توجد خطوة واحدة بالضبط تحمل isMarketAnalysis تصل إلى مكوّن MarketAnalysis', () => {
    const flagged = STEPS.filter(s => s.isMarketAnalysis === true);
    expect(flagged.length).toBe(1);
  });

  it('خطوة تحجيم السوق قابلة للتحديد عبر معرّفها في مسار المعالج', () => {
    const marketStep = STEPS.find(s => s.isMarketAnalysis === true);
    expect(marketStep).toBeTruthy();
    expect(stepIndexById(marketStep.id)).toBeGreaterThanOrEqual(0);
  });
});

describe('سلامة نطاقات الشريط الجانبي بعد إضافة الخطوة', () => {
  it('الشروحات والمراحل تطابق عدد الخطوات واحداً بواحد', () => {
    expect(STEP_HELP.length).toBe(STEPS.length);
    expect(PHASE_LABELS.length).toBe(STEPS.length);
  });

  it('النطاقات متجاورة بلا فجوات ولا تداخل وتغطّي كل الخطوات', () => {
    const sorted = [...SIDEBAR_SECTIONS].sort((a, b) => a.range[0] - b.range[0]);
    expect(sorted[0].range[0]).toBe(0);
    expect(sorted[sorted.length - 1].range[1]).toBe(STEPS.length - 1);
    for (let i = 1; i < sorted.length; i++) {
      // بداية كل قسم = نهاية سابقه + 1 (تجاور تام)
      expect(sorted[i].range[0]).toBe(sorted[i - 1].range[1] + 1);
    }
  });

  it('كل نطاق ضمن حدود مصفوفة الخطوات', () => {
    for (const s of SIDEBAR_SECTIONS) {
      expect(s.range[0]).toBeGreaterThanOrEqual(0);
      expect(s.range[1]).toBeLessThan(STEPS.length);
      expect(s.range[0]).toBeLessThanOrEqual(s.range[1]);
    }
  });
});
