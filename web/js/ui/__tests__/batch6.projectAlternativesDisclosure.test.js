/**
 * @vitest-environment jsdom
 *
 * دفعة 6 — ProjectAlternativesView.js: RISK_OPTIONS (معاملات 1.10/1.15/1.30) و
 * longPaybackThreshold() (عتبة استرداد طويل تتدرّج 5/7/9 سنوات حسب حجم التكلفة)
 * قيم داخلية تقريبية غير موثّقة المصدر (لا صيغة منشورة ولا انحراف معياري فعلي للطلب).
 * هذا الاختبار يتحقق من وجود إفصاح واضح (ASSUMPTION) في الواجهة المعروضة،
 * وأيضاً من وجود تعليقات توثيقية فوق الثابتين في الكود المصدر.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { ProjectAlternativesView } = await import('../ProjectAlternativesView.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.join(__dirname, '..', 'ProjectAlternativesView.js');

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => { }, notify: () => { } };
}

describe('ProjectAlternativesView — إفصاح ASSUMPTION عن معاملات المخاطرة وعتبة الاسترداد الطويل', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('يعرض إفصاحاً في الواجهة يوسم معاملات المخاطرة/عتبة الاسترداد كتقديرات استرشادية', () => {
        const state = {
            projectAlternatives: {
                ideas: [
                    { name: 'فكرة أ', estimatedCost: 250000, estimatedReturn: 90000, risk: 'medium', notes: '' }
                ],
                selectedIndex: 0
            }
        };
        const view = new ProjectAlternativesView('c', fakeStore(state), null);
        view.render();
        const html = document.getElementById('c').innerHTML;

        // الإفصاح صار موجزاً بطلب المالك (تدقيق 2026-07-11): تقديرات استرشادية
        // قابلة للتعديل بحكم المستخدم — التوثيق التقني الكامل بقي تعليقاً في المصدر.
        expect(html).toContain('تقديرات استرشادية');
        expect(html).toContain('عدّلها');
    });

    it('الكود المصدري يوثّق مصدر RISK_OPTIONS كتقدير داخلي غير مشتق من صيغة منشورة', () => {
        const src = fs.readFileSync(SOURCE_PATH, 'utf-8');
        const idx = src.indexOf('const RISK_OPTIONS');
        expect(idx).toBeGreaterThan(-1);
        const before = src.slice(Math.max(0, idx - 500), idx);

        expect(before).toContain('ASSUMPTION');
        expect(before).toMatch(/صيغة منشورة|انحراف معياري/);
    });

    it('الكود المصدري يوثّق أن عتبة longPaybackThreshold تتدرّج مع حجم الاستثمار (ASSUMPTION)', () => {
        const src = fs.readFileSync(SOURCE_PATH, 'utf-8');
        const idx = src.indexOf('function longPaybackThreshold');
        expect(idx).toBeGreaterThan(-1);
        const before = src.slice(Math.max(0, idx - 500), idx);

        expect(before).toContain('ASSUMPTION');
        expect(before).toMatch(/حجم الاستثمار|حجم المشروع/);
    });
});
