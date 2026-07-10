/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة حرجة، مهندس الجودة): RiskMatrix.js كان بتغطية 0% تامة.
 * هذا يغطي المنطق المالي الفعلي: تصنيف درجة الخطر (احتمالية×أثر) بكل التركيبات
 * التسع، ترتيب سجل المخاطر بالأثر المالي مع الحفاظ على مؤشر المصفوفة الأصلي
 * (حرج لصحة التحديث/الحذف)، إجمالي الأثر المالي، وحارس حقن حزمة القطاع.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RiskMatrix } from '../RiskMatrix.js';

function fakeStore(initialState) {
    let state = initialState;
    return {
        getState: () => state,
        update: (section, value) => { state = { ...state, [section]: value }; }
    };
}

function risk(overrides = {}) {
    return {
        name: 'خطر', type: 'operational', probability: 'medium', impact: 'medium',
        estimatedFinancialImpact: 0, timeHorizon: 'short', mitigation: '', residualRisk: 'medium',
        earlyWarning: '', owner: '', ...overrides
    };
}

describe('RiskMatrix — تصنيف الدرجة (احتمالية × أثر): كل التركيبات التسع', () => {
    // الصيغة الفعلية في الكود: probScore{low:1,medium:2,high:3} × impactScore{low:1,medium:3,high:5}
    // الأثر مرجَّح أكثر من الاحتمالية (5 مقابل 3) — عدم تناظر متعمّد يستحق حارساً صريحاً.
    const cases = [
        ['low', 'low', 1, 'risk-low'],
        ['low', 'medium', 3, 'risk-medium'],
        ['low', 'high', 5, 'risk-medium'],
        ['medium', 'low', 2, 'risk-low'],
        ['medium', 'medium', 6, 'risk-high'],
        ['medium', 'high', 10, 'risk-critical'],
        ['high', 'low', 3, 'risk-medium'],
        ['high', 'medium', 9, 'risk-critical'],
        ['high', 'high', 15, 'risk-critical'],
    ];

    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    cases.forEach(([probability, impact, score, expectedClass]) => {
        it(`احتمالية=${probability} × أثر=${impact} ⇒ الدرجة=${score} ⇒ ${expectedClass}`, () => {
            const store = fakeStore({ riskAnalysis: { risks: [risk({ probability, impact, name: 'اختبار' })] } });
            const view = new RiskMatrix('c', store, () => {});
            view.render(0);

            // بطاقة المصفوفة: الخلية التي تحوي نقطة الخطر يجب أن تحمل صنف الدرجة الصحيح
            const dot = [...document.querySelectorAll('.risk-dot')].find(el => el.title === 'اختبار');
            expect(dot).toBeTruthy();
            expect(dot.closest('.matrix-cell').className).toContain(expectedClass);

            // سجل المخاطر: نفس الدرجة الرقمية وصنف الشارة المطابق
            // تدقيق 2026-07-09 (حزمة 4، اتساق الأرقام): الشارة تُعرض الآن بأرقام هندية
            // عربية (toLocaleString('ar-SA')) اتساقاً مع بقية أرقام نفس الجدول (الإجمالي
            // المالي في تذييله)، بعد أن كانت الشارة وحدها تُظهر أرقاماً لاتينية خام.
            // تدقيق إتاحة (a11y): الشارة تحمل الآن تسمية نصية للخطورة (حرج/عالي/متوسط/
            // منخفض) إلى جانب الرقم — لا اعتماد على اللون وحده (انظر وصف الملف أدناه).
            const badge = document.querySelector('.risk-register .badge');
            const severityLabel = { critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض' }[expectedClass.replace('risk-', '')];
            expect(badge.textContent.trim()).toBe(`${severityLabel} (${score.toLocaleString('ar-SA')})`);
            const expectedBadgeClass = score >= 9 ? 'badge--danger' : score >= 6 ? 'badge--warning' : score >= 3 ? 'badge--info' : 'badge--success';
            expect(badge.className).toContain(expectedBadgeClass);
        });
    });

    it('خطر بلا احتمالية/أثر محدَّدين يسقط افتراضياً لـ"low" (لا يختفي من المصفوفة)', () => {
        const store = fakeStore({ riskAnalysis: { risks: [{ name: 'خطر غير مكتمل' }] } });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);
        const dot = [...document.querySelectorAll('.risk-dot')].find(el => el.title === 'خطر غير مكتمل');
        expect(dot).toBeTruthy();
        expect(dot.closest('.matrix-cell').className).toContain('risk-low');
    });
});

describe('RiskMatrix — إجمالي الأثر المالي المقدَّر', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('يجمع الأثر المالي عبر كل المخاطر ويعرضه في تذييل الجدول', () => {
        const store = fakeStore({
            riskAnalysis: {
                risks: [
                    risk({ name: 'أ', estimatedFinancialImpact: 120000 }),
                    risk({ name: 'ب', estimatedFinancialImpact: 80000 }),
                    risk({ name: 'ج', estimatedFinancialImpact: 50000 }),
                ]
            }
        });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);
        const footer = document.querySelector('tfoot');
        // ar-SA تُنسِّق الأرقام بأرقام هندية عربية (٢٥٠٬٠٠٠) — نطابق نفس دالة التنسيق الفعلية
        expect(footer.textContent).toContain((250000).toLocaleString('ar-SA'));
    });

    it('قيم غير رقمية/سالبة/مفقودة لا تُفشل الجمع — تُعامَل كصفر أو تُجمع حرفياً كسالبة', () => {
        const store = fakeStore({
            riskAnalysis: {
                risks: [
                    risk({ name: 'أ', estimatedFinancialImpact: 'غير رقم' }),
                    risk({ name: 'ب', estimatedFinancialImpact: null }),
                    risk({ name: 'ج' }), // undefined
                    risk({ name: 'د', estimatedFinancialImpact: 100000 }),
                ]
            }
        });
        const view = new RiskMatrix('c', store, () => {});
        expect(() => view.render(0)).not.toThrow();
        const footer = document.querySelector('tfoot');
        expect(footer.textContent).toContain((100000).toLocaleString('ar-SA'));
    });

    it('لا مخاطر إطلاقاً: لا تذييل جدول (لا صف إجمالي فارغ مضلِّل)', () => {
        const store = fakeStore({ riskAnalysis: { risks: [] } });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);
        expect(document.querySelector('tfoot')).toBeNull();
    });
});

describe('RiskMatrix — ترتيب السجل بالأثر المالي مع الحفاظ على مؤشر المصفوفة الأصلي', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('يُرتَّب العرض تنازلياً بالأثر المالي، لكن data-idx يبقى مؤشر التخزين الأصلي (لا موضع العرض)', () => {
        const store = fakeStore({
            riskAnalysis: {
                risks: [
                    risk({ name: 'الأول (أثر صغير)', estimatedFinancialImpact: 10000 }),   // idx 0
                    risk({ name: 'الثاني (أكبر أثر)', estimatedFinancialImpact: 500000 }), // idx 1
                    risk({ name: 'الثالث (أثر متوسط)', estimatedFinancialImpact: 100000 }),// idx 2
                ]
            }
        });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);

        const rows = [...document.querySelectorAll('#riskRegisterBody tr')];
        // العرض: الثاني أولاً (أكبر أثر)، ثم الثالث، ثم الأول
        expect(rows[0].querySelector('[data-field="name"]').value).toBe('الثاني (أكبر أثر)');
        expect(rows[0].dataset.idx).toBe('1'); // مؤشره الأصلي في المصفوفة هو 1
        expect(rows[1].querySelector('[data-field="name"]').value).toBe('الثالث (أثر متوسط)');
        expect(rows[1].dataset.idx).toBe('2');
        expect(rows[2].querySelector('[data-field="name"]').value).toBe('الأول (أثر صغير)');
        expect(rows[2].dataset.idx).toBe('0');
    });

    it('حذف صف مُعاد ترتيبه (data-idx≠موضع العرض) يحذف الخطر الصحيح من المخزن لا خطأً مجاوراً', () => {
        const store = fakeStore({
            riskAnalysis: {
                risks: [
                    risk({ name: 'A', estimatedFinancialImpact: 10000 }),
                    risk({ name: 'B', estimatedFinancialImpact: 500000 }),
                ]
            }
        });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);
        // الصف المعروض أولاً هو B (أثر أكبر) بـ data-idx=1؛ نحذفه عبر زر الحذف الحقيقي
        const removeBtn = document.querySelector('#riskRegisterBody tr:first-child .btn-remove-risk');
        expect(removeBtn.dataset.idx).toBe('1');
        removeBtn.click();

        const remaining = store.getState().riskAnalysis.risks;
        expect(remaining).toHaveLength(1);
        expect(remaining[0].name).toBe('A'); // بقي A، حُذف B تحديداً لا A
    });
});

describe('RiskMatrix — تحديث الحقول (updateRisk)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('تغيير احتمالية خطر يُحدَّث في المخزن ويُعاد رسم المصفوفة (يؤثر على التصنيف)', () => {
        const store = fakeStore({ riskAnalysis: { risks: [risk({ name: 'خطر', probability: 'low', impact: 'low' })] } });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);

        const probSelect = document.querySelector('[data-field="probability"]');
        probSelect.value = 'high';
        probSelect.dispatchEvent(new Event('change', { bubbles: true }));

        expect(store.getState().riskAnalysis.risks[0].probability).toBe('high');
        // بعد إعادة الرسم: الدرجة الجديدة (high×low=3) تظهر في الشارة (أرقام هندية عربية، حزمة 4)
        // + تسمية الخطورة النصية «متوسط» (تصنيف الدرجة 3 هو medium — انظر classifyRiskScore)
        expect(document.querySelector('.risk-register .badge').textContent.trim()).toBe(`متوسط (${(3).toLocaleString('ar-SA')})`);
    });

    it('تغيير الأثر المالي (حقل رقمي) يُخزَّن كرقم لا نص، وقيمة غير صالحة تُصبح صفراً', () => {
        const store = fakeStore({ riskAnalysis: { risks: [risk({ name: 'خطر' })] } });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);

        const impactInput = document.querySelector('[data-field="estimatedFinancialImpact"]');
        impactInput.value = 'ليس رقماً';
        impactInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(store.getState().riskAnalysis.risks[0].estimatedFinancialImpact).toBe(0);

        impactInput.value = '75000';
        impactInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(store.getState().riskAnalysis.risks[0].estimatedFinancialImpact).toBe(75000);
    });

    it('تغيير حقل نصي (مثل خطة المواجهة) لا يعيد رسم الجدول كاملاً (يحافظ على التركيز أثناء الكتابة)', () => {
        const store = fakeStore({ riskAnalysis: { risks: [risk({ name: 'خطر' })] } });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);
        const renderSpy = vi.spyOn(view, 'render');

        const mitigationInput = document.querySelector('[data-field="mitigation"]');
        mitigationInput.value = 'خطة جديدة';
        mitigationInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.getState().riskAnalysis.risks[0].mitigation).toBe('خطة جديدة');
        expect(renderSpy).not.toHaveBeenCalled();
    });
});

describe('RiskMatrix — إضافة/حقن حزمة المخاطر القطاعية', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('addRisk يضيف خطراً افتراضياً متوسط الاحتمالية والأثر (لا يظهر خطأً في المصفوفة)', () => {
        const store = fakeStore({ riskAnalysis: { risks: [] } });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);
        document.querySelector('.btn-add-risk').click();
        expect(store.getState().riskAnalysis.risks).toHaveLength(1);
        expect(store.getState().riskAnalysis.risks[0]).toMatchObject({ probability: 'medium', impact: 'medium' });
    });

    it('زر حقن حزمة القطاع يظهر فقط عند جدول فارغ، ويحقن 6 مخاطر واقعية فعلياً', () => {
        const store = fakeStore({ riskAnalysis: { risks: [] } });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);

        const injectBtn = document.querySelector('.btn-inject-sector-risks');
        expect(injectBtn).toBeTruthy();
        injectBtn.click();

        const risks = store.getState().riskAnalysis.risks;
        expect(risks).toHaveLength(6);
        expect(risks.every(r => r.name && r.mitigation && r.earlyWarning && r.owner)).toBe(true);
    });

    it('لا يحقن الحزمة (ولا يُظهر زرها) إن كان الجدول يحتوي مخاطر فعلياً — لا يطمس إدخال المستخدم', () => {
        const store = fakeStore({ riskAnalysis: { risks: [risk({ name: 'خطر المستخدم' })] } });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);

        expect(document.querySelector('.btn-inject-sector-risks')).toBeNull();

        // حتى لو استُدعيت الدالة مباشرة (دفاعاً في العمق) يجب ألا تغيّر شيئاً
        view.injectSectorPack();
        expect(store.getState().riskAnalysis.risks).toHaveLength(1);
        expect(store.getState().riskAnalysis.risks[0].name).toBe('خطر المستخدم');
    });
});

// ─────────────────────────────────────────────────────────────
// إتاحة (a11y): شارة درجة الخطر في سجل المخاطر أخطر عنصر لوني في التطبيق —
// معلومة "سلامة" (خطر حرج) لا يجوز أن تعتمد على اللون وحده. نتحقق أن كل شارة
// تحمل معاً: (1) صنف CSS اللوني الصحيح و(2) تسمية نصية ظاهرة للخطورة —
// نفس نمط التحقق في batch6.readinessDimensions.test.js.
// ─────────────────────────────────────────────────────────────
describe('RiskMatrix — شارة الدرجة لا تعتمد على اللون فقط (a11y)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    const severityCases = [
        { probability: 'low', impact: 'low', score: 1, cssClass: 'badge--success', label: 'منخفض' },
        { probability: 'low', impact: 'medium', score: 3, cssClass: 'badge--info', label: 'متوسط' },
        { probability: 'medium', impact: 'medium', score: 6, cssClass: 'badge--warning', label: 'عالي' },
        { probability: 'medium', impact: 'high', score: 10, cssClass: 'badge--danger', label: 'حرج' },
    ];

    severityCases.forEach(({ probability, impact, score, cssClass, label }) => {
        it(`درجة الخطر ${score} (${label}) ⇒ صنف "${cssClass}" + تسمية نصية "${label}" معاً`, () => {
            const store = fakeStore({ riskAnalysis: { risks: [risk({ probability, impact, name: 'خطر a11y' })] } });
            const view = new RiskMatrix('c', store, () => {});
            view.render(0);

            const badge = document.querySelector('.risk-register .badge');
            // (1) الصنف اللوني
            expect(badge.className).toContain(cssClass);
            // (2) التسمية النصية الظاهرة — لا يكفي اللون وحده لتمييز الخطورة
            expect(badge.textContent).toContain(label);
        });
    });

    it('تسمية الخطورة النصية في الشارة تطابق تسميات الأسطورة (Legend) أسفل مصفوفة المخاطر', () => {
        const store = fakeStore({ riskAnalysis: { risks: [risk({ probability: 'medium', impact: 'high', name: 'خطر حرج' })] } });
        const view = new RiskMatrix('c', store, () => {});
        view.render(0);

        const legendText = document.querySelector('.risk-legend').textContent;
        const badge = document.querySelector('.risk-register .badge');
        expect(badge.textContent).toContain('حرج');
        expect(legendText).toContain('حرج');
    });
});
