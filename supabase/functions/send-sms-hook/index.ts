/**
 * Edge Function: send-sms-hook — تسليم رمز الدخول عبر واتساب (تدقيق 2026-07-17).
 *
 * الخلل الذي تُصلحه: PhoneAuthModal كان ينادي signInWithOtp بـ channel:'whatsapp'،
 * وقناة واتساب في Supabase مدعومة **فقط** عبر مزوّد Twilio/Twilio Verify بمرسِل
 * واتساب معتمد — فبلا مزوّد كان كل إرسال يفشل لكل مستخدم. أي أن الباب الأمامي
 * كان معطّلاً بالكامل.
 *
 * الحل: Supabase Send SMS Hook. عند تفعيله يتجاوز اشتراط المزوّد بالكامل
 * (IsValidMessageChannel في GoTrue يمرّ فوراً إن كان الـhook مفعّلاً)، ويبقى
 * Supabase هو من:
 *   - يولّد الرمز ويخزّنه ويضبط صلاحيته ومحاولاته وحدّ معدّله،
 *   - **ويصدر جلسة دخول حقيقية** عند verifyOtp({type:'sms'}).
 * دورنا هنا التسليم فقط. هذا يجعل مسار whatsapp-otp-send/verify اليدوي (الذي لا
 * ينشئ جلسة أصلاً، انظر whatsapp-otp-verify/index.ts:35-37) غير لازم للدخول.
 *
 * وضع التشغيل مشتقّ من وجود السرّ لا من راية منفصلة — إضافة WHATSAPP_ACCESS_TOKEN
 * عبر `supabase secrets set` تنقله للإرسال الحقيقي بلا أي تعديل كود:
 *   - وضع whatsapp: WHATSAPP_ACCESS_TOKEN مضبوط → إرسال فعلي عبر Meta Cloud API.
 *   - وضع log: غير مضبوط → يسجّل الرمز في سجلّ الدالة، للاختبار قبل وصول اعتمادات
 *     Meta. محروس بـ ALLOW_LOG_OTP=true وجوباً، لأن أي شخص يملك صلاحية قراءة
 *     السجلات يستطيع الدخول بأي حساب في هذا الوضع.
 *
 * الإعداد المطلوب من المالك (لوحة تحكم Supabase — لا يمكن فعله من الكود):
 *   1. Authentication → Providers → Phone → Enable.
 *   2. Authentication → Hooks → Send SMS → أشر إلى هذه الدالة، وانسخ السرّ.
 *   3. supabase secrets set SEND_SMS_HOOK_SECRET='v1,whsec_...'
 *   4. للتشغيل الحقيقي: supabase secrets set WHATSAPP_ACCESS_TOKEN=... \
 *        WHATSAPP_PHONE_NUMBER_ID=... WHATSAPP_TEMPLATE_NAME=... WHATSAPP_TEMPLATE_LANG=ar
 *   5. للاختبار بلا واتساب إطلاقاً: Authentication → Phone → Test phone numbers
 *      (مثال: +966500000001 → 123456) — يتجاوز GoTrue الـhook كلياً.
 */
import { sendWhatsAppOtpTemplate } from '../_shared/providers/whatsapp.ts';
import { verifyStandardWebhookSignature } from '../_shared/webhookVerify.ts';

/** مهلة نداء Meta: الـhook يحجب مسار الدخول، فالتعليق عليه يعني تعليق تسجيل الدخول. */
const WHATSAPP_TIMEOUT_MS = 4000;

interface SendSmsHookPayload {
  user?: { id?: string; phone?: string };
  sms?: { otp?: string };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const rawBody = await req.text();

  const verification = await verifyStandardWebhookSignature(
    Deno.env.get('SEND_SMS_HOOK_SECRET') || '',
    {
      id: req.headers.get('webhook-id'),
      timestamp: req.headers.get('webhook-timestamp'),
      signature: req.headers.get('webhook-signature'),
    },
    rawBody
  );
  if (!verification.ok) {
    console.error('[send-sms-hook] signature verification failed:', verification.reason);
    return jsonResponse({ error: 'invalid_signature' }, 401);
  }

  let payload: SendSmsHookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'invalid_json_body' }, 400);
  }

  const otp = payload.sms?.otp;
  const phone = payload.user?.phone;
  if (!otp) return jsonResponse({ error: 'missing_otp' }, 400);
  if (!phone) return jsonResponse({ error: 'missing_phone' }, 400);

  // auth.users.phone يصل أرقاماً فقط بلا '+'، وsendWhatsAppOtpTemplate يتوقّع E.164
  // بعلامة '+' (يزيلها داخلياً). نوحّدها هنا بدل الافتراض.
  const toE164Phone = phone.startsWith('+') ? phone : `+${phone}`;

  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

  if (!accessToken) {
    if (Deno.env.get('ALLOW_LOG_OTP') !== 'true') {
      console.error(
        '[send-sms-hook] WHATSAPP_ACCESS_TOKEN غير مضبوط ووضع السجلّ غير مسموح — رفض الإرسال.'
      );
      return jsonResponse({ error: 'delivery_not_configured' }, 500);
    }
    console.warn(`[send-sms-hook] وضع الاختبار (ALLOW_LOG_OTP) — رمز ${toE164Phone}: ${otp}`);
    return new Response(null, { status: 200 });
  }

  try {
    await Promise.race([
      sendWhatsAppOtpTemplate(accessToken, Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!, {
        toE164Phone,
        code: otp,
        templateName: Deno.env.get('WHATSAPP_TEMPLATE_NAME')!,
        templateLang: Deno.env.get('WHATSAPP_TEMPLATE_LANG')!,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('whatsapp_send_timeout')), WHATSAPP_TIMEOUT_MS)
      ),
    ]);
  } catch (e) {
    // لا نُدرج الرمز في السجلّ هنا — رسالة الخطأ تُقرأ من سجلّات الدالة.
    console.error('[send-sms-hook] WhatsApp delivery failed:', e);
    return jsonResponse({ error: 'delivery_failed' }, 502);
  }

  // Supabase يعتبر أي 200 بجسم فارغ نجاحاً.
  return new Response(null, { status: 200 });
});
