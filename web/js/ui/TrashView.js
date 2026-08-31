
import Swal from 'sweetalert2';
import { ProjectManager } from '../services/ProjectManager.js';
import { toast } from '../utils/toast.js';
import { escapeHtml } from '../utils/escape.js';

export class TrashView {
    constructor() {
        this.container = null;
    }

    async render() {
        this.container = document.createElement('div');
        this.container.className = 'trash-view fade-in p-6';

        this.container.innerHTML = `
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-2xl font-bold text-main"><svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg> سلة المحذوفات</h1>
                    <p class="text-muted">المشاريع المحذوفة تبقى هنا حتى تستعيدها أو تحذفها نهائياً بنفسك.</p>
                </div>
                <button class="btn btn-secondary btn--secondary text-sm" onclick="window.history.back()">عودة</button>
            </div>

            <div id="trash-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- Loading State -->
                <div class="col-span-full text-center py-10">
                    <div class="spinner spinner--lg"></div>
                    <p class="mt-4 text-muted">جاري تحميل المحذوفات...</p>
                </div>
            </div>
        `;

        // Load data
        await this._loadTrash();

        return this.container;
    }

    async _loadTrash() {
        const listContainer = this.container.querySelector('#trash-list');
        try {
            const deletedProjects = await ProjectManager.getDeletedProjects();

            if (deletedProjects.length === 0) {
                listContainer.innerHTML = `
                    <div class="col-span-full text-center py-20 trash-empty">
                        <svg class="ic text-4xl mb-4" aria-hidden="true"><use href="#i-reset"/></svg>
                        <h3 class="text-xl font-bold text-muted">السلة فارغة</h3>
                        <p class="text-muted">لا توجد مشاريع محذوفة حالياً.</p>
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = deletedProjects.map(project => `
                <div class="card trash-card">
                    <div class="flex justify-between items-start mb-4">
                        <div class="trash-card__icon text-xl">
                            <svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg>
                        </div>
                        <div class="text-xs text-muted">
                            حذف ${new Date(project.deletedAt || project.lastModified).toLocaleDateString('ar-SA-u-nu-latn')}
                        </div>
                    </div>

                    <h3 class="font-bold text-lg mb-2 text-main">${escapeHtml(project.name)}</h3>
                    <p class="text-xs text-muted mb-4">آخر تعديل: ${new Date(project.lastModified).toLocaleDateString('ar-SA-u-nu-latn')}</p>

                    <div class="flex gap-2 mt-4 pt-4 border-t">
                        <button class="btn-restore btn btn-sm btn--outline flex-1 py-1" data-id="${project.id}">
                            <svg class="ic" aria-hidden="true"><use href="#i-reset"/></svg> استعادة
                        </button>
                        <button class="btn-permanent-delete btn btn-sm btn--outline-danger flex-1 py-1" data-id="${project.id}" data-name="${escapeHtml(project.name)}">
                            <svg class="ic" aria-hidden="true"><use href="#i-x"/></svg> حذف نهائي
                        </button>
                    </div>
                </div>
            `).join('');

            // Bind Events
            this._bindEvents();

        } catch (error) {
            console.error('Error loading trash:', error);
            listContainer.innerHTML = `<div class="col-span-full text-danger text-center">حدث خطأ أثناء تحميل البيانات.</div>`;
        }
    }

    _bindEvents() {
        // Restore
        this.container.querySelectorAll('.btn-restore').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.closest('button').dataset.id;
                const result = await Swal.fire({
                    title: 'هل أنت متأكد؟',
                    text: 'هل أنت متأكد من استعادة هذا المشروع؟',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، استعد',
                    cancelButtonText: 'إلغاء',
                    customClass: { confirmButton: 'btn btn--danger', cancelButton: 'btn btn--secondary' },
                    buttonsStyling: false
                });
                if (result.isConfirmed) {
                    const res = await ProjectManager.restoreProject(id);
                    if (res.success) {
                        toast.success('تمت استعادة المشروع بنجاح');
                        this._loadTrash(); // Refresh
                    } else {
                        toast.error(res.error || 'فشل الاستعادة');
                    }
                }
            });
        });

        // Permanent Delete
        this.container.querySelectorAll('.btn-permanent-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.target.closest('button');
                const id = target.dataset.id;
                const name = target.dataset.name || 'هذا المشروع';
                const step1 = await Swal.fire({
                    title: 'هل أنت متأكد؟',
                    text: 'تحذير: الحذف النهائي لا يمكن التراجع عنه! هل أنت متأكد؟',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'متابعة',
                    cancelButtonText: 'إلغاء',
                    customClass: { confirmButton: 'btn btn--danger', cancelButton: 'btn btn--secondary' },
                    buttonsStyling: false
                });
                if (!step1.isConfirmed) return;

                const step2 = await Swal.fire({
                    title: 'تأكيد أخير',
                    text: `للمتابعة، اكتب اسم المشروع "${name}" بالضبط ثم اضغط تأكيد.`,
                    input: 'text',
                    inputPlaceholder: name,
                    showCancelButton: true,
                    confirmButtonText: 'نعم، احذف نهائياً',
                    cancelButtonText: 'إلغاء',
                    customClass: { confirmButton: 'btn btn--danger', cancelButton: 'btn btn--secondary' },
                    buttonsStyling: false,
                    inputValidator: (value) => (value || '').trim() !== name ? 'الاسم غير مطابق' : undefined
                });
                if (!step2.isConfirmed) return;

                try {
                    await ProjectManager.permanentDelete(id);
                    toast.success('تم الحذف نهائياً');
                    this._loadTrash(); // Refresh
                } catch (err) {
                    toast.error('فشل الحذف النهائي');
                }
            });
        });
    }
}
