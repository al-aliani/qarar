/**
 * @vitest-environment jsdom
 *
 * ProjectOverviewView (#/project/<id>) — أُضيفت 2026-07-17 بطلب المالك: النقر على
 * بطاقة مشروع كان يقذف المستخدم داخل الويزارد مباشرةً بلا أي عرض للخلاصة والقرار.
 *
 * أهم ما تحرسه هذه الاختبارات: **لا قرار على بيانات ناقصة.** دراسة بلا مدخلات مالية
 * تُنتج أصفاراً، وعرض «لا تمضِ» عليها تخويف كاذب لا نتيجة — وهو بالضبط صنف الخلل
 * الذي عالجه المشروع سابقاً في الوضع السريع (أرقام مختلقة بلا بوابة).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadProjectMock = vi.fn();
const calculateStudyMock = vi.fn();
const getActiveProjectsMock = vi.fn(async () => []);
const runQAChecksMock = vi.fn(async () => ({ hardErrors: [], softWarnings: [], validationErrors: [], validationWarnings: [] }));

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: {
        loadProject: (...a) => loadProjectMock(...a),
        getActiveProjects: (...a) => getActiveProjectsMock(...a)
    }
}));
vi.mock('../../core/engine.js', () => ({
    calculateStudy: (...a) => calculateStudyMock(...a)
}));
vi.mock('../../utils/qaChecks.js', () => ({
    runQAChecks: (...a) => runQAChecksMock(...a)
}));

const FULL_STUDY = { projectInfo: { name: 'مقهى الرياض', concept: 'مقهى مختص', city: 'الرياض' } };

async function renderWith({ data = FULL_STUDY, results = null, options = {} } = {}) {
    loadProjectMock.mockResolvedValue(data ? { data, source: 'local' } : null);
    if (results instanceof Error) calculateStudyMock.mockImplementation(() => { throw results; });
    else calculateStudyMock.mockReturnValue(results);

    const { ProjectOverviewView } = await import('../ProjectOverviewView.js');
    const store = { set: vi.fn(), getState: () => data };
    const view = new ProjectOverviewView('host', store, options);
    await view.render('p1');
    return { view, store, html: document.getElementById('host').innerHTML };
}

describe('ProjectOverviewView — بوابة «لا قرار على بيانات ناقصة»', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="host"></div>';
        vi.clearAllMocks();
    });

    it('لا يعرض قراراً إطلاقاً حين لا يُنتج المحرك decision (دراسة ناقصة)', async () => {
        const { html } = await renderWith({ results: { indicators: {} } });

        expect(html).toContain('لا يوجد قرار بعد');
        expect(html).toContain('بيانات غير كافية');
        // الفحص على أصناف البانر لا على نصّه: صياغة العنوان قد تتغيّر، أما is-go/is-nogo
        // فهي التي تحمل الدلالة اللونية فعلياً (components.css) — ووجود أيٍّ منها هنا
        // يعني أننا أظهرنا حكماً على دراسة بلا أرقام.
        expect(html).not.toContain('is-go');
        expect(html).not.toContain('is-nogo');
    });

    it('لا يعرض شبكة مؤشرات من أصفار — المؤشر بلا قيمة فعلية يُحذف', async () => {
        const { html } = await renderWith({
            results: { indicators: { npv: 0, irr: 0, paybackPeriod: 0, roi: 0 } }
        });
        // نفحص الشبكة نفسها لا عنوانها: نصّ الخلاصة التنفيذية المولَّد يحوي عبارة
        // «تم حساب المؤشرات المالية في نموذج التدفقات» فيتعارض مع فحص العنوان نصّاً.
        expect(html).not.toContain('po__kpis');
        expect(html).not.toContain('po__kpi-value');
    });

    it('لا يعرض «لا تمضِ» لدراسة فارغة رغم أن المحرك يُعيد NO-GO فعلاً', async () => {
        // هذه هي الحالة الحقيقية المقيسة حياً على دراسة مكتملة 9%: كل المؤشرات
        // أصفار/null فتفشل عتبات القرار الأربع ويُنتج المحرك NO-GO. النسخة الأولى من
        // هذه الشاشة عرضت «لا تمضِ» على مثل هذه الدراسة — تخويف كاذب لمستخدم لم يُدخل
        // أرقامه بعد. اختبار سابق مرّ لأن الموك أعاد {indicators:{}} بلا decision،
        // أي أن الموك كذب على الواقع.
        const { html } = await renderWith({
            results: {
                decision: 'NO-GO',
                decisionReasons: ['صافي القيمة الحالية يجب أن يكون > 0'],
                indicators: { npv: 0, npvWithTerminal: 0, irr: 0, mirr: 0, paybackPeriod: null, roi: 0, breakEvenPointValue: 0, profitMargin: 0 }
            }
        });
        expect(html).toContain('لا يوجد قرار بعد');
        expect(html).not.toContain('is-nogo');
        expect(html).not.toContain('لماذا هذا القرار');
        // تدقيق 2026-07-20: الخلاصة التنفيذية تقرأ results.decision الخام (='NO-GO')
        // فكانت تُسرّب «القرار يشير إلى عدم الجدوى» تحت شارة «لا يوجد قرار بعد» على نفس
        // الشاشة — تناقض. الملخّص الآن مُبوَّب بنفس شرط الشارة فيختفي كاملاً على الدراسة الصفرية.
        expect(html).not.toContain('عدم الجدوى');
        expect(html).not.toContain('الخلاصة التنفيذية');
    });

    it('يعرض القرار وأسبابه حين ينتجهما المحرك فعلاً', async () => {
        const { html } = await renderWith({
            results: {
                decision: 'NO-GO',
                decisionReasons: ['صافي القيمة الحالية يجب أن يكون > 0'],
                indicators: { npv: -50000 }
            }
        });
        expect(html).toContain('لا تمضِ');
        expect(html).toContain('is-nogo');
        expect(html).toContain('لماذا هذا القرار');
        expect(html).toContain('صافي القيمة الحالية يجب أن يكون &gt; 0');
    });

    it('يحجب القرار الحقيقي أيضاً عند وجود أخطاء جودة حرجة', async () => {
        runQAChecksMock.mockResolvedValueOnce({
            hardErrors: [{ message: 'الميزانية العمومية غير متوازنة', path: 'financials.balanceSheet' }],
            softWarnings: [], validationErrors: [], validationWarnings: []
        });
        const { html } = await renderWith({
            results: { decision: 'NO-GO', decisionReasons: ['صافي القيمة الحالية سالب'], indicators: { npv: -50000 } }
        });

        expect(html).toContain('القرار محجوب مؤقتاً');
        expect(html).toContain('الميزانية العمومية غير متوازنة');
        expect(html).not.toContain('لا تمضِ');
        expect(html).not.toContain('لماذا هذا القرار');
        expect(html).not.toContain('الخلاصة التنفيذية');
    });

    it('REVISE يستخدم صنف التحذير لا الرفض (دستور components.css:382)', async () => {
        const { html } = await renderWith({ results: { decision: 'REVISE', indicators: { npv: 1000 } } });
        expect(html).toContain('is-revise');
        expect(html).not.toContain('is-nogo');
    });
});

describe('ProjectOverviewView — عرض المؤشرات', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="host"></div>';
        vi.clearAllMocks();
    });

    it('يضرب الكسور العشرية في 100 — irr 0.127 تُعرض 12.7% لا 0.1%', async () => {
        // فخّ موثّق في هذا المشروع: المحرك يخزّن irr/roi/الهامش كسوراً، ونسيان
        // الضرب أنتج سابقاً «معدل عائد داخلي −0.1%» في ملخص يُقدَّم لممول.
        const { html } = await renderWith({
            results: { decision: 'GO', indicators: { irr: 0.127, roi: 0.35, profitMargin: 0.082 } }
        });
        expect(html).toContain('12.7%');
        expect(html).toContain('35.0%');
        expect(html).toContain('8.2%');
        expect(html).not.toContain('0.1%');
    });

    it('يميّز المؤشر السالب بصنف is-bad (لا باللون وحده — الحد الجانبي)', async () => {
        const { html } = await renderWith({ results: { decision: 'NO-GO', indicators: { npv: -50000 } } });
        expect(html).toContain('is-bad');
    });
});

describe('ProjectOverviewView — التحميل والأزرار', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="host"></div>';
        vi.clearAllMocks();
    });

    it('لا تحمِّل الدراسة في المخزن المشترك لمجرّد العرض (بلوكر بانر إصدار المحرك، 2026-08-29)', async () => {
        // كان store.set(data) يُستدعى هنا مباشرة داخل render() — بلا أي تفاعل من
        // المستخدم — و set() يستدعي save() داخلياً فيُطلق سلسلة حفظ (1000ms+800ms)
        // تُعيد وسم _meta.engineVersion صامتاً بمجرد *زيارة* هذه الصفحة، فيختفي تنبيه
        // تغيّر إصدار المحرك قبل أن يُقرأ أصلاً. تحميل الدراسة في المخزن يبقى صحيحاً
        // فقط عند نيّة تعديل فعلية (انظر الاختبار التالي).
        const { store } = await renderWith({ results: { decision: 'GO', indicators: { npv: 1 } } });
        expect(loadProjectMock).toHaveBeenCalledWith('p1');
        expect(store.set).not.toHaveBeenCalled();
    });

    it('زر «تعديل وتغيير» يحمّل الدراسة في المخزن ثم يستدعي onEdit — بهذا الترتيب', async () => {
        // زر التعديل ينقل للويزارد الذي يقرأ من المخزن، فبدون store.set هنا يفتح
        // الويزارد على دراسة أخرى (أو فارغة) — هذا هو الخلل التاريخي الذي حرست منه
        // هذه الشاشة أصلاً. الفرق عن التصميم القديم: التحميل الآن يحدث عند الضغط
        // الفعلي على التعديل لا عند مجرّد العرض، وقبل onEdit مباشرة — لا بعده.
        const calls = [];
        const onEdit = vi.fn(() => calls.push('onEdit'));
        const { store } = await renderWith({ results: { decision: 'GO', indicators: { npv: 1 } }, options: { onEdit } });
        store.set.mockImplementation(() => calls.push('store.set'));

        document.querySelector('.po__edit').click();

        expect(store.set).toHaveBeenCalledWith(FULL_STUDY);
        expect(onEdit).toHaveBeenCalledWith('p1');
        expect(calls).toEqual(['store.set', 'onEdit']);
    });

    it('يعرض حالة «غير موجودة» بلا انهيار حين يفشل التحميل', async () => {
        const { html } = await renderWith({ data: null });
        expect(html).toContain('الدراسة غير موجودة');
        expect(html).not.toContain('المؤشرات المالية');
    });

    it('لا ينهار حين يرمي المحرك استثناءً — يتراجع لحالة «لا قرار»', async () => {
        const { html } = await renderWith({ results: new Error('engine blew up') });
        expect(html).toContain('لا يوجد قرار بعد');
    });

    it('يقرأ اسم الدراسة من فهرس المشاريع حين يكون projectInfo.name فارغاً', async () => {
        // مقيس حياً: projectInfo.name = '' لدراسة تعرضها البطاقة باسم «مشروع جديد» —
        // الاسم يعيش في الفهرس لا في بيانات الدراسة. بدون هذا تتناقض الصفحة مع
        // البطاقة التي فُتحت منها («مشروع بلا اسم» مقابل «مشروع جديد»).
        getActiveProjectsMock.mockResolvedValueOnce([{ id: 'p1', name: 'مشروع جديد' }]);
        const { html } = await renderWith({
            data: { projectInfo: { name: '' } },
            results: { indicators: {} }
        });
        expect(html).toContain('مشروع جديد');
        expect(html).not.toContain('مشروع بلا اسم');
    });

    it('يُهرِّب اسم المشروع — لا حقن HTML', async () => {
        const { html } = await renderWith({
            data: { projectInfo: { name: '<img src=x onerror=alert(1)>' } },
            results: { indicators: {} }
        });
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).toContain('&lt;img');
        expect(document.querySelector('#host img')).toBeNull();
    });
});
