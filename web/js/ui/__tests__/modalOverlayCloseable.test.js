/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-17: ExportMenu/ConsultationModal/ShareStudyView overlays مُعرَّفة
 * مسبقاً في index.html كـ<div id="..."></div> فارغة بلا class="modal-overlay" (خارج
 * app-shell). البنّاء القديم كان يضبط الكلاس فقط داخل فرع `if (!this.overlay)` — بما أن
 * getElementById ينجح دائماً هنا، هذا الفرع ميت فعلياً، فتبقى النافذة بلا الكلاس الذي
 * يتحكم بعرضها/إخفائها عبر .is-open (components.css) — X/الخلفية/Escape يزيلون is-open
 * بلا أي أثر بصري. هذا الاختبار يحاكي نفس بنية index.html الحقيقية (عنصر فارغ بلا كلاس)
 * لا كونتينر نظيف جاهز، كي لا يُخفي الاختبار نفس العلة كما حدث للاختبارات القديمة.
 */
import { describe, it, expect, vi } from 'vitest';
import { createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: vi.fn(), notify: vi.fn() };
}

describe('ExportMenu — overlay مُعرَّف مسبقاً بلا كلاس (بنية index.html الحقيقية)', () => {
    it('يضبط class="modal-overlay" رغم أن العنصر موجود سلفاً بلا أي كلاس', async () => {
        document.body.innerHTML = '<div id="exportMenuOverlay"></div>';
        const { ExportMenu } = await import('../ExportMenu.js');
        new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));

        expect(document.getElementById('exportMenuOverlay').classList.contains('modal-overlay')).toBe(true);
    });

    it('open() ثم close(): يزيل is-open من عنصر يحمل فعلاً class="modal-overlay"', async () => {
        document.body.innerHTML = '<div id="exportMenuOverlay"></div>';
        const { ExportMenu } = await import('../ExportMenu.js');
        const menu = new ExportMenu('exportMenuOverlay', fakeStore(createEmptyStudy()));
        await menu.open();

        const overlay = document.getElementById('exportMenuOverlay');
        expect(overlay.classList.contains('modal-overlay')).toBe(true);
        expect(overlay.classList.contains('is-open')).toBe(true);

        menu.close();
        expect(overlay.classList.contains('is-open')).toBe(false);
        expect(overlay.classList.contains('modal-overlay')).toBe(true);
    });
});

describe('ConsultationModal — overlay مُعرَّف مسبقاً بلا كلاس', () => {
    it('يضبط class="modal-overlay" رغم أن العنصر موجود سلفاً بلا أي كلاس', async () => {
        document.body.innerHTML = '<div id="consultationModalOverlay"></div>';
        const { ConsultationModal } = await import('../ConsultationModal.js');
        new ConsultationModal('consultationModalOverlay', fakeStore(createEmptyStudy()));

        expect(document.getElementById('consultationModalOverlay').classList.contains('modal-overlay')).toBe(true);
    });
});

describe('ShareStudyView — overlay مُعرَّف مسبقاً بلا كلاس', () => {
    it('يضبط class="modal-overlay" رغم أن العنصر موجود سلفاً بلا أي كلاس', async () => {
        document.body.innerHTML = '<div id="shareStudyOverlay"></div>';
        const { ShareStudyView } = await import('../ShareStudyView.js');
        new ShareStudyView('shareStudyOverlay', fakeStore(createEmptyStudy()));

        expect(document.getElementById('shareStudyOverlay').classList.contains('modal-overlay')).toBe(true);
    });
});
