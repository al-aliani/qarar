/**
 * سجل الأنشطة — يقرأ من auditLogger.js (getAuditLog/ACTIONS)، نفس السجل المحلي
 * الحي المستخدَم فعلياً في AuthGuard.js وAuthModalStub.js وExportMenu.js
 * وPersistenceService.js وUserProfileView.js، ونفس خريطة التسميات العربية
 * (ACTIVITY_LABEL) التي يعرضها DashboardView.js في بطاقة "نشاطك الأخير".
 *
 * كانت هذه الشاشة سابقاً بيانات وهمية بالكامل: عناوين IP مصطنعة، وأنشطة
 * منسوبة لأشخاص آخرين ("سارة أحمد"، "محمد الخالد") لا وجود لها في سجل محلي
 * أحادي الجهاز. حُذف كل ذلك — هذا السجل مخزّن في localStorage على هذا
 * الجهاز فقط، وليس سجل تدقيق جماعي/خادمي، ونوضّح هذا القيد بالنص أدناه
 * بنفس أسلوب تعليق DashboardView.js.
 */
import { getAuditLog, ACTIONS } from '../utils/auditLogger.js';

const ACTIVITY_LABEL = {
    [ACTIONS.LOGIN]: 'تسجيل دخول', [ACTIONS.SIGNUP]: 'إنشاء حساب', [ACTIONS.LOGOUT]: 'تسجيل خروج',
    [ACTIONS.SAVE]: 'حفظ دراسة', [ACTIONS.LOAD]: 'تحميل دراسة', [ACTIONS.EXPORT]: 'تصدير',
    [ACTIONS.RESET]: 'إعادة تعيين', [ACTIONS.OAUTH]: 'دخول عبر Google',
    [ACTIONS.MFA_ENROLL]: 'تفعيل 2FA', [ACTIONS.MFA_VERIFY]: 'تحقق 2FA',
};

const ACTIVITY_ICON = {
    [ACTIONS.LOGIN]: 'i-shield', [ACTIONS.SIGNUP]: 'i-user', [ACTIONS.LOGOUT]: 'i-shield',
    [ACTIONS.SAVE]: 'i-save', [ACTIONS.LOAD]: 'i-history', [ACTIONS.EXPORT]: 'i-download',
    [ACTIONS.RESET]: 'i-history', [ACTIONS.OAUTH]: 'i-shield',
    [ACTIONS.MFA_ENROLL]: 'i-shield', [ACTIONS.MFA_VERIFY]: 'i-shield',
};

export class ActivityLogView {
    constructor(containerOrId) {
        this.container = typeof containerOrId === 'string'
            ? document.getElementById(containerOrId)
            : containerOrId;
    }

    async render() {
        if (!this.container) return;

        const entries = getAuditLog(50);

        const listHtml = entries.length > 0
            ? `<div class="card" style="padding:8px;">
                ${entries.map(e => {
                    const label = ACTIVITY_LABEL[e.action] || e.action;
                    const iconId = ACTIVITY_ICON[e.action] || 'i-clock';
                    const when = e.ts ? new Date(e.ts).toLocaleString('ar-SA-u-nu-latn') : '';
                    return `
                        <div class="activity-log-row" style="display:flex;gap:12px;align-items:flex-start;padding:12px;border-bottom:1px solid var(--c-border);">
                            <span class="badge" style="align-self:flex-start;white-space:nowrap;"><svg class="ic" aria-hidden="true"><use href="#${iconId}"/></svg></span>
                            <div style="flex:1;min-width:0;">
                                <div class="text-sm font-bold">${label}</div>
                                <div class="text-xs text-muted" style="margin-top:2px;">${when}</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>`
            : `<div class="alert alert--info">لا توجد أنشطة مسجّلة على هذا الجهاز بعد.</div>`;

        this.container.innerHTML = `
            <div class="activity-log-view" style="max-width:720px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnActivityLogBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للملف الشخصي</button>
                <div class="mb-4">
                    <h2 class="section-title" style="margin-bottom:4px;"><svg class="ic" aria-hidden="true"><use href="#i-history"/></svg> سجل الأنشطة</h2>
                    <p class="text-muted" style="margin:0;">عمليات الدخول والحفظ والتصدير المسجّلة على هذا الجهاز فقط — سجل محلي في متصفحك، وليس سجل تدقيق شامل عبر أجهزتك أو فريقك.</p>
                </div>
                ${listHtml}
            </div>
        `;

        this.container.querySelector('#btnActivityLogBack')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showUserProfile'));
        });

        return this.container;
    }
}
