/**
 * exportTracking — رفع نسخة من كل تصدير حقيقي (Word/Excel/PPTX) إلى Supabase
 * Storage (bucket 'exports') + سجل في export_history، لتغذية مركز التنزيلات
 * (DownloadsCenterView.js، مسار #/downloads).
 *
 * مبدأ صارم: التنزيل المحلي (الذي استدعى هذه الدالة بعده) يجب ألا يتأثر إطلاقاً
 * — لا يُنتظَر هذا النداء (fire-and-forget)، وأي فشل شبكي/مصادقة يُبتلَع صامتاً.
 * زائر غير مسجّل دخول أو Supabase غير مُهيّأ = لا شيء يحدث، بلا خطأ ظاهر.
 *
 * ملاحظة نطاق: تصدير PDF في هذا المشروع لا يُنتج Blob إطلاقاً — يعتمد على
 * window.print() (انظر web/export/pdfGenerator.js) فيختاره المستخدم يدوياً من
 * نافذة الطباعة نفسها؛ التطبيق لا يرى الملف الناتج فلا يمكن رفعه هنا. تصدير
 * PDF عمداً غير مُغطّى بمركز التنزيلات لهذا السبب المعماري، لا سهواً.
 */
import { getSupabaseClient, getAuthUser } from '../supabaseClient.js';

/**
 * @param {Blob} blob
 * @param {{fileType: 'word'|'excel'|'pptx', fileName: string, studyId?: string, studyName?: string}} meta
 */
export function trackExport(blob, meta) {
    if (!meta?.fileType || !meta?.fileName) return;
    (async () => {
        try {
            const { supabase, ok } = await getSupabaseClient();
            if (!ok || !supabase) return;

            const { user } = await getAuthUser();
            if (!user) return;

            let storagePath = null;
            
            if (blob) {
                const ext = meta.fileName.split('.').pop() || meta.fileType;
                storagePath = `${user.id}/${Date.now()}_${meta.fileName}`.replace(/[^\w./؀-ۿ-]/g, '_');

                const { error: uploadError } = await supabase.storage
                    .from('exports')
                    .upload(storagePath, blob, { contentType: blob.type || undefined });
                if (uploadError) {
                    console.warn('[exportTracking] فشل رفع نسخة التصدير (التنزيل المحلي غير متأثر):', uploadError.message);
                    return;
                }
            }

            await supabase.from('export_history').insert({
                user_id: user.id,
                study_id: meta.studyId || null,
                study_name: meta.studyName || null,
                file_type: meta.fileType,
                storage_path: storagePath,
            });
        } catch (e) {
            console.warn('[exportTracking] تعذّر تسجيل التصدير في مركز التنزيلات:', e?.message || e);
        }
    })();
}
