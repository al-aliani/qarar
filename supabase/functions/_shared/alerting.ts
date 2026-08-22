/**
 * تنبيه أخطاء من جهة الخادم (Edge Functions) عبر Sentry — بلا SDK (Deno/الحافة لا
 * تدعم حزمة @sentry/node القياسية بسهولة هنا)، فقط fetch() خام لواجهة Envelope API
 * الموثّقة رسمياً (https://develop.sentry.dev/sdk/data-model/envelopes/) — تحتاج فقط
 * DSN عمومياً (لا سرّاً خاصاً بمعنى API key سرّي)، فبناء الطلب يدوياً آمن ومباشر.
 *
 * يتطلب سرّاً SENTRY_DSN منفصلاً بمشروع Supabase (`supabase secrets set
 * SENTRY_DSN=...`) — يمكن استخدام نفس مشروع Sentry الذي يخدم VITE_SENTRY_DSN
 * بالواجهة (monitoring.js) أو مشروعاً منفصلاً؛ لا علاقة تقنية بينهما هنا، وأحدهما لا
 * يُفعِّل الآخر تلقائياً. بلا هذا السرّ، sendAlert() تسجّل محلياً فقط (console.error)
 * ولا ترمي أبداً تحت أي ظرف — فشل إرسال التنبيه نفسه يجب ألا يُسقط استجابة الـwebhook
 * أو يُخفي الخطأ الأصلي الذي استدعاها.
 */

export interface AlertContext {
  message: string;
  level?: 'warning' | 'error';
  tags?: Record<string, string>;
}

interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
}

export function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, '');
    if (!publicKey || !projectId || !url.host) return null;
    return { publicKey, host: url.host, projectId };
  } catch {
    return null;
  }
}

/** يبني جسم طلب Envelope API خام — مُصدَّرة بمعزل عن fetch() لتسهيل اختبارها. */
export function buildEnvelopeBody(parsed: ParsedDsn, dsn: string, ctx: AlertContext, eventId: string, now: string): string {
  const header = JSON.stringify({ event_id: eventId, sent_at: now, dsn });
  const itemHeader = JSON.stringify({ type: 'event' });
  const item = JSON.stringify({
    event_id: eventId,
    timestamp: now,
    platform: 'other',
    level: ctx.level || 'error',
    message: { formatted: ctx.message },
    tags: ctx.tags || {},
  });
  return `${header}\n${itemHeader}\n${item}\n`;
}

/**
 * يرسل تنبيهاً واحداً — لا تُنتظِر هذه الدالة لإتمام معالجة الـwebhook (استدعِها
 * بلا await إن كانت زمن الاستجابة حرجاً)، لكنها async لأنها تُسجِّل نتيجة الشبكة
 * فعلياً بدل إطلاقها بصمت. لا ترمي أبداً — كل مسار فشل يُسجَّل ويُرجِع بهدوء.
 */
export async function sendAlert(dsn: string | null | undefined, ctx: AlertContext): Promise<void> {
  const source = ctx.tags?.source || 'edge-function';
  if (!dsn) {
    console.error(`[alerting:${source}] SENTRY_DSN غير مضبوط — التنبيه سُجِّل محلياً فقط: ${ctx.message}`);
    return;
  }
  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.error(`[alerting:${source}] SENTRY_DSN غير صالح — التنبيه سُجِّل محلياً فقط: ${ctx.message}`);
    return;
  }
  try {
    const envelopeUrl = `https://${parsed.host}/api/${parsed.projectId}/envelope/`;
    const eventId = crypto.randomUUID().replace(/-/g, '');
    const now = new Date().toISOString();
    const body = buildEnvelopeBody(parsed, dsn, ctx, eventId, now);
    const res = await fetch(envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=qarar-edge-alerting/1.0`,
      },
      body,
    });
    if (!res.ok) {
      console.error(`[alerting:${source}] فشل إرسال التنبيه لـSentry (${res.status}): ${ctx.message}`);
    }
  } catch (e) {
    console.error(`[alerting:${source}] استثناء أثناء إرسال التنبيه لـSentry: ${ctx.message}`, e);
  }
}
