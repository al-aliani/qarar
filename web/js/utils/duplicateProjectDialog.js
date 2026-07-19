/**
 * حوار نسخ دراسة إلى فرع جديد — يسأل عن اسم الفرع، ويتيح خيار «فرع فارغ بنفس القالب»
 * (المنتجات وشروط الامتياز فقط، بدون أرقام الفرع الأصلي) بدل نسخة طبق الأصل.
 * مشترك بين DashboardView وGlobalAnalyticsView (نفس الحوار، مصدر واحد).
 */
import Swal from 'sweetalert2';
import { ProjectManager } from '../services/ProjectManager.js';
import { toast } from './toast.js';
import { escapeAttr } from './escape.js';

export async function promptDuplicateProject(id, originalName) {
    const defaultName = `نسخة من ${originalName || 'مشروع'}`;

    const { value: formValues, isConfirmed } = await Swal.fire({
        title: 'نسخ الدراسة لبدء فرع جديد',
        html: `
            <input id="swal-branch-name" class="swal2-input" placeholder="اسم الفرع الجديد" value="${escapeAttr(defaultName)}">
            <label style="display:flex;align-items:flex-start;gap:8px;text-align:right;margin-top:8px;font-size:.9rem;">
                <input type="checkbox" id="swal-structure-only" style="margin-top:3px;">
                <span>فرع فارغ بنفس القالب (المنتجات وشروط الامتياز) — بدون أرقام الفرع الأصلي (الإيجار، الرواتب، التكاليف)</span>
            </label>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'نسخ',
        cancelButtonText: 'إلغاء',
        customClass: { confirmButton: 'btn btn-primary', cancelButton: 'btn btn-secondary' },
        buttonsStyling: false,
        preConfirm: () => {
            const name = document.getElementById('swal-branch-name')?.value?.trim();
            if (!name) {
                Swal.showValidationMessage('أدخل اسماً للفرع الجديد');
                return false;
            }
            return { name, structureOnly: !!document.getElementById('swal-structure-only')?.checked };
        }
    });

    if (!isConfirmed || !formValues) return null;

    try {
        const result = await ProjectManager.duplicateProject(id, {
            structureOnly: formValues.structureOnly,
            newName: formValues.name
        });
        if (result.success) {
            toast.success('تم إنشاء الفرع الجديد بنجاح');
            return result;
        }
        toast.error(result.error || 'فشل نسخ المشروع');
        return null;
    } catch (err) {
        console.error('Duplicate failed:', err);
        toast.error('فشل نسخ المشروع');
        return null;
    }
}
