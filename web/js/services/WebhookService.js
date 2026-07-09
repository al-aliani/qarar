/**
 * Webhook Service
 * إرسال أحداث إلى Zapier وخدمات خارجية (Slack، إلخ)
 * الأحداث: study.created, study.saved, report.exported, decision.go, decision.nogo
 */

const STORAGE_KEY = 'feasibility_webhooks';

export const WEBHOOK_EVENTS = [
  'study.created',
  'study.saved',
  'report.exported',
  'decision.go',
  'decision.nogo',
];

/**
 * تدقيق أمني/إفصاح (دفعة 6): نص الموافقة/الإفصاح المعروض في واجهة التفعيل
 * (IntegrationsView) لحظة إضافة الرابط — يوضّح أن الرابط نقطة نهاية اختارها
 * المستخدم بنفسه، وأن بيانات دراسته الفعلية سترسل إليها تلقائياً عند وقوع الأحداث.
 */
export const WEBHOOK_CONSENT_TEXT =
  'عند الإضافة، سيتم إرسال بيانات دراستك (اسم المشروع، المؤشرات المالية، القرار الاستثماري) تلقائياً ' +
  'إلى هذا الرابط الذي أدخلته أنت بنفسه — أي نقطة نهاية تتحكم بها أنت وحدك ونحن لا نطّلع على ما يصلها — ' +
  'عند وقوع أي من الأحداث التالية: study.created، study.saved، report.exported، decision.go، decision.nogo. ' +
  'تأكد أنه رابط تثق به قبل الحفظ.';

function loadFromStorage() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(webhooks) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(webhooks));
    }
  } catch (e) {
    console.warn('[Webhook] saveToStorage failed:', e);
  }
}

export class WebhookService {
  /**
   * @returns {Array<{ url: string, events: string[] }>}
   */
  static getWebhooks() {
    return loadFromStorage();
  }

  /**
   * تسجيل webhook جديد (جميع الأحداث إن لم تُحدد)
   * @param {string} url - رابط Webhook (Zapier، Slack Incoming، إلخ)
   * @param {string[]} [events] - قائمة الأحداث أو [] لجميع الأحداث
   */
  static registerWebhook(url, events = []) {
    const u = (url || '').trim();
    if (!u || !u.startsWith('https://')) return false;
    const list = loadFromStorage();
    if (list.some(wh => wh.url === u)) return false;
    list.push({ url: u, events: Array.isArray(events) ? events : [] });
    saveToStorage(list);
    return true;
  }

  /**
   * إزالة webhook بالرابط
   */
  static removeWebhook(url) {
    const list = loadFromStorage().filter(wh => wh.url !== url);
    saveToStorage(list);
  }

  /**
   * إرسال حدث لجميع الـ webhooks المسجّلة (التي تشمل هذا الحدث أو تستقبل الكل)
   * @param {string} eventName - اسم الحدث
   * @param {object} [eventData] - بيانات إضافية
   */
  static async triggerEvent(eventName, eventData = {}) {
    const list = loadFromStorage();
    const relevant = list.filter(wh =>
      wh.events.length === 0 || wh.events.includes(eventName)
    );
    if (relevant.length === 0) return;
    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      source: 'feasibility-platform',
      data: eventData,
    };
    const results = await Promise.allSettled(
      relevant.map(wh => this.sendWebhook(wh.url, eventName, payload))
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn('[Webhook] Failed:', relevant[i].url, r.reason);
      }
    });
  }

  /**
   * إرسال HTTP POST إلى webhook
   * @param {string} url
   * @param {string} eventName
   * @param {object} payload
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  static async sendWebhook(url, eventName, payload) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: (e && e.message) || String(e) };
    }
  }

  /**
   * اختبار إرسال (حدث تجريبي)
   */
  static async sendTest(url) {
    return this.sendWebhook(url, 'test', {
      event: 'test',
      timestamp: new Date().toISOString(),
      message: 'اختبار من منصة دراسة الجدوى',
    });
  }
}
