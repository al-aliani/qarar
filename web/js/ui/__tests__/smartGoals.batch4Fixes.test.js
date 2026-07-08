/**
 * @vitest-environment jsdom
 *
 * دفعة 4 — إصلاح: SmartGoals.js لم يكن يهرّب حقول الهدف النصية الحرة (specific/measurable/timeBound)
 * قبل حقنها في innerHTML عند رسم بطاقة الهدف. حقل "الهدف (Specific)" حر تماماً؛ نص خبيث مثل
 * `<img src=x onerror=alert(1)>` كان يُخزَّن كما هو ثم يُعاد رسمه كوسم HTML حي (Stored XSS).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SmartGoals } from '../SmartGoals.js';

function fakeStore(initialState) {
    let state = initialState;
    return {
        getState: () => state,
        update: (section, value) => { state = { ...state, [section]: value }; }
    };
}

const PAYLOAD = '<img src=x onerror=alert(1)>';

describe('SmartGoals — تهريب حقول الهدف الحرة عند إعادة الرسم (منع Stored XSS)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
    });

    it('goal.specific الخبيث لا يظهر كوسم HTML خام في بطاقة الهدف؛ يظهر مُهرَّباً كنص', () => {
        const store = fakeStore({ smartGoals: { goals: [] } });
        const view = new SmartGoals('c', store, () => {});
        view.render(0);

        // تعبئة نموذج إضافة الهدف عبر الحقول الفعلية ثم استدعاء addGoal() العامة
        document.getElementById('goalSpecific').value = PAYLOAD;
        document.getElementById('goalMeasurable').value = PAYLOAD;
        document.getElementById('goalTimeBound').value = '2027-01-01';
        document.getElementById('goalCategory').value = 'financial';

        view.addGoal(); // يخزّن الهدف في المتجر ثم يعيد الرسم بالكامل

        const html = document.getElementById('c').innerHTML;

        // الحمولة الخام (وسم <img فعلي مع onerror حي) يجب ألا تظهر إطلاقاً
        expect(html).not.toContain(PAYLOAD);
        expect(html).not.toContain('<img src=x onerror=alert(1)>');

        // الشكل المُهرَّب يجب أن يظهر بدلاً منه
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');

        // لا يوجد عنصر <img> فعلي مُنفَّذ داخل الحاوية (لم يتحول إلى DOM حي وينفّذ onerror)
        expect(document.getElementById('c').querySelector('img')).toBeNull();

        // التأكد من أن الهدف فعلاً وصل للمتجر (لا اختبار زائف يمر لأن addGoal فشل بصمت)
        expect(store.getState().smartGoals.goals).toHaveLength(1);
        expect(store.getState().smartGoals.goals[0].specific).toBe(PAYLOAD);
    });

    it('goal.timeBound الخبيث أيضاً يُهرَّب عند العرض (لا يظهر خاماً في قسم "الموعد")', () => {
        // حقل goalTimeBound هو input[type=date] فعلياً — لا يقبل نصاً حراً عبر النموذج/جسدوم،
        // تماماً كما لن يقبله متصفح حقيقي. القيمة الخبيثة قد تصل عبر مسارات أخرى مع ذلك
        // (استيراد قالب خبير، بيانات قديمة مهاجَرة، تلاعب مباشر بالمتجر)، لذا نتحقق من مسار
        // العرض مباشرة عبر حقن الحالة في المتجر ثم إعادة الرسم — لا عبر تعبئة نموذج الإدخال.
        const store = fakeStore({
            smartGoals: {
                goals: [{
                    id: 'g1', specific: 'هدف عادي', measurable: '-', timeBound: PAYLOAD,
                    category: 'financial', status: 'pending', targetValue: 0, currentValue: 0
                }]
            }
        });
        const view = new SmartGoals('c', store, () => {});
        view.render(0);

        const html = document.getElementById('c').innerHTML;
        expect(html).not.toContain(PAYLOAD);
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(document.getElementById('c').querySelector('img')).toBeNull();
    });

    it('هدف بلا نصوص خبيثة يستمر بالعرض الطبيعي (لا كسر وظيفي بسبب التهريب)', () => {
        const store = fakeStore({
            smartGoals: {
                goals: [{
                    id: 'g1', specific: 'زيادة المبيعات', measurable: '20%', timeBound: '2027-06-30',
                    category: 'financial', status: 'pending', targetValue: 100, currentValue: 10
                }]
            }
        });
        const view = new SmartGoals('c', store, () => {});
        view.render(0);

        const html = document.getElementById('c').innerHTML;
        expect(html).toContain('زيادة المبيعات');
        expect(html).toContain('20%');
        expect(html).toContain('2027-06-30');
    });
});
