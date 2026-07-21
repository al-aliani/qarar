/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { ReportPreviewModal } from '../ReportPreviewModal.js';

describe('ReportPreviewModal — معاينة التقرير قبل الشراء', () => {
    it('يعرض بيانات الدراسة بعلامة مائية ولا يكشف التقرير الكامل', async () => {
        const store = {
            getState: () => ({
                projectInfo: { name: 'مقهى الاختبار' },
                financing: {},
                assumptions: { thresholds: {} },
                results: { indicators: { npv: 120000, irr: 0.19, paybackPeriod: 3 } }
            })
        };
        const modal = new ReportPreviewModal(store);
        await modal.open('التقرير البنكي');

        const overlay = document.getElementById('reportPreviewOverlay');
        expect(overlay.classList.contains('is-open')).toBe(true);
        expect(overlay.textContent).toContain('معاينة مجانية قبل الشراء');
        expect(overlay.textContent).toContain('مقهى الاختبار');
        expect(overlay.textContent).toContain('علامة مائية');
        expect(overlay.textContent).toContain('تُفتح الصفحات الكاملة');
        expect(document.querySelectorAll('.report-preview-watermark').length).toBeGreaterThan(0);
        modal.close();
    });

    it('يستعيد التمرير وينفّذ العودة مرة واحدة عند إغلاق المعاينة', async () => {
        const onClose = vi.fn();
        const modal = new ReportPreviewModal({ getState: () => ({}) }, 'reportPreviewOverlay2', onClose);
        await modal.open();

        expect(document.body.style.overflow).toBe('hidden');
        modal.close();
        modal.close();

        expect(document.body.style.overflow).toBe('');
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
