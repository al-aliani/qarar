/**
 * مزوّد WhatsApp Business Platform (Cloud API الرسمية من ميتا) — إرسال رسالة
 * قالب معتمد (Authentication template) تحوي رمز تحقق. لا نص حر مسموح —
 * واتساب يفرض قالباً معتمَداً مسبقاً من ميتا لأي رسالة تبدأ محادثة جديدة،
 * بخلاف رد على رسالة عميل (نفس منطق تقليل نطاق التدخّل اليدوي المتّبع في
 * moyasar.ts/tamara.ts، لكن هنا قيد منصّة لا اختيار تصميم).
 *
 * ملاحظة صادقة (بنفس تحفّظ moyasar.ts/tamara.ts): هذا التنفيذ مبنيّ على
 * الصيغة الموثَّقة عاماً لواجهة WhatsApp Cloud API (Bearer token، نقطة
 * /messages، جسم template بمكوّن body/parameters). تحقّق من مطابقتها
 * للتوثيق الحيّ الفعلي (https://developers.facebook.com/docs/whatsapp/cloud-api)
 * عند الربط بحساب WhatsApp Business Platform حقيقي قبل أي استخدام إنتاجي —
 * لا تفترض صحتها 100% بلا اختبار فعلي، خصوصاً شكل مكوّنات القالب (قد يختلف
 * حسب القالب المعتمد فعلياً من ميتا، مثال: بعض قوالب Authentication تتطلب
 * أيضاً مكوّن button لزر "نسخ الرمز" بجانب مكوّن body).
 */

const WHATSAPP_API_BASE = 'https://graph.facebook.com';
const WHATSAPP_API_VERSION = 'v21.0';

export interface WhatsAppOtpParams {
    /** بصيغة E.164 مع علامة + (+9665XXXXXXXX) — تُزال العلامة داخلياً، واتساب يتطلب أرقاماً فقط. */
    toE164Phone: string;
    code: string;
    templateName: string;
    templateLang: string;
}

export async function sendWhatsAppOtpTemplate(
    accessToken: string,
    phoneNumberId: string,
    params: WhatsAppOtpParams
): Promise<void> {
    const toDigitsOnly = params.toE164Phone.replace(/^\+/, '');

    const res = await fetch(`${WHATSAPP_API_BASE}/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toDigitsOnly,
            type: 'template',
            template: {
                name: params.templateName,
                language: { code: params.templateLang },
                components: [
                    {
                        type: 'body',
                        parameters: [{ type: 'text', text: params.code }],
                    },
                ],
            },
        }),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`WhatsApp template send failed (${res.status}): ${errText}`);
    }
}
