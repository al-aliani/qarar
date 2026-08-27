/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (مهندس الجودة، تحقّق عدائي): وُجد خلل حقيقي في جدول "مستويات
 * التشغيل" — عند فشل حساب سيناريو (calculateStudy يرمي خطأً أو يُعيد npv=NaN)،
 * كان الكود يستدعي runScenario() مرتين لكل صف (مرة للون عبر مقارنة `< 0` خاماً لا
 * تعامل null بشكل صحيح، ومرة أخرى للقيمة عبر formatCurrency) — ما يُنتج تناقضاً
 * بصرياً مضلِّلاً: قيمة "--" (فشل) بلون أخضر "نجاح" (لأن null < 0 يُقيَّم false في
 * JS). أُصلح ليحسب مرة واحدة ويُمرَّر عبر _npvClass الموحَّدة. هذا الملف يُحاكي
 * محرك calculateStudy عبر vi.mock ليثبت الإصلاح بدقة تامة لا تتحقق طبيعياً بسهولة
 * (يصعب إجبار المحرك الحقيقي على الفشل بمعاملات واقعية).
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

describe('SensitivityAnalysis — جدول مستويات التشغيل: تناسق اللون مع فشل الحساب (خلل مُصلَح)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        calculateStudyMock.mockReset();
    });

    it('سيناريو يرمي استثناءً (-20%): يُعرض "--" محايداً (text-muted) لا أخضر "نجاح" مضلِّلاً', () => {
        calculateStudyMock.mockImplementation((state, params) => {
            if (!params) return { indicators: { npv: 500000 } }; // الأساس
            if (params.revenueChange === -0.20) throw new Error('فشل محاكاة');
            return { indicators: { npv: 400000 } };
        });

        const view = new SensitivityAnalysis('c', fakeStore(sufficientState()));
        view.render();

        const table = operatingLevelTable();
        const row80 = [...table.querySelectorAll('tbody tr')].find(r => r.querySelector('td').textContent === '80%');
        const valueCell = row80.querySelectorAll('td')[1];

        expect(valueCell.textContent).toBe('--');
        // هذا هو الإصلاح: قبل الإصلاح كانت الفئة 'text-success' (لأن null < 0 === false)
        expect(valueCell.className).toBe('text-muted');
        expect(valueCell.className).not.toBe('text-success');
    });

    it('سيناريو يُعيد npv=NaN (-30%): نفس المعاملة المحايدة (text-muted + "--")', () => {
        calculateStudyMock.mockImplementation((state, params) => {
            if (!params) return { indicators: { npv: 500000 } };
            if (params.revenueChange === -0.30) return { indicators: { npv: NaN } };
            return { indicators: { npv: 400000 } };
        });

        const view = new SensitivityAnalysis('c', fakeStore(sufficientState()));
        view.render();

        const table = operatingLevelTable();
        const row70 = [...table.querySelectorAll('tbody tr')].find(r => r.querySelector('td').textContent === '70%');
        const valueCell = row70.querySelectorAll('td')[1];

        expect(valueCell.textContent).toBe('--');
        expect(valueCell.className).toBe('text-muted');
    });

    it('سيناريو يُعيد npv=null صراحة (-10%): نفس المعاملة، ولا يُخلط مع صفر حقيقي', () => {
        calculateStudyMock.mockImplementation((state, params) => {
            if (!params) return { indicators: { npv: 500000 } };
            if (params.revenueChange === -0.10) return { indicators: { npv: null } };
            return { indicators: { npv: 400000 } };
        });

        const view = new SensitivityAnalysis('c', fakeStore(sufficientState()));
        view.render();

        const table = operatingLevelTable();
        const row90 = [...table.querySelectorAll('tbody tr')].find(r => r.querySelector('td').textContent === '90%');
        const valueCell = row90.querySelectorAll('td')[1];

        expect(valueCell.textContent).toBe('--');
        expect(valueCell.className).toBe('text-muted');
    });

    it('حارس انحدار: كل سيناريو (-10%/-20%/-30%) يُستدعى مرة واحدة فقط لكل render (لا نداء مضاعف كما كان)', () => {
        calculateStudyMock.mockImplementation((state, params) => {
            if (!params) return { indicators: { npv: 500000 } };
            return { indicators: { npv: 400000 } };
        });

        const view = new SensitivityAnalysis('c', fakeStore(sufficientState()));
        view.render();

        const scenarioCalls = calculateStudyMock.mock.calls.filter(([, params]) => params && 'revenueChange' in params && [-0.10, -0.20, -0.30].includes(params.revenueChange));
        const countFor = (rc) => scenarioCalls.filter(([, p]) => p.revenueChange === rc).length;

        // دفعة 6 (مذكرة تخزين مؤقت لكل render): -30% تظهر فقط في جدول مستويات
        // التشغيل (نداء واحد كما كان). -20% تظهر في المصفوفة + جدول المستويات، و-10%
        // تظهر في بطاقة الحساسية + المصفوفة + جدول المستويات — لكن بعد إضافة ذاكرة
        // تخزين مؤقت (Map) لكل دورة render() الآن يُعاد استخدام نفس النتيجة بدل
        // إعادة حساب النموذج الكامل، فكل تركيبة معاملات مميّزة تُستدعى مرة واحدة
        // فقط عبر كامل العرض (لا لكل قسم على حدة). المهم يبقى نفسه: لا تضاعف داخل
        // *نفس* الخلية (لا نداءان لكل خلية كما كان قبل إصلاح دفعة سابقة).
        expect(countFor(-0.30)).toBe(1);
        expect(countFor(-0.20)).toBe(1);
        expect(countFor(-0.10)).toBe(1);
    });

    it('فشل الحساب الأساسي (calculateStudy بلا معاملات يرمي خطأً): يُعرض تنبيه خطأ ولا يُكمل الرسم', () => {
        calculateStudyMock.mockImplementation((state, params) => {
            if (!params) throw new Error('فشل النموذج الأساسي');
            return { indicators: { npv: 100000 } };
        });

        const view = new SensitivityAnalysis('c', fakeStore(sufficientState()));
        view.render();

        expect(document.getElementById('c').innerHTML).toContain('حدث خطأ في حساب النموذج المالي');
        expect(document.querySelector('.sensitivity-item-card')).toBeNull();
    });
});
