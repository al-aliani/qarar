/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة عالية #39): يثبّت أن بطاقات صيغ "التقرير النهائي"
 * الاحترافية (PDF/Excel/Word/...) تفتح نافذة الترقية (PaywallModal) فعلياً بدل
 * توليد الملف مباشرة، بينما الأدوات الخام/المشاركة المجانية (JSON/CSV/لوحة
 * المستثمر) تستمر بلا أي حاجز — لا كسر توافق لسلوك موجود.
 *
 * تدقيق 2026-07-09 (أتمتة الدفع): hasActivePayment() مُموَّهة صراحة هنا (بدل
 * تركها تستدعي supabaseClient.js الحقيقي — كانت تصل فعلياً لمشروع Supabase
 * الإنتاجي الافتراضي أثناء الاختبارات، بطيء وغير حتمي) — راجع أيضاً
 * paymentGate.test.js أدناه للمسار "مدفوع فعلاً".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyStudy } from '../../core/schema.js';
import { ExportMenu, PREMIUM_EXPORT_TYPES } from '../ExportMenu.js';

const hasActivePaymentMock = vi.fn(async () => false);
vi.mock('../../services/PaymentService.js', () => ({
    hasActivePayment: (...a) => hasActivePaymentMock(...a),
    startCheckout: vi.fn(async () => ({ ok: false, error: 'not used in this test' })),
}));

// تدقيق 2026-07-18: ExportMenu لم يعد يبني this.pdfGenerator (استُبدل توليد PDF بدالة
// generateNativePDF مستوردة مباشرة) — نموّه هنا بدل التجسّس على خاصية لم تعد موجودة.
const generateNativePDFMock = vi.fn(async () => true);
vi.mock('../NativePDFExport.jsx', () => ({
    generateNativePDF: (...a) => generateNativePDFMock(...a),
}));

function fakeStore(state) {
    return { getState: () => state, update: vi.fn(), notify: vi.fn() };
}

describe('ExportMenu — بوابة الترقية تعترض صيغ التقرير النهائي', () => {
    beforeEach(async () => {
        document.body.innerHTML = `<div id="exportMenuOverlay"></div>`;
        hasActivePaymentMock.mockReset().mockResolvedValue(false);
        generateNativePDFMock.mockClear();
    });

    it('النقر على صيغة PDF (premium) يفتح PaywallModal ولا يستدعي generateNativePDF إطلاقاً', async () => {
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));

        await menu.handleExport('pdf', document.createElement('button'));

        expect(generateNativePDFMock).not.toHaveBeenCalled();
        const paywallOverlay = document.getElementById('paywallModalOverlay');
        expect(paywallOverlay).toBeTruthy();
        expect(paywallOverlay.classList.contains('is-open')).toBe(true);
        expect(paywallOverlay.textContent).toContain('التقرير الشامل');
    });

    it('النقر على صيغة Excel (premium) يفتح PaywallModal بالمسمى الصحيح', async () => {
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        await menu.handleExport('excel', document.createElement('button'));

        const paywallOverlay = document.getElementById('paywallModalOverlay');
        expect(paywallOverlay.classList.contains('is-open')).toBe(true);
        expect(paywallOverlay.textContent).toContain('ملف الجداول المالية التفصيلي');
    });

    it('صيغة مجانية (json) لا تفتح PaywallModal إطلاقاً — تستمر بمسارها الطبيعي', async () => {
        global.URL.createObjectURL = vi.fn(() => 'blob:mock');
        global.URL.revokeObjectURL = vi.fn();

        const study = createEmptyStudy();
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(study));
        const btn = document.createElement('button');
        btn.innerHTML = 'ملف المشروع (JSON)';

        await menu.handleExport('json', btn);

        // لا نافذة ترقية ظهرت لصيغة مجانية
        const paywallOverlay = document.getElementById('paywallModalOverlay');
        expect(paywallOverlay?.classList.contains('is-open')).not.toBe(true);
    });

});

describe('ExportMenu — دراسة مدفوعة فعلاً تتخطى بوابة الترقية', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="exportMenuOverlay"></div>`;
        hasActivePaymentMock.mockReset().mockResolvedValue(true);
    });

    it('hasActivePayment=true ⇒ لا تُفتح PaywallModal لصيغة premium (excel)', async () => {
        const study = { ...createEmptyStudy(), projectInfo: { ...createEmptyStudy().projectInfo, id: 'study-paid-1' } };
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(study));
        // نمنع فعلياً استكمال منطق التصدير (بوابة الجودة/توليد الملف) — يكفي
        // إثبات عدم فتح PaywallModal لأن هذا هو سلوك البوابة المطلوب اختباره.
        vi.spyOn(menu, '_qaGate').mockResolvedValue(false);

        await menu.handleExport('excel', document.createElement('button'));

        expect(hasActivePaymentMock).toHaveBeenCalledWith('study-paid-1');
        const paywallOverlay = document.getElementById('paywallModalOverlay');
        expect(paywallOverlay?.classList.contains('is-open')).not.toBe(true);
    });
});

describe('ExportMenu — مسمّيات الصيغ المقفلة لا تحوي رموزاً إنجليزية يعيد installArabicUiGuard كتابتها', () => {
    // تدقيق 2026-07-08 (خلل مُكتشَف حيّاً): app.js:39 يستبدل /PDF/gi تلقائياً بكلمة
    // "تقرير" في كل نص بالصفحة (بلا استثناء لمحتوى الوحدات الديناميكية). مسمّى أول
    // كان "تقرير PDF شامل" فأصبح فعلياً "تقرير تقرير شامل" (تكرار) بعد مرور الحارس.
    // هذا يمنع عودة الخلل: لا رمز إنجليزي مُستبدَل ضمن نصوص المسمّيات.
    const REWRITTEN_TOKENS = /\b(PDF|Excel|Word|PowerPoint|Pitch(?:\s*Deck)?|JSON|CSV|HTML|Google|Dashboard|Quick)\b/i;

    it('كل مسمّى في PREMIUM_EXPORT_TYPES خالٍ من أي رمز يُعيد الحارس كتابته (لا تكرار كلمات محتمل)', () => {
        for (const [type, label] of PREMIUM_EXPORT_TYPES) {
            expect(label, `مسمّى "${type}" ("${label}") يحوي رمزاً سيُعاد كتابته تلقائياً`).not.toMatch(REWRITTEN_TOKENS);
        }
    });
});
