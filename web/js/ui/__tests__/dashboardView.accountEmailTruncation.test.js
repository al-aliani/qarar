/**
 * @vitest-environment jsdom
 *
 * تدقيق جوال 2026-09-16: البريد الإلكتروني في #dvAccountToggle (شريط لوحة التحكم
 * العلوي) كان نصاً خاماً بجانب أيقونة داخل زر flex بلا أي عنصر/تنسيق اقتصاص — على
 * الجوال (dv-topbar__auth يأخذ width:100% أسفل 768px) بريد طويل نسبياً يفيض فعلياً
 * خارج حافة الشاشة (لوحظ حياً: يمتد إلى ما بعد x=0) بلا أي علامة "..." توضح القطع.
 * السبب البنيوي: #dvAccountToggle عنصر flex (.btn = inline-flex)، وعناصر flex لا
 * تنكمش تلقائياً دون min-width:0 صريح — فالنص يفرض عرضه الكامل بصرف النظر عن
 * overflow/text-overflow على الحاوية.
 *
 * الإصلاح: البريد الآن داخل span.dv-account__email مُعقَّم (escapeHtml) مع
 * min-width:0 + overflow:hidden + text-overflow:ellipsis + white-space:nowrap،
 * وmin-width:0 أيضاً على الزر والحاوية الأب كي ينكمش المسار كاملاً بدل إيقافه
 * عند أول عنصر flex غير قابل للانكماش.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: { email: 'user@example.com' } })),
    signOut: vi.fn(async () => {})
}));

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: { getActiveProjects: vi.fn(async () => []) }
}));

function fakeStore() {
    return { getState: () => ({}), get: () => ({}), subscribe: () => () => {} };
}

describe('DashboardView — بريد الحساب في dvAccountToggle داخل عنصر قابل للاقتصاص', () => {
    it('البريد يظهر داخل span.dv-account__email (لا كنص خام مباشر في الزر)', async () => {
        document.body.innerHTML = '<div id="dv"></div>';
        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', fakeStore());
        await view.render();

        const emailSpan = document.querySelector('#dvAccountToggle .dv-account__email');
        expect(emailSpan).not.toBeNull();
        expect(emailSpan.textContent).toBe('user@example.com');
    });

    it('بريد طويل جداً: العنصر لا يزال ابن الزر مباشرة (يعتمد الاقتصاص على CSS: min-width:0 + ellipsis)', async () => {
        const { getAuthUser } = await import('../../../supabaseClient.js');
        const longEmail = 'qarar.mobile.audit.very.long.local.part.20260916@example-subdomain.com';
        getAuthUser.mockResolvedValueOnce({ user: { email: longEmail } });

        document.body.innerHTML = '<div id="dv"></div>';
        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', fakeStore());
        await view.render();

        const emailSpan = document.querySelector('#dvAccountToggle .dv-account__email');
        expect(emailSpan.textContent).toBe(longEmail);
        expect(document.getElementById('dvAccountToggle').outerHTML).not.toContain(longEmail + '</button>');
    });

    it('بريد يحوي وسم HTML خام (دفاع بالعمق) لا يُنفَّذ — يظهر كنص خام فقط', async () => {
        const { getAuthUser } = await import('../../../supabaseClient.js');
        const maliciousEmail = '<img src=x onerror=alert(1)>@example.com';
        getAuthUser.mockResolvedValueOnce({ user: { email: maliciousEmail } });

        document.body.innerHTML = '<div id="dv"></div>';
        const { DashboardView } = await import('../DashboardView.js');
        const view = new DashboardView('dv', fakeStore());
        await view.render();

        const emailSpan = document.querySelector('#dvAccountToggle .dv-account__email');
        expect(emailSpan.querySelector('img')).toBeNull();
        expect(emailSpan.textContent).toBe(maliciousEmail);
    });
});
