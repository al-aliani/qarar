/**
 * @vitest-environment jsdom
 *
 * تدقيق a11y 2026-08-25 — صفر `aria-live` على أي نتيجة حسابية.
 *
 * المستخدم يغيّر افتراضاً فتتغيّر كل الأرقام (NPV، القرار، المؤشرات) دون أن يُعلَن
 * شيء لقارئ الشاشة. الإصلاح على مسارين حسب طبيعة كل شاشة:
 *
 *   (أ) تحديث في المكان (منزلقات اختبار الضغط في لوحة القرار): الحاوية
 *       `.stress-test-results` موجودة في DOM قبل التحديث، فـaria-live عليها تعمل.
 *   (ب) إعادة رسم كاملة (`container.innerHTML = …` في لوحتَي القرار والمؤشرات):
 *       aria-live داخل الشجرة المُستبدلة لا تُجدي — منطقة حيّة تُحقَن مع محتواها
 *       دفعةً واحدة لا يُعلنها قارئ الشاشة. لذلك منطقتان ثابتتان في index.html
 *       تُكتبان عبر announce().
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { announce } from '../../utils/ui.js';

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
});

describe('المناطق الحيّة الثابتة في index.html', () => {
    const html = readFileSync(resolve(WEB_DIR, 'index.html'), 'utf-8');

    it('منطقة polite ثابتة موجودة في الصفحة نفسها — لا تُنشأ وقت الإعلان', () => {
        // جوهر الإصلاح: الحاوية موجودة قبل التحديث. لو أُنشئت مع نصّها لما أُعلن شيء.
        expect(html).toMatch(/id="a11yStatusRegion"[^>]*aria-live="polite"/);
        expect(html).toMatch(/id="a11yStatusRegion"[^>]*aria-atomic="true"/);
        expect(html).toMatch(/id="a11yStatusRegion"[^>]*class="sr-only"/);
    });

    it('منطقة assertive منفصلة للأخطاء التي تمنع الحساب', () => {
        expect(html).toMatch(/id="a11yAlertRegion"[^>]*role="alert"/);
        expect(html).toMatch(/id="a11yAlertRegion"[^>]*aria-live="assertive"/);
    });
});

describe('announce() — كتابة النتيجة في المنطقة الحيّة', () => {
    it('يكتب في المنطقة القائمة ولا يُنشئ نسخة ثانية', () => {
        document.body.innerHTML = `
            <div id="a11yStatusRegion" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>`;
        announce('التوصية: المشروع مجدٍ.');
        vi.runAllTimers();

        const regions = document.querySelectorAll('#a11yStatusRegion');
        expect(regions).toHaveLength(1);
        expect(regions[0].textContent).toBe('التوصية: المشروع مجدٍ.');
    });

    it('يُفرّغ المنطقة قبل الكتابة — إعادة نفس النص يجب أن تُعلَن مجدداً', () => {
        document.body.innerHTML = `<div id="a11yStatusRegion" aria-live="polite"></div>`;
        const region = document.getElementById('a11yStatusRegion');

        announce('النتيجة نفسها');
        vi.runAllTimers();
        expect(region.textContent).toBe('النتيجة نفسها');

        // افتراضان مختلفان قد يعطيان نفس القرار حرفياً؛ بلا تفريغ لا يتغيّر DOM فلا يُعلن.
        announce('النتيجة نفسها');
        expect(region.textContent).toBe('');
        vi.runAllTimers();
        expect(region.textContent).toBe('النتيجة نفسها');
    });

    it('assertive يكتب في منطقة التنبيه لا منطقة الحالة', () => {
        document.body.innerHTML = `
            <div id="a11yStatusRegion" aria-live="polite"></div>
            <div id="a11yAlertRegion" role="alert" aria-live="assertive"></div>`;
        announce('تعذّر إصدار توصية.', { assertive: true });
        vi.runAllTimers();

        expect(document.getElementById('a11yAlertRegion').textContent).toBe('تعذّر إصدار توصية.');
        expect(document.getElementById('a11yStatusRegion').textContent).toBe('');
    });
});

describe('حاويات النتائج المُحدَّثة في المكان', () => {
    const src = readFileSync(resolve(WEB_DIR, 'js/ui/DecisionDashboard.js'), 'utf-8');

    it('لوحة اختبار الضغط: .stress-test-results حاوية حيّة (تُحدَّث في مكانها بالمنزلقات)', () => {
        // bindStressTestSliders يكتب textContent على #stressNPV/#stressMargin داخلها
        // دون إعادة رسم — فالحاوية قائمة قبل التحديث وهذا شرط عمل aria-live.
        expect(src).toMatch(/class="stress-test-results"\s+aria-live="polite"\s+aria-atomic="true"/);
        expect(src).toMatch(/stressNPVEl\.textContent\s*=/);
        expect(src).toMatch(/stressMarginEl\.textContent\s*=/);
    });

    it('لوحتا القرار والمؤشرات تُعلنان ملخّص النتيجة بعد كل إعادة رسم', () => {
        const fin = readFileSync(resolve(WEB_DIR, 'js/ui/FinancialDashboard.js'), 'utf-8');
        for (const [name, code] of [['DecisionDashboard', src], ['FinancialDashboard', fin]]) {
            expect(code, `${name}: لا يستورد announce`).toMatch(/import \{[^}]*announce[^}]*\} from '\.\.\/utils\/ui\.js'/);
            // إعلان مهذّب للنتيجة، وassertive للحالة التي تمنع الحساب أصلاً.
            expect(code, `${name}: لا إعلان نتيجة`).toMatch(/announce\(`/);
            expect(code, `${name}: لا إعلان حازم للخطأ المانع`).toMatch(/assertive:\s*true/);
        }
    });

    it('بطاقة «لا توجد بيانات» المانعة للحساب تحمل role="alert" في اللوحتين', () => {
        const fin = readFileSync(resolve(WEB_DIR, 'js/ui/FinancialDashboard.js'), 'utf-8');
        expect(src).toMatch(/class="alert alert--warning" role="alert"/);
        expect(fin).toMatch(/class="alert alert--warning" role="alert"/);
    });
});
