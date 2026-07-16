/**
 * AuthGuard - حارس المصادقة
 * يتحكم في الوصول للتطبيق بناءً على حالة المصادقة
 */

import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';
import { log as auditLog, ACTIONS } from '../utils/auditLogger.js';
// واجهة مصادقة موحّدة: نستخدم النافذة (AuthModalStub) في كل المسارات بدل شاشة منفصلة.

class AuthGuardClass {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.isConfigured = false;
        this.listeners = [];
        this.initialized = false;
        this._reviewerCache = null; // { userId, value } — يُبطَل عند أي تغيّر بحالة المصادقة
        this._adminCache = null; // { userId, value } — نفس مبدأ _reviewerCache
    }

    /**
     * تهيئة حارس المصادقة
     * @param {Object} options
     * @param {boolean} options.requireAuth - هل المصادقة مطلوبة؟
     * @param {Function} options.onAuthChange - callback عند تغير حالة المصادقة
     */
    async init(options = {}) {
        const { requireAuth = false, onAuthChange = () => {} } = options;

        // Check Supabase configuration
        const { ok } = await getSupabaseClient();
        this.isConfigured = ok;

        if (!ok) {
            console.log('[AuthGuard] Supabase not configured, running in offline mode');
            this.initialized = true;

            if (requireAuth) {
                this.showAuthPrompt(onAuthChange);
            }

            return { authenticated: false, user: null, configured: false };
        }

        // Check current user
        const { user, ok: authOk } = await getAuthUser();

        this.currentUser = user;
        this.isAuthenticated = authOk && !!user;
        this.initialized = true;

        // Subscribe to auth changes
        this.subscribeToAuthChanges(onAuthChange);

        // If auth required but not authenticated, show auth screen
        if (requireAuth && !this.isAuthenticated) {
            this.showAuthPrompt(onAuthChange);
        }

        return {
            authenticated: this.isAuthenticated,
            user: this.currentUser,
            configured: this.isConfigured
        };
    }

    /**
     * الاشتراك في تغييرات المصادقة
     *
     * تدقيق 2026-07-09 (توحيد المصادقة): مركز وحيد الآن لتسجيل أحداث الدخول/الخروج في
     * سجل التدقيق (auditLog) — كانت هذه الاستدعاءات موجودة فقط داخل AuthComponent.js
     * الميت (حاويته #authContainer مخفية دائماً)، فلم يُسجَّل أي دخول/خروج فعلي في
     * الإنتاج إطلاقاً رغم وجود الكود. تُغطّي SIGNED_IN كل مسارات الدخول الحية (بريد+كلمة
     * مرور، OAuth، استعادة كلمة المرور)، وSIGNED_OUT كل مسارات الخروج (يدوي أو خمول).
     * PASSWORD_RECOVERY: يُطلقه Supabase تلقائياً حين يفتح المستخدم رابط استعادة كلمة
     * المرور من بريده (detectSessionInUrl مفعَّل في supabaseClient.js) — نعرض نافذة
     * تعيين كلمة مرور جديدة بدل تركه على صفحة لا تفعل شيئاً (كانت هذه هي العلة الأصلية:
     * لا معالج لهذا الحدث إطلاقاً، فتنتهي رحلة "نسيت كلمة المرور" لصفحة ميتة).
     */
    async subscribeToAuthChanges(callback) {
        const { supabase } = await getSupabaseClient();
        if (!supabase) return;

        supabase.auth.onAuthStateChange((event, session) => {
            console.log('[AuthGuard] Auth state changed:', event);

            const previousUser = this.currentUser;
            this.currentUser = session?.user || null;
            this.isAuthenticated = !!this.currentUser;
            this._reviewerCache = null; // هوية مختلفة (أو خروج) = ذاكرة isReviewer() القديمة غير صالحة
            this._adminCache = null; // نفس السبب — ذاكرة isAdmin() القديمة غير صالحة

            if (event === 'SIGNED_IN') {
                auditLog(ACTIONS.LOGIN, { email: this.currentUser?.email });
            } else if (event === 'SIGNED_OUT') {
                auditLog(ACTIONS.LOGOUT, {});
            } else if (event === 'PASSWORD_RECOVERY') {
                import('../ui/NewPasswordModal.js').then(({ NewPasswordModal }) => {
                    new NewPasswordModal().open();
                });
            }

            // Notify listeners
            this.listeners.forEach(listener => {
                listener({
                    event,
                    user: this.currentUser,
                    previousUser,
                    isAuthenticated: this.isAuthenticated
                });
            });

            callback({
                event,
                user: this.currentUser,
                isAuthenticated: this.isAuthenticated
            });
        });
    }

    /**
     * إضافة مستمع لتغييرات المصادقة
     */
    onAuthChange(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * عرض شاشة المصادقة
     */
    async showAuthPrompt(onSuccess = () => {}) {
        const { AuthModal } = await import('../ui/AuthModalStub.js');
        const modal = new AuthModal('authModalContainer', {
            onSuccess: async () => {
                try {
                    const { user } = await getAuthUser();
                    this.currentUser = user || this.currentUser;
                } catch (_) {}
                this.isAuthenticated = true;
                onSuccess({ user: this.currentUser, isAuthenticated: true });
            },
            // إغلاق النافذة بلا تسجيل = تخطٍّ (نفس دلالة onSkip سابقاً)
            onClose: () => {
                console.log('[AuthGuard] User dismissed auth (skipped)');
                onSuccess({ user: null, isAuthenticated: false, skipped: true });
            }
        });
        modal.open();
    }

    /**
     * التحقق من المصادقة
     */
    async checkAuth() {
        if (!this.isConfigured) {
            return { authenticated: false, user: null, configured: false };
        }

        const { user, ok } = await getAuthUser();
        this.currentUser = user;
        this.isAuthenticated = ok && !!user;

        return {
            authenticated: this.isAuthenticated,
            user: this.currentUser,
            configured: this.isConfigured
        };
    }

    /**
     * الحصول على المستخدم الحالي
     */
    getUser() {
        return this.currentUser;
    }

    /**
     * هل المستخدم مسجل دخوله؟
     */
    isLoggedIn() {
        return this.isAuthenticated;
    }

    /**
     * حماية مسار أو إجراء
     * @param {Function} action - الإجراء المحمي
     * @param {Object} options
     */
    async protect(action, options = {}) {
        const { showPrompt = true, message = 'هذا الإجراء يتطلب تسجيل الدخول' } = options;

        if (this.isAuthenticated) {
            return action(this.currentUser);
        }

        if (showPrompt) {
            return new Promise((resolve) => {
                this.showAuthPrompt(({ user, isAuthenticated, skipped }) => {
                    if (isAuthenticated && user) {
                        resolve(action(user));
                    } else if (skipped) {
                        resolve(null);
                    } else {
                        resolve(null);
                    }
                });
            });
        }

        return null;
    }

    /**
     * التحقق من الصلاحيات
     * @param {string} permission - الصلاحية المطلوبة
     */
    hasPermission(permission) {
        if (!this.currentUser) return false;

        // الطبقة من app_metadata (يضبطها الخادم فقط) لا user_metadata (يعدّلها المستخدم)
        const tier = this.getSubscriptionTier();

        const permissions = {
            free: ['create_project', 'export_pdf', 'save_local'],
            pro: ['create_project', 'export_pdf', 'export_excel', 'export_word', 'save_cloud', 'ai_features'],
            enterprise: ['create_project', 'export_pdf', 'export_excel', 'export_word', 'save_cloud', 'ai_features', 'team_share', 'api_access']
        };

        return permissions[tier]?.includes(permission) || false;
    }

    /**
     * الحصول على tier الاشتراك.
     * أمني: نقرأه من app_metadata (لا يُكتب إلا من الخادم بمفتاح service_role) وليس من
     * user_metadata (يستطيع المستخدم تعديله بنفسه عبر supabase.auth.updateUser فيرقّي
     * نفسه لـ enterprise). الافتراضي 'free' = رفض بالافتراض. هذه الطبقة للعرض فقط —
     * الفرض الحقيقي عبر سياسات RLS على الخادم (انظر supabase/policies.sql).
     */
    getSubscriptionTier() {
        return this.currentUser?.app_metadata?.subscription_tier || 'free';
    }

    /**
     * هل المستخدم الحالي مراجع نشط (جدول reviewers)؟ بخلاف getSubscriptionTier
     * هذه ليست مضمَّنة في JWT، فتحتاج استعلاماً فعلياً — تُخزَّن النتيجة مؤقتاً
     * لهوية المستخدم الحالية فقط وتُبطَل تلقائياً عند أي SIGNED_IN/SIGNED_OUT
     * (انظر subscribeToAuthChanges أعلاه) لتفادي استعلام متكرر عند كل نداء.
     */
    async isReviewer() {
        if (!this.currentUser) return false;

        if (this._reviewerCache && this._reviewerCache.userId === this.currentUser.id) {
            return this._reviewerCache.value;
        }

        const { supabase } = await getSupabaseClient();
        if (!supabase) return false;

        const { data, error } = await supabase
            .from('reviewers')
            .select('active')
            .eq('id', this.currentUser.id)
            .maybeSingle();

        const value = !error && !!data?.active;
        this._reviewerCache = { userId: this.currentUser.id, value };
        return value;
    }

    /**
     * هل المستخدم الحالي أدمن (جدول admins)؟ نفس مبدأ isReviewer() تماماً —
     * استعلام فعلي مخزَّن مؤقتاً لهوية المستخدم الحالية، يُبطَل تلقائياً
     * عند أي تغيّر بحالة المصادقة (انظر subscribeToAuthChanges أعلاه).
     */
    async isAdmin() {
        if (!this.currentUser) return false;

        if (this._adminCache && this._adminCache.userId === this.currentUser.id) {
            return this._adminCache.value;
        }

        const { supabase } = await getSupabaseClient();
        if (!supabase) return false;

        const { data, error } = await supabase
            .from('admins')
            .select('id')
            .eq('id', this.currentUser.id)
            .maybeSingle();

        const value = !error && !!data;
        this._adminCache = { userId: this.currentUser.id, value };
        return value;
    }

    /**
     * التحقق من حد المشاريع
     */
    async canCreateProject() {
        if (!this.isAuthenticated) {
            // Guest users can create unlimited local projects
            return { allowed: true, reason: 'local' };
        }

        const tier = this.getSubscriptionTier();
        const limits = {
            free: 3,
            pro: 50,
            enterprise: Infinity
        };

        const limit = limits[tier] || 3;

        // Get current project count
        const { supabase } = await getSupabaseClient();
        if (!supabase) return { allowed: true, reason: 'offline' };

        const { count, error } = await supabase
            .from('studies')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', this.currentUser.id);

        if (error) {
            console.error('[AuthGuard] Error checking project count:', error);
            return { allowed: true, reason: 'error' };
        }

        if (count >= limit) {
            return {
                allowed: false,
                reason: 'limit_reached',
                current: count,
                limit,
                tier
            };
        }

        return { allowed: true, current: count, limit, tier };
    }
}

// Singleton instance
export const AuthGuard = new AuthGuardClass();

/**
 * HOC للتحقق من المصادقة قبل تنفيذ إجراء
 */
export function requireAuth(action, options = {}) {
    return async (...args) => {
        return AuthGuard.protect(() => action(...args), options);
    };
}

/**
 * التحقق السريع من المصادقة
 */
export async function isAuthenticated() {
    const { authenticated } = await AuthGuard.checkAuth();
    return authenticated;
}

/**
 * الحصول على المستخدم الحالي
 */
export function getCurrentUser() {
    return AuthGuard.getUser();
}
