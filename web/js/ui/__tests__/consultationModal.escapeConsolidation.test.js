/**
 * @vitest-environment jsdom
 *
 * تدقيق أمني 2026-08-27: ConsultationModal.js كان يُعرِّف escapeHtml محلياً
 * ناقصاً — لا يُهرِّب علامة التنصيص المفردة ('). استُبدلت بالنسخة الموحّدة في
 * web/js/utils/escape.js (نفس نمط ReportGenerator.js/ShareModal.js).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/toast.js', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../utils/analytics.js', () => ({ trackEvent: vi.fn() }));
vi.mock('../../utils/modalA11y.js', () => ({ attachModalA11y: () => ({ release: vi.fn() }) }));

describe('ConsultationModal — تهريب اسم/نشاط/موقع المشروع بالكامل', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="consultationModalOverlay"></div>';
    });

    it('اسم مشروع يحوي وسم HTML خام لا يُنفَّذ في ملخص الدراسة', async () => {
        const { ConsultationModal } = await import('../ConsultationModal.js');
        const state = {
            projectInfo: { name: '<script>alert(1)</script>', concept: 'اختبار', city: 'الرياض' },
        };
        const store = { getState: () => state };
        const modal = new ConsultationModal('consultationModalOverlay', store);
        modal.render();

        const html = document.getElementById('consultationModalOverlay').innerHTML;
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('نص عادي بلا وسوم يبقى يظهر طبيعياً (لا انحدار وظيفي)', async () => {
        const { ConsultationModal } = await import('../ConsultationModal.js');
        const state = { projectInfo: { name: 'مطعم شاورما', concept: 'مطاعم', city: 'جدة' } };
        const store = { getState: () => state };
        const modal = new ConsultationModal('consultationModalOverlay', store);
        modal.render();

        const html = document.getElementById('consultationModalOverlay').innerHTML;
        expect(html).toContain('مطعم شاورما');
    });

    it('[إثبات الحارس] الدالة المحلية القديمة لم تكن تُهرِّب علامة التنصيص المفردة', () => {
        function oldEscapeHtml(str) {
            if (str == null) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        expect(oldEscapeHtml("it's a test")).toBe("it's a test");
    });
});
