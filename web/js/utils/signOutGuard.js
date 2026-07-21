/**
 * signOutGuard — حماية مشتركة ضد فقدان دراسات محلية غير مُزامَنة عند تسجيل
 * الخروج (بلوكر #30/#31، تدقيق 2026-07-21). signOut() في supabaseClient.js
 * يمسح كل مفاتيح feas_project_* من هذا الجهاز بلا شرط — كان هذا يحدث بصمت من
 * 3 مسارات (زر لوحة التحكم، زر صفحة الحساب، الخروج التلقائي بعد خمول)، وأُصلح
 * الأول فقط (018c027). هذا الملف يوحّد الحماية لبقية المسارات بدل تكرارها.
 */
import { ProjectManager } from '../services/ProjectManager.js';
import { signOut } from '../../supabaseClient.js';

export async function getUnsyncedLocalProjects() {
    try {
        const all = await ProjectManager.getAllProjects();
        return Array.isArray(all) ? all.filter((p) => p.source === 'local') : [];
    } catch (_) {
        return [];
    }
}

/**
 * لمسار مُتابَع (المستخدم حاضر ويضغط زر خروج فعلياً): يحذّر بعدد الدراسات غير
 * المُزامَنة قبل المسح ويسمح بالإلغاء — نفس تجربة زر لوحة التحكم الأصلي.
 * @param {object} Swal - نسخة SweetAlert2 المستوردة لدى المستدعي (لا نستورد
 *   نسخة مستقلة هنا لتفادي حزمة مكررة إن كانت مستوردة أصلاً بذلك الملف).
 * @param {{beforeSignOut?: () => void|Promise<void>}} [options]
 * @returns {Promise<boolean>} true إن أُكِّد الخروج فعلاً
 */
export async function confirmAndSignOut(Swal, { beforeSignOut } = {}) {
    const unsynced = await getUnsyncedLocalProjects();
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: unsynced.length > 0
            ? `لديك ${unsynced.length} دراسة محفوظة على هذا الجهاز فقط ولم تُزامَن مع السحابة — ستُحذف نهائياً عند تسجيل الخروج. صدّر نسخة احتياطية أولاً إن أردت الاحتفاظ بها.`
            : 'هل تود تسجيل الخروج؟',
        icon: unsynced.length > 0 ? 'error' : 'warning',
        showCancelButton: true,
        confirmButtonText: unsynced.length > 0 ? 'نعم، احذف وسجّل الخروج' : 'نعم، سجّل الخروج',
        cancelButtonText: 'إلغاء',
        customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
        buttonsStyling: false,
    });
    if (!result.isConfirmed) return false;
    if (beforeSignOut) {
        try { await beforeSignOut(); } catch (_) { /* لا نمنع الخروج بسبب فشل الجانبي */ }
    }
    await signOut();
    return true;
}

/**
 * لمسار غير مُتابَع (الخروج التلقائي بعد خمول — لا يوجد مستخدم حاضر ليضغط
 * "تأكيد" أو "إلغاء"، فحوار تأكيد يعلَّق للأبد بلا فائدة). بدل تحذير لا يُقرأ
 * أو مسح صامت لعمل غير مُزامَن، نحاول رفعه للسحابة أولاً بأفضل جهد — المستخدم
 * لا يزال مُصادَقاً في هذه اللحظة (الخمول ينهي الجلسة استباقياً لأمان الجهاز
 * المشترك، لا لانتهاء JWT فعلي)، فالرفع ممكن قبل المسح غير المشروط في signOut().
 * فشل رفع دراسة واحدة لا يوقف البقية ولا يمنع الخروج نفسه.
 */
export async function trySyncUnsyncedProjects(unsyncedProjects) {
    for (const p of unsyncedProjects) {
        try {
            const loaded = await ProjectManager.loadProject(p.id);
            if (loaded?.data) await ProjectManager.saveProject(loaded.data);
        } catch (_) { /* أفضل جهد فقط */ }
    }
}
