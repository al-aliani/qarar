/**
 * @vitest-environment jsdom
 *
 * QuickFeasibilityWizard — 3 أخطاء حقيقية اختُبرت حياً في مسار "الجدوى السريعة" (3 خطوات):
 *  1) الخطوة 1: اسم المشروع الفارغ كان يمر بصمت (يُستبدل بـ"مشروع جديد") بلا أي تنبيه أو منع.
 *  2) الخطوة 1→2: "ميزانية تقريبية" لم تكن تُرحَّل لحقل "الاستثمار الأولي" — يعيد المستخدم كتابتها يدوياً.
 *  3) لا حفظ تلقائي إطلاقاً لهذا المسار (بخلاف المعالج الكامل عبر utils/autoSave.js) — تحديث الصفحة
 *     يمسح كل شيء ويعيد المستخدم لخطوة 1 فارغة، حتى بعد إكمال المسار والوصول لنتيجة كاملة.
 *
 * ملاحظة: تحقق الخطوة 2 من حقول الإيراد/التكاليف/الاستثمار الصفرية موجود مسبقاً منذ commit
 * c006cc27 (2026-07-04) ويعمل فعلياً (toast.error حقيقي، لا استدعاءً معطّلاً). الاختبار أدناه
 * حارس انحدار يمنع كسره مستقبلاً، وليس إصلاحاً جديداً.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuickFeasibilityWizard } from '../QuickFeasibilityWizard.js';
import { toast } from '../../utils/toast.js';

const DRAFT_KEY = 'feas_quick_draft';

function mountWizard(options = {}) {
    document.body.innerHTML = '<div id="qfw-test"></div>';
    const wizard = new QuickFeasibilityWizard('qfw-test', {}, options);
    wizard.render();
    return wizard;
}

// ينتظر استقرار سلسلة الـ microtasks (IntelligenceService.getMarketDefaults في bindStep1)
// قبل أن يستدعي this.goToStep(2) — راجع QuickFeasibilityWizard.bindStep1.
async function flushAsync() {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    localStorage.clear();
});

describe('QuickFeasibilityWizard — التحقق من الحقول الإلزامية', () => {
    it('الخطوة 1: اسم مشروع فارغ يمنع المتابعة ويظهر تنبيه خطأ، ولا يستبدله بقيمة افتراضية صامتة', () => {
        const errorSpy = vi.spyOn(toast, 'error').mockImplementation(() => {});
        const wizard = mountWizard();

        document.getElementById('qf-projectName').value = '   '; // فراغ فقط بعد trim
        document.getElementById('qf-next-1').click();

        expect(errorSpy).toHaveBeenCalled();
        expect(wizard.step).toBe(1); // لم ينتقل للخطوة 2
        expect(wizard.quickData.projectName).toBe(''); // لم يُستبدل بـ"مشروع جديد" بصمت (السلوك القديم المعطوب)
        expect(document.getElementById('qf-projectName')).toBeTruthy(); // خطوة 1 ما زالت معروضة
    });

    it('الخطوة 2: حقول الإيراد/التكاليف/الاستثمار الصفرية تمنع المتابعة وتُظهر تنبيهاً (حارس انحدار)', async () => {
        const errorSpy = vi.spyOn(toast, 'error').mockImplementation(() => {});
        const wizard = mountWizard();

        document.getElementById('qf-projectName').value = 'مشروع تجريبي';
        document.getElementById('qf-next-1').click();
        await flushAsync();
        expect(wizard.step).toBe(2);
        errorSpy.mockClear();

        // الحقول المالية فارغة افتراضياً (null) عند دخول الخطوة 2 لأول مرة
        document.getElementById('qf-next-2').click();

        expect(errorSpy).toHaveBeenCalled();
        expect(wizard.step).toBe(2); // لم ينتقل للخطوة 3
        expect(document.getElementById('qf-monthlyRevenue')).toBeTruthy(); // خطوة 2 ما زالت معروضة
    });
});

describe('QuickFeasibilityWizard — ترحيل "ميزانية تقريبية" إلى "الاستثمار الأولي"', () => {
    it('قيمة الميزانية بالخطوة 1 تُعبّئ حقل الاستثمار الأولي بالخطوة 2 تلقائياً (كقيمة ابتدائية قابلة للتعديل)', async () => {
        vi.spyOn(toast, 'error').mockImplementation(() => {});
        const wizard = mountWizard();

        document.getElementById('qf-projectName').value = 'مشروع تجريبي';
        document.getElementById('qf-budget').value = '250000';
        document.getElementById('qf-next-1').click();
        await flushAsync();

        expect(wizard.step).toBe(2);
        expect(wizard.quickData.initialInvestment).toBe(250000);
        expect(Number(document.getElementById('qf-initialInvestment').value)).toBe(250000);
    });

    it('لا يطمس تقديراً قطاعياً اعتمده المستخدم صراحة عند تعديل الميزانية لاحقاً والعودة للخطوة التالية', async () => {
        vi.spyOn(toast, 'error').mockImplementation(() => {});
        const wizard = mountWizard();

        document.getElementById('qf-projectName').value = 'مشروع تجريبي';
        document.getElementById('qf-budget').value = '100000';
        document.getElementById('qf-next-1').click();
        await flushAsync();
        expect(wizard.quickData.initialInvestment).toBe(100000); // مرحّل من الميزانية

        // المستخدم يعتمد التقدير القطاعي صراحة (زر "املأ بالتقدير القطاعي") بدل رقم الميزانية المرحّل
        document.getElementById('qf-apply-estimate').click();
        const adoptedEstimate = wizard.quickData.initialInvestment;
        expect(adoptedEstimate).not.toBe(100000);

        // يرجع للخطوة 1 (ملاحظة: prev-2 لا يقرأ حقول الخطوة 2 — هذا سلوك سابق للتعديل الحالي)
        // ويغيّر الميزانية، ثم يتابع مجدداً
        document.getElementById('qf-prev-2').click();
        document.getElementById('qf-budget').value = '300000';
        document.getElementById('qf-next-1').click();
        await flushAsync();

        // التقدير الذي اعتمده صراحة لا يُطمس بميزانية جديدة (initialInvestment لم يعد متزامناً مع آخر ميزانية رُحّلت)
        expect(wizard.quickData.initialInvestment).toBe(adoptedEstimate);
    });
});

describe('QuickFeasibilityWizard — حفظ تلقائي محلي بين الخطوات', () => {
    it('يحفظ المسودة في localStorage عند الانتقال بين الخطوات، وتُستعاد عند إنشاء معالج جديد (محاكاة تحديث الصفحة)', async () => {
        vi.spyOn(toast, 'error').mockImplementation(() => {});
        const wizard = mountWizard();

        document.getElementById('qf-projectName').value = 'مقهى الاختبار';
        document.getElementById('qf-budget').value = '100000';
        document.getElementById('qf-next-1').click();
        await flushAsync();

        const raw = localStorage.getItem(DRAFT_KEY);
        expect(raw).toBeTruthy();
        const saved = JSON.parse(raw);
        expect(saved.step).toBe(2);
        expect(saved.quickData.projectName).toBe('مقهى الاختبار');

        // محاكاة F5: معالج جديد تماماً يُنشأ من نفس المتصفح/localStorage
        const restored = mountWizard();
        expect(restored.step).toBe(2);
        expect(restored.quickData.projectName).toBe('مقهى الاختبار');
        expect(restored.quickData.initialInvestment).toBe(100000);
        expect(document.getElementById('qf-monthlyRevenue')).toBeTruthy(); // رُسمت خطوة 2 مباشرة، لا خطوة 1 فارغة
    });

    it('يحتفظ بالمسودة حتى بعد الوصول للنتيجة الكاملة (خطوة 3) — لا يُفقد شيء عند تحديث الصفحة', async () => {
        vi.spyOn(toast, 'error').mockImplementation(() => {});
        const wizard = mountWizard();

        document.getElementById('qf-projectName').value = 'مقهى الاختبار';
        document.getElementById('qf-next-1').click();
        await flushAsync();

        document.getElementById('qf-monthlyRevenue').value = '20000';
        document.getElementById('qf-monthlyCosts').value = '10000';
        document.getElementById('qf-initialInvestment').value = '150000';
        document.getElementById('qf-next-2').click();

        expect(wizard.step).toBe(3);
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
        expect(saved.step).toBe(3);
        expect(saved.quickData.monthlyRevenue).toBe(20000);

        // محاكاة F5 على خطوة النتيجة نفسها
        const restored = mountWizard();
        expect(restored.step).toBe(3);
        expect(restored.quickData.monthlyRevenue).toBe(20000);
        expect(document.querySelector('#qf-download-pdf')).toBeTruthy(); // رُسمت خطوة 3 (النتيجة) مباشرة
    });

    it('يمسح المسودة المحفوظة فقط عند اكتمال المسار فعلياً نحو الدراسة الكاملة', async () => {
        vi.spyOn(toast, 'error').mockImplementation(() => {});
        const onFinish = vi.fn();
        const wizard = mountWizard({ onFinish });

        document.getElementById('qf-projectName').value = 'مقهى الاختبار';
        document.getElementById('qf-next-1').click();
        await flushAsync();

        document.getElementById('qf-monthlyRevenue').value = '20000';
        document.getElementById('qf-monthlyCosts').value = '10000';
        document.getElementById('qf-initialInvestment').value = '150000';
        document.getElementById('qf-next-2').click();
        expect(localStorage.getItem(DRAFT_KEY)).toBeTruthy();

        document.getElementById('qf-full-path').click();

        expect(onFinish).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });
});
