/**
 * مركز الإشعارات — يقرأ من جدول public.notifications الحقيقي عبر
 * NotificationService.js (نفس الخدمة التي تغذّي جرس DashboardView.js، مصدر واحد
 * لا نسخة موازية). كانت هذه الشاشة سابقاً بيانات وهمية بالكامل مع تبويب
 * "Changelog" لا يوجد له أي مصدر بيانات حقيقي في المشروع — حُذف بدل تركه مصطنعاً.
 */
import { listNotifications, markRead, markAllRead } from '../services/NotificationService.js';
import { escapeHtml } from '../utils/escape.js';

const TYPE_META = {
    payment: { icon: 'i-bank', label: 'دفع' },
    review: { icon: 'i-star', label: 'مراجعة' },
    reminder: { icon: 'i-clock', label: 'تذكير' },
    system: { icon: 'i-info', label: 'النظام' }
};

export class NotificationsView {
    constructor(containerOrId) {
        this.container = typeof containerOrId === 'string'
            ? document.getElementById(containerOrId)
            : containerOrId;
    }

    async render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="notifications-view" style="max-width:720px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnNotifBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>
                <div class="flex-between mb-4">
                    <div>
                        <h2 class="section-title" style="margin-bottom:4px;"><svg class="ic" aria-hidden="true"><use href="#i-info"/></svg> مركز الإشعارات</h2>
                        <p class="text-muted" style="margin:0;">كل التنبيهات المتعلقة بحسابك ودراساتك.</p>
                    </div>
                    <button type="button" id="btnNotifMarkAll" class="btn btn--sm btn--secondary">تعليم الكل كمقروء</button>
                </div>
                <div id="notifList" class="card" style="padding:8px;"></div>
            </div>
        `;

        this.container.querySelector('#btnNotifBack')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });
        this.container.querySelector('#btnNotifMarkAll')?.addEventListener('click', async () => {
            await markAllRead();
            await this.renderList();
        });

        await this.renderList();
        return this.container;
    }

    async renderList() {
        const listEl = this.container.querySelector('#notifList');
        if (!listEl) return;

        listEl.innerHTML = '<p class="text-sm text-muted" style="padding:12px;">جاري التحميل...</p>';
        const items = await listNotifications(50);

        if (items.length === 0) {
            listEl.innerHTML = '<p class="text-sm text-muted" style="padding:12px;">لا توجد إشعارات بعد.</p>';
            return;
        }

        listEl.innerHTML = items.map(n => {
            const meta = TYPE_META[n.type] || TYPE_META.system;
            const unread = !n.read_at;
            return `
                <div class="notif-row" data-id="${escapeHtml(n.id)}" style="display:flex;gap:12px;padding:12px;border-radius:10px;cursor:${unread ? 'pointer' : 'default'};${unread ? 'background:var(--c-p-subtle);' : ''}">
                    <span class="badge" style="align-self:flex-start;white-space:nowrap;"><svg class="ic" aria-hidden="true"><use href="#${meta.icon}"/></svg> ${meta.label}</span>
                    <div style="flex:1;min-width:0;">
                        <div class="text-sm font-bold">${escapeHtml(n.title)}</div>
                        ${n.body ? `<div class="text-xs text-muted">${escapeHtml(n.body)}</div>` : ''}
                        <div class="text-xs text-muted" style="margin-top:4px;">${new Date(n.created_at).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('.notif-row').forEach(row => {
            row.addEventListener('click', async () => {
                const id = row.dataset.id;
                if (!id) return;
                await markRead(id);
                await this.renderList();
            });
        });
    }
}
