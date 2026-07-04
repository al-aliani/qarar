/**
 * AuthGuard - حارس المصادقة
 * يتحكم في الوصول للتطبيق بناءً على حالة المصادقة
 */

import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';
import { showAuthScreen } from '../ui/AuthScreen.js';

class AuthGuardClass {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.isConfigured = false;
        this.listeners = [];
        this.initialized = false;
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
     */
    async subscribeToAuthChanges(callback) {
        const { supabase } = await getSupabaseClient();
        if (!supabase) return;

        supabase.auth.onAuthStateChange((event, session) => {
            console.log('[AuthGuard] Auth state changed:', event);

            const previousUser = this.currentUser;
            this.currentUser = session?.user || null;
            this.isAuthenticated = !!this.currentUser;

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
    showAuthPrompt(onSuccess = () => {}) {
        showAuthScreen({
            onAuthSuccess: (user) => {
                this.currentUser = user;
                this.isAuthenticated = true;
                onSuccess({ user, isAuthenticated: true });
            },
            onSkip: () => {
                console.log('[AuthGuard] User skipped authentication');
                onSuccess({ user: null, isAuthenticated: false, skipped: true });
            }
        });
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

        // Basic permission check based on subscription tier
        const tier = this.currentUser.user_metadata?.subscription_tier || 'free';

        const permissions = {
            free: ['create_project', 'export_pdf', 'save_local'],
            pro: ['create_project', 'export_pdf', 'export_excel', 'export_word', 'save_cloud', 'ai_features'],
            enterprise: ['create_project', 'export_pdf', 'export_excel', 'export_word', 'save_cloud', 'ai_features', 'team_share', 'api_access']
        };

        return permissions[tier]?.includes(permission) || false;
    }

    /**
     * الحصول على tier الاشتراك
     */
    getSubscriptionTier() {
        return this.currentUser?.user_metadata?.subscription_tier || 'free';
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
