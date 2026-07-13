/**
 * AttachmentsService — رفع/سرد/حذف ملفات أدلة الدراسة (فواتير، عروض أسعار، صور موقع...)
 * عبر Supabase Storage (bucket خاص 'attachments'، RLS يقصر الوصول على مالك الملف).
 *
 * يتطلب تسجيل دخول (RLS تعتمد auth.uid()) — المسودات المحلية غير المسجَّلة لا يمكنها
 * رفع مرفقات، فقط الدراسات المرتبطة بحساب. يتطلب أيضاً تنفيذ SQL الترحيل في
 * docs/supabase_setup.sql (قسم 8) مرة واحدة من لوحة Supabase قبل أول استخدام حقيقي.
 */
import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

const BUCKET = 'attachments';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'csv'];

function sanitizeFileName(name) {
    return String(name || 'file')
        .trim()
        .replace(/[^\p{L}\p{N}._-]+/gu, '_')
        .slice(-120) || 'file';
}

function extOf(name) {
    const m = /\.([a-zA-Z0-9]+)$/.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
}

function folderPrefix(userId, studyId) {
    return `${userId}/${studyId}`;
}

/**
 * رفع ملف مرفق لدراسة معيّنة. يتطلب مستخدماً مسجَّل الدخول.
 * @returns {Promise<{ok:boolean, path?:string, name?:string, error?:string}>}
 */
export async function uploadAttachment(studyId, file) {
    if (!studyId) return { ok: false, error: 'لا يوجد معرّف دراسة — احفظ الدراسة أولاً.' };
    if (!file) return { ok: false, error: 'لم يُختر ملف.' };
    if (file.size > MAX_FILE_BYTES) {
        return { ok: false, error: `الملف أكبر من الحد المسموح (10 ميجابايت). حجمه الحالي: ${(file.size / 1024 / 1024).toFixed(1)} ميجابايت.` };
    }
    const ext = extOf(file.name);
    if (!ALLOWED_EXT.includes(ext)) {
        return { ok: false, error: `امتداد الملف غير مدعوم (${ext || 'بلا امتداد'}). المسموح: ${ALLOWED_EXT.join('، ')}.` };
    }

    const { user, ok: authOk } = await getAuthUser();
    if (!authOk || !user) {
        return { ok: false, error: 'رفع المرفقات يتطلب تسجيل الدخول (الدراسة يجب أن تكون محفوظة على حساب، لا مسودة محلية فقط).' };
    }

    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error: error || 'تعذّر الاتصال بخدمة التخزين.' };

    const safeName = sanitizeFileName(file.name);
    const path = `${folderPrefix(user.id, studyId)}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false
    });
    if (uploadError) {
        const msg = String(uploadError.message || uploadError);
        const friendly = /bucket not found/i.test(msg)
            ? 'مساحة التخزين (bucket "attachments") غير مُنشأة بعد على مشروع Supabase — نفّذ SQL الترحيل في docs/supabase_setup.sql (قسم 8) من لوحة Supabase أولاً.'
            : msg;
        return { ok: false, error: friendly };
    }
    return { ok: true, path, name: file.name };
}

/**
 * سرد مرفقات دراسة معيّنة (للمستخدم الحالي فقط — RLS).
 * @returns {Promise<{ok:boolean, files?:Array<{name:string, path:string, size:number, createdAt:string}>, error?:string}>}
 */
export async function listAttachments(studyId) {
    if (!studyId) return { ok: true, files: [] };

    const { user, ok: authOk } = await getAuthUser();
    if (!authOk || !user) return { ok: true, files: [] }; // زائر غير مسجَّل — لا مرفقات، لا خطأ يُعرض

    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };

    const prefix = folderPrefix(user.id, studyId);
    const { data, error: listError } = await supabase.storage.from(BUCKET).list(prefix, {
        sortBy: { column: 'created_at', order: 'desc' }
    });
    if (listError) {
        // Bucket غير موجود بعد = نفس حالة "لا مرفقات" من منظور المستخدم، لا خطأ مزعج.
        if (/bucket not found/i.test(String(listError.message || ''))) return { ok: true, files: [] };
        return { ok: false, error: listError.message };
    }

    const files = (data || [])
        .filter(f => f.name && !f.name.startsWith('.'))
        .map(f => ({
            name: f.name.replace(/^\d+-/, ''), // إزالة بادئة الطابع الزمني للعرض فقط
            path: `${prefix}/${f.name}`,
            size: f.metadata?.size || 0,
            createdAt: f.created_at || ''
        }));
    return { ok: true, files };
}

/** رابط مؤقت (ساعة واحدة) لعرض/تنزيل مرفق من bucket خاص. */
export async function getAttachmentSignedUrl(path) {
    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };
    const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (signError) return { ok: false, error: signError.message };
    return { ok: true, url: data?.signedUrl };
}

export async function deleteAttachment(path) {
    if (!path) return { ok: false, error: 'مسار غير صالح.' };
    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };
    const { error: deleteError } = await supabase.storage.from(BUCKET).remove([path]);
    if (deleteError) return { ok: false, error: deleteError.message };
    return { ok: true };
}

export const ATTACHMENTS_MAX_FILE_BYTES = MAX_FILE_BYTES;
export const ATTACHMENTS_ALLOWED_EXT = ALLOWED_EXT;
