/**
 * Monitoring Service (Error Tracking & Performance)
 * Integrates with Sentry or similar service for production error tracking
 */
import { trackEvent } from './analytics.js';
import { hasAnalyticsConsent, onAnalyticsConsentGranted } from './cookieConsent.js';

class MonitoringService {
    constructor() {
        this.enabled = false;
        this.sentryDsn = null;
        this.environment = 'development';
        this._init();
    }

    _init() {
        // Check if we're in production and Sentry is configured
        const isProduction = window.location.hostname !== 'localhost' && 
                            !window.location.hostname.includes('127.0.0.1');
        
        // Try to load Sentry DSN from environment or config
        // For now, we'll use a placeholder - replace with actual DSN in production
        this.sentryDsn = import.meta.env?.VITE_SENTRY_DSN || null;
        this.environment = isProduction ? 'production' : 'development';

        if (this.sentryDsn && isProduction) {
            // تدقيق كوكيز 2026-08-22: Sentry كان يُحمَّل ويُهيَّأ تلقائياً بلا أي شرط
            // موافقة — الآن لا يُهيَّأ إلا بعد ضغط الزائر "موافق" بإشعار الكوكيز
            // (public/js/cookie-notice.js). إن لم توجد موافقة بعد، تُستخدم المراقبة
            // المحلية (console) مؤقتاً + استماع لحدث الموافقة لتفعيل Sentry فوراً بلا
            // إعادة تحميل الصفحة إن وافق الزائر لاحقاً.
            if (hasAnalyticsConsent()) {
                this._initSentry();
            } else {
                this._initConsoleTracking();
                onAnalyticsConsentGranted(() => this._initSentry());
            }
        } else {
            // بلوكر #43: كانت الحالة الفعلية (بلا DSN بالإنتاج) تُسجَّل بنفس رسالة
            // "✅" المطمئنة اللي تظهر بالتطوير — لا فرق مرئي يلفت نظر أحد. أخطاء
            // الدفع/الحفظ بهذه الحالة تبقى محلية بمتصفح العميل فقط، لا يراها أحد.
            if (isProduction && !this.sentryDsn) {
                console.error('[Monitoring] ⚠️ VITE_SENTRY_DSN غير مضبوط بالإنتاج — الأخطاء (بما فيها فشل الدفع/الحفظ) تبقى محلية بمتصفح العميل فقط ولا تصل لأي مراقبة مركزية.');
            }
            // Fallback: Use console-based error tracking
            this._initConsoleTracking();
        }
    }

    _initSentry() {
        // Dynamic import of Sentry (only in production)
        import('https://browser.sentry-cdn.com/7.0.0/bundle.min.js').then(() => {
            if (typeof Sentry !== 'undefined') {
                Sentry.init({
                    dsn: this.sentryDsn,
                    environment: this.environment,
                    tracesSampleRate: 0.1, // 10% of transactions
                    beforeSend(event, hint) {
                        // Filter out sensitive data
                        if (event.request) {
                            delete event.request.cookies;
                            delete event.request.headers?.Authorization;
                            delete event.request.data;
                            delete event.request.query_string;
                        }
                        return event;
                    },
                    beforeBreadcrumb(breadcrumb, hint) {
                        // Filter out sensitive data from breadcrumb.data
                        if (breadcrumb.data) {
                            const sensitiveKeys = ['email', 'password', 'token', 'phone', 'mobile', 'ssn', 'card', 'secret', 'authorization', 'cookie'];
                            Object.keys(breadcrumb.data).forEach((key) => {
                                if (sensitiveKeys.includes(key.toLowerCase())) {
                                    delete breadcrumb.data[key];
                                }
                            });
                        }
                        return breadcrumb;
                    }
                });
                this.enabled = true;
                console.log('✅ Sentry monitoring enabled');
            }
        }).catch(err => {
            console.warn('Failed to load Sentry, using console tracking:', err);
            this._initConsoleTracking();
        });
    }

    _initConsoleTracking() {
        // قد تُستدعى مرتين (تأخير الموافقة ثم فشل تحميل Sentry لاحقاً) — امنع تكرار
        // ربط مستمعي window فتتضاعف تقارير نفس الخطأ.
        if (this._consoleTrackingInitialized) return;
        this._consoleTrackingInitialized = true;

        // Console-based error tracking for development
        this.enabled = true;

        // Capture unhandled errors
        window.addEventListener('error', (event) => {
            this.captureException(event.error || event.message, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                url: window.location.href
            });
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.captureException(event.reason, {
                type: 'unhandledrejection',
                url: window.location.href
            });
        });

        console.log('✅ Console-based monitoring enabled');
    }

    /**
     * Capture an exception/error
     */
    captureException(error, context = {}) {
        const errorInfo = {
            message: error?.message || String(error),
            stack: error?.stack,
            context: {
                ...context,
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: new Date().toISOString()
            }
        };

        if (typeof Sentry !== 'undefined' && Sentry.captureException) {
            Sentry.captureException(error, { contexts: { custom: context } });
        } else {
            // Console logging with structured format
            console.error('[Monitoring] Exception captured:', errorInfo);
            trackEvent('error', { message: errorInfo.message, ...context });

            // In production, you might want to send to a custom endpoint
            if (this.environment === 'production') {
                this._sendToEndpoint(errorInfo);
            }
        }
    }

    /**
     * Capture a message/info
     */
    captureMessage(message, level = 'info', context = {}) {
        if (typeof Sentry !== 'undefined' && Sentry.captureMessage) {
            Sentry.captureMessage(message, level, { contexts: { custom: context } });
        } else {
            console.log(`[Monitoring] ${level.toUpperCase()}:`, message, context);
        }
    }

    /**
     * Set user context for error tracking
     */
    setUser(user) {
        if (typeof Sentry !== 'undefined' && Sentry.setUser) {
            Sentry.setUser({
                id: user?.id,
                // Don't include sensitive data
            });
        }
    }

    /**
     * Add breadcrumb for debugging
     */
    addBreadcrumb(message, category = 'default', level = 'info', data = {}) {
        if (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) {
            Sentry.addBreadcrumb({
                message,
                category,
                level,
                data
            });
        } else {
            console.debug(`[Breadcrumb] ${category}:`, message, data);
        }
    }

    /**
     * Measure performance
     */
    startTransaction(name, op = 'navigation') {
        if (typeof Sentry !== 'undefined' && Sentry.startTransaction) {
            return Sentry.startTransaction({ name, op });
        }
        return {
            finish: () => {},
            setData: () => {},
            setTag: () => {}
        };
    }

    /**
     * Send error to custom endpoint (fallback)
     */
    _sendToEndpoint(errorInfo) {
        // Only send in production and if endpoint is configured, and only after
        // explicit cookie/analytics consent — this is an external network call.
        if (!hasAnalyticsConsent()) return;
        const endpoint = import.meta.env?.VITE_ERROR_ENDPOINT;
        if (!endpoint) return;

        try {
            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(errorInfo)
            }).catch(() => {
                // Silently fail - don't break the app
            });
        } catch (e) {
            // Silently fail
        }
    }
}

// Export singleton
export const monitoring = new MonitoringService();

// Auto-capture common errors
if (typeof window !== 'undefined') {
    // Capture store errors
    const originalConsoleError = console.error;
    console.error = function(...args) {
        if (args[0]?.includes?.('Store') || args[0]?.includes?.('Failed to')) {
            monitoring.captureException(new Error(args.join(' ')), {
                source: 'console.error',
                args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))
            });
        }
        originalConsoleError.apply(console, args);
    };
}
