/**
 * NotFoundView — تُعرض حين يكون عنوان الرابط (#/...) غير معروف تماماً
 * (لا يطابق أي مسار مسجَّل في routeToView ولا SUBVIEW_ROUTES). سابقاً كانت
 * routeToView تتراجع بصمت للرئيسية بلا أي إشارة للمستخدم أن الرابط خاطئ.
 */
import { escapeHtml } from '../utils/escape.js';

export class NotFoundView {
    constructor(container, { onHome, title, message } = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.onHome = onHome || (() => {});
        this.title = title || 'الصفحة غير موجودة';
        this.message = message || 'الرابط الذي فتحته غير صحيح أو لم يعد متاحاً.';
    }

    async render() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="not-found-view" style="max-width:480px;margin:60px auto;text-align:center;padding:24px;">
                <h2 style="margin-bottom:8px;">${escapeHtml(this.title)}</h2>
                <p class="text-muted">${escapeHtml(this.message)}</p>
                <div class="d-flex justify-center mt-4" style="display:flex;justify-content:center;">
                    <button type="button" id="btnNotFoundHome" class="btn btn--primary">العودة للرئيسية</button>
                </div>
            </div>
        `;
        this.container.querySelector('#btnNotFoundHome')?.addEventListener('click', () => this.onHome());
    }
}
