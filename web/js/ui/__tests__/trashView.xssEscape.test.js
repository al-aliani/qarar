/**
 * @vitest-environment jsdom
 *
 * دفعة 0.1 (2026-08-28، إيقاف نزيف XSS): اسم المشروع المحذوف كان يُدرَج خاماً في
 * `<h3>${project.name}</h3>` — حقن عنصر كامل مثبَّت بالتنفيذ (مثال: اسم مشروع
 * `<img src=x onerror=alert(1)>` يصير عنصر <img> حياً في DOM بمجرد فتح سلة
 * المحذوفات، بلا أي تفاعل من المستخدم). مسار التسليم الحقيقي: استيراد نسخة
 * احتياطية (backup JSON) بأسماء مشاريع خبيثة، ثم حذفها لاحقاً تفتح سلة المحذوفات.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TrashView } from '../TrashView.js';
import { ProjectManager } from '../../services/ProjectManager.js';

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: {
        getDeletedProjects: vi.fn(),
        restoreProject: vi.fn(),
        permanentDelete: vi.fn(),
    },
}));

describe('TrashView — حقن عنصر HTML كامل عبر اسم مشروع محذوف (استغلال فعلي)', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('اسم مشروع يحمل <img onerror=...> يظهر نصاً خاملاً، لا عنصر <img> حياً', async () => {
        const maliciousName = '<img src=x onerror="window.__xss_fired = true">';
        ProjectManager.getDeletedProjects.mockResolvedValue([
            { id: 'p1', name: maliciousName, lastModified: '2026-08-01T00:00:00.000Z', deletedAt: '2026-08-02T00:00:00.000Z' },
        ]);

        const view = new TrashView();
        const container = await view.render();

        // العطل الأصلي: لو انحقن العنصر فعلياً، onerror كان لينفَّذ فور تحليل HTML
        // (src=x يفشل تحميله دائماً) قبل أي تفاعل — لم يحدث ذلك هنا.
        expect(window.__xss_fired).toBeUndefined();
        expect(container.querySelector('img[onerror]')).toBeNull();

        const h3 = container.querySelector('h3.font-bold');
        expect(h3.textContent).toBe(maliciousName);
        expect(h3.innerHTML).not.toContain('<img');
        expect(h3.innerHTML).toContain('&lt;img');

        delete window.__xss_fired;
    });

    it('data-name على زر الحذف النهائي مهرَّب أيضاً (لا يكسر السمة)', async () => {
        const nameWithQuote = 'مشروع" onmouseover="alert(1)';
        ProjectManager.getDeletedProjects.mockResolvedValue([
            { id: 'p2', name: nameWithQuote, lastModified: '2026-08-01T00:00:00.000Z' },
        ]);

        const view = new TrashView();
        const container = await view.render();

        const deleteBtn = container.querySelector('.btn-permanent-delete');
        expect(deleteBtn.getAttribute('data-name')).toBe(nameWithQuote);
        expect(deleteBtn.hasAttribute('onmouseover')).toBe(false);
    });

    it('[إثبات الحارس] العطل الأصلي: اسم مشروع خام في innerHTML ينشئ عنصراً حياً فعلياً', () => {
        const maliciousName = '<img src=x onerror="window.__xss_fired_guard = true">';
        const probe = document.createElement('div');
        // محاكاة السطر الأصلي المحذوف: `<h3 ...>${project.name}</h3>` بلا أي تهريب
        probe.innerHTML = `<h3 class="font-bold text-lg mb-2 text-gray-800">${maliciousName}</h3>`;
        expect(probe.querySelector('img[onerror]')).not.toBeNull();
    });
});
