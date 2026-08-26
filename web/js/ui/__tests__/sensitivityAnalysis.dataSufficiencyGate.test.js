/**
 * @vitest-environment jsdom
 *
 * مسح ليلة 2026-08-26 — بلاغ مؤكَّد على SensitivityAnalysis.js:36: لا بوابة كفاية بيانات
 * إطلاقاً. render() كانت تبدأ بتشغيل النموذج مباشرةً، والحارس الوحيد (baseNPVRaw == null
 * || NaN) يعالج تعذّر الحساب لا الفراغ. المحرك يُعيد npv = 0 عدداً لدراسة فارغة، فيفلت
 * من الحارس: formatCurrency(0) تطبع «٠ ر.س.» و_npvClass(0) تُعيد text-success — فيرى
 * العميل ثلاث بطاقات + مصفوفة 3×5 + جدول مستويات تشغيل، 20+ خانة كلها صفر بالأخضر، تحت
 * لافتة «تحليل الحساسية إلزامي — أي دراسة بدونه تعتبر غير مكتملة». يقرأها كتحليل أُجري
 * ونتيجته «المشروع لا يتأثر بتقلّب الإيرادات ±20%».
 *
 * الحالة الأسوأ ليست الصفر: بدراسة فيها إيراد بلا أي تكلفة/أصل/تمويل تصبح كل الخانات
 * موجبة كبيرة وخضراء (193,441 أساسي، 154,753 عند -20% إيراد) — «تحليل حساسية» مطمئن
 * لدراسة لا وجود لتكاليفها.
 *
 * الاختبار القائم sensitivityAnalysis.baseNpvUndefined.test.js يغطي undefined فقط
 * ويصرّح في تعليقه بأنه «يُميَّز عن صفر حقيقي فعلي» — أي أن هذه الفجوة كانت مكشوفة نصاً.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SensitivityAnalysis } from '../SensitivityAnalysis.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state };
}

function revenueOnlyStudy() {
    const d = createEmptyStudy();
    d[SECTIONS.PROJECT_INFO] = { ...d[SECTIONS.PROJECT_INFO], name: 'مشروعي' };
    d[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 300, avgPrice: 20 }] };
    return d;
}

describe('SensitivityAnalysis — لا مصفوفة حساسية قبل توفّر الإيرادات والتكاليف', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('المحرك فعلاً يُعيد npv = 0 عدداً لدراسة فارغة (يفلت من حارس null/NaN)', () => {
        const npv = calculateStudy(createEmptyStudy()).indicators.npv;
        expect(npv).toBe(0);
        expect(npv).not.toBeNull();
        expect(Number.isNaN(npv)).toBe(false);
    });

    it('دراسة فارغة: لا بطاقات ولا مصفوفة ولا جدول مستويات تشغيل — ولا خانة خضراء واحدة', () => {
        new SensitivityAnalysis('c', fakeStore(createEmptyStudy())).render();
        const root = document.getElementById('c');

        expect(root.textContent).toContain('لا يمكن حساب الحساسية قبل إدخال الإيرادات والتكاليف');
        expect(root.querySelectorAll('.sensitivity-item-card').length).toBe(0);
        expect(root.querySelectorAll('.data-table').length).toBe(0);
        expect(root.querySelectorAll('.text-success').length).toBe(0);
    });

    it('إيراد بلا أي تكلفة/أصل/تمويل: لا تُعرض أرقام موجبة خضراء مطمئنة', () => {
        const study = revenueOnlyStudy();
        // تثبيت المدخل: بلا بوابة كانت المصفوفة تمتلئ بأرقام موجبة كبيرة
        expect(calculateStudy(study).indicators.npv).toBeGreaterThan(100000);

        new SensitivityAnalysis('c', fakeStore(study)).render();
        const root = document.getElementById('c');

        expect(root.textContent).toContain('لا توجد بيانات تكلفة');
        expect(root.querySelectorAll('.sensitivity-item-card').length).toBe(0);
        expect(root.querySelectorAll('.text-success').length).toBe(0);
    });

    it('دراسة مكتملة: المصفوفة والبطاقات تُرسم كما كانت (البوابة لا تحجب الصالح)', () => {
        const d = revenueOnlyStudy();
        d[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 2000, avgPrice: 100, variableCostRate: 0.30 }] };
        d[SECTIONS.TECHNICAL] = { ...d[SECTIONS.TECHNICAL], equipment: [{ price: 300000, quantity: 1 }] };
        d[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 12000 }] };

        new SensitivityAnalysis('c', fakeStore(d)).render();
        const root = document.getElementById('c');

        expect(root.querySelectorAll('.sensitivity-item-card').length).toBe(3);
        expect(root.querySelectorAll('.data-table').length).toBe(2);
    });
});
