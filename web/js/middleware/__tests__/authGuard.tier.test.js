import { describe, it, expect } from 'vitest';
import { AuthGuard } from '../AuthGuard.js';

/**
 * حارس ضد الترقية الذاتية: كانت الطبقة تُقرأ من user_metadata (يعدّلها المستخدم
 * بنفسه عبر supabase.auth.updateUser فيرقّي نفسه لـ enterprise). الآن من app_metadata
 * (لا تُكتب إلا من الخادم بمفتاح service_role). الافتراضي 'free' = رفض بالافتراض.
 */
describe('AuthGuard: طبقة الاشتراك من app_metadata لا user_metadata', () => {
    it('app_metadata يفوز على user_metadata المُزوَّر', () => {
        AuthGuard.currentUser = {
            id: 'u1',
            app_metadata: { subscription_tier: 'free' },
            user_metadata: { subscription_tier: 'enterprise' } // محاولة ترقية ذاتية
        };
        expect(AuthGuard.getSubscriptionTier()).toBe('free');
        expect(AuthGuard.hasPermission('api_access')).toBe(false); // enterprise فقط — مرفوض
        expect(AuthGuard.hasPermission('export_pdf')).toBe(true);  // متاح للمجاني
    });

    it('غياب app_metadata ⇒ free (رفض بالافتراض)', () => {
        AuthGuard.currentUser = { id: 'u2', user_metadata: { subscription_tier: 'pro' } };
        expect(AuthGuard.getSubscriptionTier()).toBe('free');
    });

    it('app_metadata=pro ⇒ صلاحيات pro فقط', () => {
        AuthGuard.currentUser = { id: 'u3', app_metadata: { subscription_tier: 'pro' } };
        expect(AuthGuard.getSubscriptionTier()).toBe('pro');
        expect(AuthGuard.hasPermission('save_cloud')).toBe(true);
        expect(AuthGuard.hasPermission('api_access')).toBe(false); // enterprise فقط
    });
});
