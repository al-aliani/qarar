/**
 * تدقيق 2026-07-09 (توحيد المصادقة): AuthComponent.js كان 419 سطراً غير قابل للوصول
 * إطلاقاً (حاويته #authContainer داخل .sidebar المخفية دائماً عبر main.css) يحمل
 * إعادة تنفيذ متضاربة لتسجيل الدخول (استدعاء مباشر لـ supabase.auth.signInWithPassword
 * بدل signIn() الموحّدة)، ومنطق MFA/AAL الوحيد في المشروع، والمُرسِل الوحيد لحدث
 * feasibility:showUserProfile. حُذف بالكامل بعد نقل ما يلزم لمسارات حية.
 * Sidebar.js حمل نسخة ثالثة ميتة من واجهة الدخول/الخروج (#authWidget داخل #stepperNav
 * المخفي أيضاً) — أُزيلت أيضاً.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, '..', '..');

describe('توحيد المصادقة — حذف الكود الميت', () => {
    it('AuthComponent.js حُذف فعلياً من القرص', () => {
        expect(existsSync(join(webRoot, 'js/ui/AuthComponent.js'))).toBe(false);
    });

    it('index.html لا يحتوي #authContainer اليتيم بعد', () => {
        const html = readFileSync(join(webRoot, 'index.html'), 'utf8');
        expect(html).not.toContain('id="authContainer"');
    });

    it('app.js لا يستورد AuthComponent ولا ينشئ نسخة منه (تعليقات تاريخية تذكره مسموحة)', () => {
        const src = readFileSync(join(webRoot, 'app.js'), 'utf8');
        expect(src).not.toContain("from './js/ui/AuthComponent.js'");
        expect(src).not.toContain('new AuthComponent(');
    });

    it('Sidebar.js لا يحمل أي بقايا لواجهة الحساب/الخروج الميتة (#authWidget)', () => {
        const src = readFileSync(join(webRoot, 'js/ui/Sidebar.js'), 'utf8');
        expect(src).not.toContain('authWidget');
        expect(src).not.toContain('updateAuthWidget');
        expect(src).not.toContain('updateSaveStatus');
    });

    it('Sidebar.js لا يستورد supabaseClient.js أو AuthModalStub.js بعد إزالة الواجهة الميتة', () => {
        const src = readFileSync(join(webRoot, 'js/ui/Sidebar.js'), 'utf8');
        expect(src).not.toContain('supabaseClient.js');
        expect(src).not.toContain('AuthModalStub');
    });

    it('خروج الخمول (idle-timeout) في app.js يستدعي فعلياً signOut() الموحّدة داخل onIdle', () => {
        const src = readFileSync(join(webRoot, 'app.js'), 'utf8');
        const onIdleStart = src.indexOf('onIdle: async () => {');
        expect(onIdleStart).toBeGreaterThan(-1);
        const onIdleBody = src.slice(onIdleStart, src.indexOf('});', onIdleStart));
        // الاستدعاء الفعلي (لا التعليق التوثيقي أعلاه الذي يذكر العلة القديمة تاريخياً)
        expect(onIdleBody).toContain("const { signOut } = await import('./supabaseClient.js');");
        expect(onIdleBody).toContain('await signOut();');
        expect(onIdleBody).not.toMatch(/await supabase\.auth\.signOut\(\)/);
    });
});
