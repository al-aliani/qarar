/**
 * صفحة التكاملات — عرض حالة كل تكامل وإعداداته
 * يُفتح من "حسابي" أو من الشريط الجانبي
 */

import { getSupabaseClient } from '../../supabaseClient.js';
import { showGoogleSheetsSetup, GSHEETS_CONSENT_TEXT } from '../services/GoogleSheetsService.js';
import { WebhookService, WEBHOOK_EVENTS, WEBHOOK_CONSENT_TEXT } from '../services/WebhookService.js';
import { isCaptchaConfigured } from '../utils/captcha.js';
import { toast } from '../utils/toast.js';
import { AuthGuard } from '../middleware/AuthGuard.js';

const LS_KEYS = {
  supabaseUrl: 'SUPABASE_URL',
  supabaseKey: 'SUPABASE_ANON_KEY',
  gsheets: 'GOOGLE_SHEETS_WEB_APP_URL',
};

export class IntegrationsView {
  constructor(container, options = {}) {
    this.container = container;
    this.onBack = options.onBack || (() => {});
  }

  async render() {
    if (!this.container) return;

    // تدقيق أمني 2026-08-24: تعليمات الإعداد التقني (Supabase/Google OAuth/docs
    // الداخلية) موجَّهة لمطوّر/مسؤول نظام لا لأي مستخدم يفتح "حسابي" ← "التكاملات" —
    // نفس نمط AuthGuard.isAdmin المستخدم في AdminDashboardView.js.render().
    const isAdmin = await AuthGuard.isAdmin();
    if (!isAdmin) {
      await this._renderBasic();
      return;
    }

    const supabaseOk = await this._checkSupabase();
    const gsheetsUrl = (typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEYS.gsheets) : '') || '';
    const gsheetsOk = !!gsheetsUrl.trim();
    const recaptchaOk = isCaptchaConfigured();
    const webhooksList = WebhookService.getWebhooks();

    this.container.innerHTML = `
      <div class="integrations-page" style="max-width: 640px; margin: 0 auto; padding: var(--s-4) 0;">
        <button type="button" id="btnIntegrationsBack" class="btn btn--ghost mb-4" style="display: inline-flex; align-items: center; gap: 8px;">
          ← العودة
        </button>

        <h2 class="text-xl font-bold mb-2" style="border-bottom: 1px solid var(--c-border); padding-bottom: var(--s-2);"><svg class="ic" aria-hidden="true"><use href="#i-link"/></svg> التكاملات</h2>
        <p class="text-sm text-muted mb-6">عرض حالة التكاملات الخارجية وإعداداتها. كلها اختيارية — المنصة تعمل بدونها.</p>

        <!-- Supabase -->
        <div class="card p-4 mb-4">
          <div class="flex items-center justify-between gap-3 mb-2">
            <h3 class="font-bold flex items-center gap-2"><svg class="ic" aria-hidden="true"><use href="#i-save"/></svg> Supabase</h3>
            <span class="badge ${supabaseOk ? 'bg-success' : 'bg-muted'}" style="padding: 4px 10px; border-radius: 999px; font-size: 12px;">${supabaseOk ? 'مفعّل' : 'غير مهيأ'}</span>
          </div>
          <p class="text-sm text-muted mb-2">المصادقة والحفظ السحابي للدراسات. إن لم يُهيَّأ، الحفظ محلي فقط.</p>
          ${!supabaseOk ? '<p class="text-xs text-muted">الإعداد من الشريط الجانبي → تسجيل الدخول → إعداد السحابة، أو راجع <a href="#" id="linkSupabaseDocs" class="text-primary">docs/إعداد_Supabase.md</a></p>' : ''}
        </div>

        <!-- Google (تسجيل الدخول) -->
        <div class="card p-4 mb-4">
          <div class="flex items-center justify-between gap-3 mb-2">
            <h3 class="font-bold flex items-center gap-2"><svg class="ic" aria-hidden="true"><use href="#i-link"/></svg> تسجيل الدخول بـ Google</h3>
            <span class="badge ${supabaseOk ? 'bg-success' : 'bg-muted'}" style="padding: 4px 10px; border-radius: 999px; font-size: 12px;">${supabaseOk ? 'متاح (يُفعّل من لوحة Supabase)' : 'يتطلب Supabase'}</span>
          </div>
          <p class="text-sm text-muted">تفعيل من لوحة Supabase → Authentication → Providers → Google، مع Client ID و Secret من Google Cloud.</p>
        </div>

        <!-- Google Sheets -->
        <div class="card p-4 mb-4">
          <div class="flex items-center justify-between gap-3 mb-2">
            <h3 class="font-bold flex items-center gap-2"><svg class="ic" aria-hidden="true"><use href="#i-table"/></svg> Google Sheets</h3>
            <span class="badge ${gsheetsOk ? 'bg-success' : 'bg-muted'}" style="padding: 4px 10px; border-radius: 999px; font-size: 12px;">${gsheetsOk ? 'مهيأ' : 'غير مهيأ'}</span>
          </div>
          <p class="text-sm text-muted mb-3">تصدير مؤشرات الدراسة إلى جدول Google. يتطلب إنشاء Web App من Google Apps Script.</p>
          <div class="form-group mb-2">
            <label class="block text-xs font-medium mb-1">Web App URL (من Google Apps Script)</label>
            <input type="url" id="inpGSheetsUrl" class="form-input text-sm w-full" placeholder="https://script.google.com/macros/s/.../exec" value="${(gsheetsUrl || '').replace(/"/g, '&quot;')}">
          </div>
          <p class="text-xs text-muted mb-3" style="background: var(--c-bg-app); border-radius: 6px; padding: 8px;"><svg class="ic" aria-hidden="true"><use href="#i-warning"/></svg> ${GSHEETS_CONSENT_TEXT}</p>
          <div class="flex gap-2">
            <button type="button" id="btnSaveGSheets" class="btn btn--primary text-sm">حفظ</button>
            <button type="button" id="btnOpenGSheetsHelp" class="btn btn--ghost text-sm">كيف أعدّ Google Sheets؟</button>
          </div>
        </div>

        <!-- reCAPTCHA -->
        <div class="card p-4 mb-4">
          <div class="flex items-center justify-between gap-3 mb-2">
            <h3 class="font-bold flex items-center gap-2"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg> reCAPTCHA v3</h3>
            <span class="badge ${recaptchaOk ? 'bg-success' : 'bg-muted'}" style="padding: 4px 10px; border-radius: 999px; font-size: 12px;">${recaptchaOk ? 'مهيأ' : 'غير مهيأ'}</span>
          </div>
          <p class="text-sm text-muted">حماية نموذج الدخول من البوتات (اختياري). يُضبط Site Key وقت بناء المنصة عبر متغيّر البيئة <code>VITE_RECAPTCHA_SITE_KEY</code> — إعداد مركزي لكل المستخدمين، ليس من هذه الصفحة.</p>
        </div>

        <!-- تكامل محاسبة (QuickBooks / Xero) — LivePlan -->
        <div class="card p-4 mb-4 opacity-90">
          <div class="flex items-center justify-between gap-3 mb-2">
            <h3 class="font-bold flex items-center gap-2"><svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg> QuickBooks / Xero</h3>
            <span class="badge bg-muted" style="padding: 4px 10px; border-radius: 999px; font-size: 12px;">قريباً</span>
          </div>
          <p class="text-sm text-muted">تصدير المؤشرات المالية أو البيانات إلى QuickBooks أو Xero. يتطلب تكامل طرف ثالث (API).</p>
        </div>

        <!-- إرسال بالبريد -->
        <div class="card p-4 mb-4 opacity-80">
          <div class="flex items-center justify-between gap-3 mb-2">
            <h3 class="font-bold flex items-center gap-2"><svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg> إرسال التقرير بالبريد</h3>
            <span class="badge bg-muted" style="padding: 4px 10px; border-radius: 999px; font-size: 12px;">قريباً</span>
          </div>
          <p class="text-sm text-muted">إرسال ملخص الدراسة أو التقرير بالبريد (مثلاً عبر EmailJS). راجع docs/INTEGRATION_FEATURES.md عند التنفيذ.</p>
        </div>

        <!-- Zapier Webhook (مفعّل) -->
        <div class="card p-4 mb-4">
          <div class="flex items-center justify-between gap-3 mb-2">
            <h3 class="font-bold flex items-center gap-2"><svg class="ic" aria-hidden="true"><use href="#i-link"/></svg> Zapier Webhook</h3>
            <span class="badge ${webhooksList.length > 0 ? 'bg-success' : 'bg-muted'}" style="padding: 4px 10px; border-radius: 999px; font-size: 12px;">${webhooksList.length > 0 ? 'مفعّل' : 'غير مهيأ'}</span>
          </div>
          <p class="text-sm text-muted mb-3">ربط المنصة بـ Zapier أو Slack أو أي خدمة تقبل Webhook. الأحداث: دراسة جديدة، حفظ، تصدير تقرير، قرار GO/NO-GO.</p>
          <div class="form-group mb-2">
            <label class="block text-xs font-medium mb-1">رابط Webhook (Zapier / Slack Incoming / إلخ)</label>
            <input type="url" id="inpWebhookUrl" class="form-input text-sm w-full" placeholder="https://hooks.zapier.com/... أو https://hooks.slack.com/...">
          </div>
          <p class="text-xs text-muted mb-3" style="background: var(--c-bg-app); border-radius: 6px; padding: 8px;"><svg class="ic" aria-hidden="true"><use href="#i-warning"/></svg> ${WEBHOOK_CONSENT_TEXT}</p>
          <button type="button" id="btnAddWebhook" class="btn btn--primary text-sm mb-4">إضافة</button>
          <div id="webhooksListContainer" class="space-y-2">
            ${webhooksList.length === 0 ? '<p class="text-xs text-muted">لا توجد روابط. أضف رابطاً ثم استخدمه في Zapier أو Slack.</p>' : webhooksList.map(wh => `
              <div class="flex items-center justify-between gap-2 p-2 rounded" style="background: var(--c-bg-app);">
                <span class="text-xs truncate flex-1" title="${(wh.url || '').replace(/"/g, '&quot;')}">${(wh.url || '').replace(/</g, '&lt;')}</span>
                <button type="button" class="btn-webhook-test btn-xs btn--ghost text-sm" data-url="${(wh.url || '').replace(/"/g, '&quot;')}" title="إرسال اختبار">اختبار</button>
                <button type="button" class="btn-webhook-remove btn-xs btn--ghost text-danger text-sm" data-url="${(wh.url || '').replace(/"/g, '&quot;')}">حذف</button>
              </div>
            `).join('')}
          </div>
          <p class="text-xs text-muted mt-3">الأحداث المُرسلة: study.created، study.saved، report.exported، decision.go، decision.nogo — إلى الرابط الذي أضفته أنت أعلاه (نقطة نهاية مُهيَّأة من قِبلك أنت وحدك).</p>
        </div>

        <h3 class="text-sm font-bold mt-6 mb-3" style="color: var(--c-text-muted); display: flex; align-items: center; gap: 8px;"><span class="inline-block w-2 h-2 rounded-full bg-orange-500"></span> أولوية متوسطة (مخطط)</h3>
        <div class="space-y-3">
          <div class="card p-3 opacity-75">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">Slack Notifications</span>
              <span class="badge bg-muted" style="padding: 2px 8px; border-radius: 999px; font-size: 11px;">مخطط</span>
            </div>
            <p class="text-xs text-muted mt-1">إشعارات في قناة Slack عند إكمال دراسة أو تصدير تقرير أو قرار استثماري.</p>
          </div>
          <div class="card p-3 opacity-75">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">Email Automation</span>
              <span class="badge bg-muted" style="padding: 2px 8px; border-radius: 999px; font-size: 11px;">مخطط</span>
            </div>
            <p class="text-xs text-muted mt-1">أتمتة إرسال التقارير أو التذكيرات بالبريد (EmailJS / Resend / Supabase Edge).</p>
          </div>
          <div class="card p-3 opacity-75">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">Analytics (Mixpanel)</span>
              <span class="badge bg-muted" style="padding: 2px 8px; border-radius: 999px; font-size: 11px;">مخطط</span>
            </div>
            <p class="text-xs text-muted mt-1">تتبع الأحداث والسلوك (تسجيل، إنشاء دراسة، تصدير، قرار) مع موافقة المستخدم.</p>
          </div>
          <div class="card p-3 opacity-75">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">QuickBooks</span>
              <span class="badge bg-muted" style="padding: 2px 8px; border-radius: 999px; font-size: 11px;">مخطط</span>
            </div>
            <p class="text-xs text-muted mt-1">ربط البيانات المالية أو التصدير مع QuickBooks (يتطلب OAuth وواجهة برمجية).</p>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  /**
   * عرض مبسّط لمستخدم غير أدمن: أسماء التكاملات المتاحة وحالتها فقط
   * (مفعّل/غير مفعّل) — بلا تعليمات إعداد تقنية أو روابط docs/ داخلية أو حقول
   * إدخال مفاتيح. راجع تعليق الأمن أعلى render().
   */
  async _renderBasic() {
    const supabaseOk = await this._checkSupabase();
    const gsheetsUrl = (typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEYS.gsheets) : '') || '';
    const gsheetsOk = !!gsheetsUrl.trim();
    const recaptchaOk = isCaptchaConfigured();
    const webhooksOk = WebhookService.getWebhooks().length > 0;

    const items = [
      { name: 'Supabase', ok: supabaseOk },
      { name: 'تسجيل الدخول بـ Google', ok: supabaseOk },
      { name: 'Google Sheets', ok: gsheetsOk },
      { name: 'reCAPTCHA v3', ok: recaptchaOk },
      { name: 'Zapier Webhook', ok: webhooksOk },
    ];

    this.container.innerHTML = `
      <div class="integrations-page" style="max-width: 640px; margin: 0 auto; padding: var(--s-4) 0;">
        <button type="button" id="btnIntegrationsBack" class="btn btn--ghost mb-4" style="display: inline-flex; align-items: center; gap: 8px;">
          ← العودة
        </button>

        <h2 class="text-xl font-bold mb-2" style="border-bottom: 1px solid var(--c-border); padding-bottom: var(--s-2);"><svg class="ic" aria-hidden="true"><use href="#i-link"/></svg> التكاملات</h2>
        <p class="text-sm text-muted mb-6">حالة التكاملات الخارجية. كلها اختيارية — المنصة تعمل بدونها.</p>

        <div class="card p-4">
          ${items.map(item => `
            <div class="flex items-center justify-between gap-2 p-2 rounded mb-2" style="background: var(--c-bg-app);">
              <span class="text-sm font-medium">${item.name}</span>
              <span class="badge ${item.ok ? 'bg-success' : 'bg-muted'}" style="padding: 4px 10px; border-radius: 999px; font-size: 12px;">${item.ok ? 'مفعّل' : 'غير مفعّل'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.container.querySelector('#btnIntegrationsBack')?.addEventListener('click', () => this.onBack());
  }

  async _checkSupabase() {
    try {
      const { ok } = await getSupabaseClient();
      return !!ok;
    } catch {
      return false;
    }
  }

  _bindEvents() {
    this.container.querySelector('#btnIntegrationsBack')?.addEventListener('click', () => this.onBack());

    this.container.querySelector('#linkSupabaseDocs')?.addEventListener('click', (e) => {
      e.preventDefault();
      toast.info('راجع ملف إعداد_Supabase.md في مجلد docs');
    });

    this.container.querySelector('#btnSaveGSheets')?.addEventListener('click', async () => {
      const url = this.container.querySelector('#inpGSheetsUrl')?.value?.trim() || '';
      if (url) {
        localStorage.setItem(LS_KEYS.gsheets, url);
        toast.success('تم حفظ إعدادات Google Sheets');
      } else {
        localStorage.removeItem(LS_KEYS.gsheets);
        toast.info('تم إزالة رابط Google Sheets');
      }
      await this.render();
    });

    this.container.querySelector('#btnOpenGSheetsHelp')?.addEventListener('click', () => {
      showGoogleSheetsSetup();
    });

    this.container.querySelector('#btnAddWebhook')?.addEventListener('click', async () => {
      const url = this.container.querySelector('#inpWebhookUrl')?.value?.trim() || '';
      if (!url.startsWith('https://')) {
        toast.error('أدخل رابطاً يبدأ بـ https://');
        return;
      }
      if (WebhookService.registerWebhook(url, [])) {
        toast.success('تم إضافة Webhook');
        this.container.querySelector('#inpWebhookUrl').value = '';
        await this.render();
      } else {
        toast.warning('الرابط مضاف مسبقاً');
      }
    });

    this.container.querySelectorAll('.btn-webhook-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.dataset.url || '';
        if (!url) return;
        WebhookService.removeWebhook(url);
        toast.success('تم حذف Webhook');
        await this.render();
      });
    });

    this.container.querySelectorAll('.btn-webhook-test').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.dataset.url || '';
        if (!url) return;
        btn.disabled = true;
        btn.textContent = '...';
        const result = await WebhookService.sendTest(url);
        btn.disabled = false;
        btn.textContent = 'اختبار';
        if (result.success) {
          toast.success('تم إرسال الاختبار بنجاح');
        } else {
          toast.error('فشل الاختبار: ' + (result.error || ''));
        }
      });
    });
  }
}
