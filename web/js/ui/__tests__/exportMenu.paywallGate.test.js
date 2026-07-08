/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة عالية #39): يثبّت أن بطاقات صيغ "التقرير النهائي"
 * الاحترافية (PDF/Excel/Word/...) تفتح نافذة الترقية (PaywallModal) فعلياً بدل
 * توليد الملف مباشرة، بينما الأدوات الخام/المشاركة المجانية (JSON/CSV/لوحة
 * المستثمر) تستمر بلا أي حاجز — لا كسر توافق لسلوك موجود.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportMenu, PREMIUM_EXPORT_TYPES } from '../ExportMenu.js';
import { createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, update: vi.fn(), notify: vi.fn() };
}

describe('ExportMenu — بوابة الترقية تعترض صيغ التقرير النهائي', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="exportMenuOverlay"></div>`;
    });

    it('النقر على صيغة PDF (premium) يفتح PaywallModal ولا يستدعي PDFGenerator.generate إطلاقاً', async () => {
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        const generateSpy = vi.spyOn(menu.pdfGenerator, 'generate').mockResolvedValue('test.pdf');

        await menu.handleExport('pdf', document.createElement('button'));

        expect(generateSpy).not.toHaveBeenCalled();
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
