/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalExports, recordLocalExport } from '../../services/LocalExportHistory.js';

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: null })),
    getSupabaseClient: vi.fn(async () => ({ ok: false, supabase: null }))
}));

describe('DownloadsCenterView — السجل المحلي', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="downloads"></main>';
        localStorage.clear();
        clearLocalExports();
    });

    it('يعرض التنزيلات المحلية ويستدعي إعادة التوليد من الزر', async () => {
        recordLocalExport(
            { filename: 'study_backup.json', mimeType: 'application/json', size: 512 },
            { studyName: 'متجر', qa: { status: 'ready', readiness: 100, hardCount: 0, warningCount: 0 } }
        );
        const onRegenerate = vi.fn();
        const { DownloadsCenterView } = await import('../DownloadsCenterView.js');
        const view = new DownloadsCenterView(document.getElementById('downloads'), { onRegenerate });

        await view.render();

        expect(document.body.textContent).toContain('السجل المحلي');
        expect(document.body.textContent).toContain('study_backup.json');
        expect(document.body.textContent).toContain('جاهز 100%');

        document.querySelector('.dv-regenerate-export').click();
        expect(onRegenerate).toHaveBeenCalledTimes(1);
    });
});
