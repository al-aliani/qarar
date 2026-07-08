/**
 * Toast Notification System
 * Simple, lightweight toast notifications without external dependencies
 *
 * إمكانية الوصول: الحاوية aria-live، والأخطاء role="alert" لتُقرأ فوراً.
 * أمان: الرسالة تُحقن عبر textContent (لا innerHTML) لمنع حقن HTML/XSS من رسائل الخادم.
 * CSP: زر الإغلاق يستخدم مستمعاً فعلياً بدل onclick المضمّن المحظور بواسطة script-src 'self'.
 */

class Toast {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // بيئة بلا DOM (اختبارات Node/SSR) — لا تفعل شيئاً كي لا يفشل الاستيراد
        if (typeof document === 'undefined') return;
        // Create container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            // تُعلَن التنبيهات لقارئات الشاشة فور إضافتها
            this.container.setAttribute('aria-live', 'polite');
            this.container.setAttribute('aria-atomic', 'false');
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    show(message, type = 'info', duration = 5000) {
        // بيئة بلا DOM (اختبارات Node/SSR) — تجاهل بأمان
        if (typeof document === 'undefined' || !this.container) return null;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        // الأخطاء والتحذيرات تُقرأ فوراً (assertive)، والباقي بأدب (polite)
        toast.setAttribute('role', (type === 'error' || type === 'warning') ? 'alert' : 'status');

        // Icon based on type
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ',
            magic: '🪄'
        };

        // بناء العناصر يدوياً (بلا innerHTML) — يهرب المحتوى تلقائياً ويمنع XSS
        const iconEl = document.createElement('span');
        iconEl.className = 'toast-icon';
        iconEl.setAttribute('aria-hidden', 'true');
        iconEl.textContent = icons[type] || icons.info;

        const msgEl = document.createElement('span');
        msgEl.className = 'toast-message';
        msgEl.textContent = message == null ? '' : String(message);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'إغلاق التنبيه');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => this.dismiss(toast));

        toast.append(iconEl, msgEl, closeBtn);
        this.container.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('toast-show'), 10);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.dismiss(toast), duration);
        }

        return toast;
    }

    dismiss(toast) {
        if (!toast || !toast.isConnected) return;
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// Create singleton instance
export const toast = new Toast();
