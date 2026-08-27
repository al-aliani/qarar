/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-08-24: baseNPV في SensitivityAnalysis.js كان يُحوَّل عبر `|| 0` —
 * فحين ينجح الحساب الأساسي (calculateStudy بلا معاملات لا يرمي استثناءً) لكن
 * indicators.npv يعود undefined (لم يُحسَب فعلياً)، كانت القيمة تصبح صفراً حقيقياً
 * فتُعرض "ر.س. 0" بلون أخضر "نجاح" في بطاقة الحساسية وعمود "الأساسي" بمصفوفة
 * التأثير وصف "100% (أساسي)" بجدول مستويات التشغيل. نفس فئة خلل "الصفر الملفَّق"
 * التي أُصلحت سابقاً لـrunScenario (هذا الملف) وgetResults (ScenarioAnalysis.js) —
 * لكن باعNPV تحديداً كان لا يزال يفلت منها. أُصلح ليكون null عند عدم تعريف
 * المؤشر فعلياً (يُميَّز عن صفر حقيقي فعلي عبر == null بلا تحويل). يُحاكى فشل
 * الحساب عبر vi.mock — نفس نمط sensitivityAnalysis.nullHandling.test.js.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const calculateStudyMock = vi.fn();
vi.mock('../../core/engine.js', () => ({
    calculateStudy: (...args) => calculateStudyMock(...args)
}));

const { SensitivityAnalysis } = await import('../SensitivityAnalysis.js');

function fakeStore(state) {
    return { getState: () => state };
}

// أقلّ حالة تجتاز بوابة كفاية البيانات في SensitivityAnalysis (مصدر إيراد + أصل
// رأسمالي، أُضيفت 2026-08-26). المحرك مُقلَّد هنا، فمحتوى الحالة لا يؤثر في أي رقم
// معروض — دورها الوحيد فتح البوابة كي يبقى هذا الملف يختبر ما بُني له فعلاً.
function sufficientState() {
    return {
        revenue: { streams: [{ type: 'operating', customersPerMonth: 100, avgPrice: 50 }] },
        technical: { equipment: [{ price: 100000, quantity: 1 }] }
    };
}

function operatingLevelTable() {
    const title = [...document.querySelectorAll('.card-title')].find(h => h.textContent.includes('مستويات التشغيل'));
    return title.closest('.card');
}

describe('SensitivityAnalysis — baseNPV غير معرَّف: لا يُحوَّل إلى صفر ملفَّق (خلل مُصلَح)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        calculateStudyMock.mockReset();
        // الحساب الأساسي "ينجح" (لا استثناء) لكن npv غير محسوب فعلياً — بينما كل
        // سيناريوهات ±النسب تعيد أرقاماً حقيقية طبيعية كي نعزل خلل baseNPV تحديداً.
        calculateStudyMock.mockImplementation((state, params) => {
            if (!params) return { indicators: {} }; // NPV غير معرَّف، ليس صفراً
            return { indicators: { npv: 400000 } };
        });
    });

    it('بطاقة الحساسية: نقطة "الأساسي" تعرض "--" محايدة (text-muted) لا "ر.س. 0" أخضر', () => {
        const view = new SensitivityAnalysis('c', fakeStore(sufficientState()));
        view.render();

        const basePoint = document.querySelector('.sensitivity-item-card .range-point.base');
        const valueSpan = basePoint.querySelectorAll('span')[1];

        expect(valueSpan.textContent).toBe('--');
        expect(valueSpan.className).toBe('text-muted');
        expect(valueSpan.className).not.toBe('text-success');
    });

    it('مصفوفة التأثير: عمود "الأساسي" لصف الإيرادات يعرض "--" محايدة لا صفراً أخضر', () => {
        const view = new SensitivityAnalysis('c', fakeStore(sufficientState()));
        view.render();

        const row = [...document.querySelectorAll('.data-table tbody tr')].find(r => r.querySelector('td').textContent === 'الإيرادات');
        const baseCell = row.querySelectorAll('td')[3]; // المتغير,-20%,-10%,الأساسي,+10%,+20%

        expect(baseCell.textContent).toBe('--');
        expect(baseCell.className).toBe('text-muted');
    });

    it('جدول مستويات التشغيل: صف "100% (أساسي)" يعرض "--" محايدة لا "ر.س. 0" أخضر', () => {
        const view = new SensitivityAnalysis('c', fakeStore(sufficientState()));
        view.render();

        const table = operatingLevelTable();
        const row100 = [...table.querySelectorAll('tbody tr')].find(r => r.querySelector('td').textContent === '100% (أساسي)');
        const valueCell = row100.querySelectorAll('td')[1];

        expect(valueCell.textContent).toBe('--');
        expect(valueCell.className).toBe('text-muted');
        expect(valueCell.className).not.toBe('text-success');
    });
});
