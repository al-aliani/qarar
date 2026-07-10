/**
 * صفحة المستخدم — حسابي
 * تعرض في المنطقة الرئيسية عند طلب "حسابي"
 */

import { getSupabaseClient, getAuthUser, updateUserDisplayName, signOut } from '../../supabaseClient.js';
import { log as auditLog, ACTIONS } from '../utils/auditLogger.js';
import { toast } from '../utils/toast.js';

function getDisplayName(user) {
  return (user?.user_metadata?.full_name || '').trim() || user?.email || user?.phone || '—';
}

export class UserProfileView {
    /**
     * @param {HTMLElement} container - العنصر الذي يُعرض فيه المحتوى (مثلاً wizardContainer)
     * @param {object} options - { onBack: () => void }
     */
    constructor(container, options = {}) {
        this.container = container;
        this.onBack = options.onBack || (() => {});
    }

    async render() {
        if (!this.container) return;

        const { user } = await getAuthUser();
        if (!user) {
            this.container.innerHTML = '<p class="text-muted">يجب تسجيل الدخول لعرض صفحة الحساب.</p>';
            return;
        }

        const createdAt = user.created_at
            ? new Date(user.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', numberingSystem: 'latn' })
            : '—';
        const displayName = getDisplayName(user);
        const initial = (displayName !== '—' ? displayName[0] : (user.email || user.phone || '?')[0]).toUpperCase();

        this.container.innerHTML = `
            <div class="user-profile-page" style="max-width: 560px; margin: 0 auto; padding: var(--s-4) 0;">
                <button type="button" id="btnUserProfileBack" class="btn btn--ghost mb-4" style="display: inline-flex; align-items: center; gap: 8px;">
                    ← العودة للدراسة
                </button>

                <div class="card p-6 mb-4">
                    <h2 class="text-xl font-bold mb-4" style="border-bottom: 1px solid var(--c-border); padding-bottom: var(--s-2);">حسابي</h2>

                    <div class="flex items-center gap-4 mb-6">
                        <div class="avatar bg-success text-white rounded-full w-16 h-16 flex items-center justify-center font-bold text-2xl">
                            ${initial}
                        </div>
                        <div class="flex-1">
                            <div class="text-sm text-muted">البريد / الجوال</div>
                            <div class="font-bold">${user.email || user.phone || user.user_metadata?.email || '—'}</div>
                            <div class="text-xs text-muted mt-1">تاريخ الانضمام: ${createdAt}</div>
                        </div>
                    </div>

                    <div class="form-group mb-4">
                        <label class="block text-sm font-medium mb-1">اسم العرض (يظهر في الشريط الجانبي)</label>
                        <input type="text" id="inpDisplayName" class="form-input w-full" placeholder="مثال: أحمد محمد" value="${(user.user_metadata?.full_name || '').replace(/"/g, '&quot;')}">
                        <button type="button" id="btnSaveDisplayName" class="btn btn--primary mt-2 text-sm">حفظ الاسم</button>
                    </div>

                    <div class="space-y-3">
                        <button type="button" id="btnUserProfileIntegrations" class="btn btn--secondary w-full" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            🔗 التكاملات (Google Sheets، reCAPTCHA، إلخ)
                        </button>
                        <button type="button" id="btnUserProfile2FA" class="btn btn--secondary w-full" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            🔐 المصادقة الثنائية (2FA)
                        </button>
                        <button type="button" id="btnUserProfileLogout" class="btn btn--ghost w-full text-danger" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            🚪 تسجيل الخروج
                        </button>
                    </div>
                </div>

                <p class="text-xs text-muted">دراساتك تُحفظ سحابياً وتظهر في القائمة الجانبية عند فتح "تحميل دراسة".</p>
            </div>
        `;

        document.getElementById('btnUserProfileBack')?.addEventListener('click', () => this.onBack());

        document.getElementById('btnUserProfileIntegrations')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showIntegrations', { detail: { onBackToProfile: true } }));
        });

        const inpDisplayName = document.getElementById('inpDisplayName');
        document.getElementById('btnSaveDisplayName')?.addEventListener('click', async () => {
            const name = (inpDisplayName?.value || '').trim();
            const result = await updateUserDisplayName(name);
            if (result.ok) {
                toast.success('تم حفظ الاسم');
                window.dispatchEvent(new CustomEvent('feasibility:userProfileUpdated'));
                await this.render();
            } else {
                toast.error(result.error || 'فشل حفظ الاسم');
            }
        });

        document.getElementById('btnUserProfile2FA')?.addEventListener('click', async () => {
            const { TwoFactorModal } = await import('./TwoFactorModal.js');
            const modal = new TwoFactorModal();
            modal.show();
        });

        document.getElementById('btnUserProfileLogout')?.addEventListener('click', async () => {
            auditLog(ACTIONS.LOGOUT, {});
            toast.info('تم تسجيل الخروج');
            await signOut();
        });
    }
}
