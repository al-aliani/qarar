
import { ProjectManager } from '../services/ProjectManager.js';
import { toast } from '../utils/toast.js';

export class TrashView {
    constructor() {
        this.container = null;
    }

    async render() {
        this.container = document.createElement('div');
        this.container.className = 'trash-view animate-fade-in p-6';

        this.container.innerHTML = `
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">🗑️ سلة المحذوفات</h1>
                    <p class="text-gray-500">المشاريع المحذوفة تبقى هنا لمدة 30 يوماً قبل الحذف النهائي.</p>
                </div>
                <button class="btn btn-secondary text-sm" onclick="window.history.back()">عودة</button>
            </div>
            
            <div id="trash-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- Loading State -->
                <div class="col-span-full text-center py-10">
                    <div class="spinner border-4 border-gray-300 border-t-blue-600 rounded-full w-10 h-10 mx-auto animate-spin"></div>
                    <p class="mt-4 text-gray-500">جاري تحميل المحذوفات...</p>
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
                    <div class="col-span-full text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <div class="text-4xl mb-4">♻️</div>
                        <h3 class="text-xl font-bold text-gray-600">السلة فارغة</h3>
                        <p class="text-gray-500">لا توجد مشاريع محذوفة حالياً.</p>
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = deletedProjects.map(project => `
                <div class="card p-5 border border-gray-200 hover:border-red-300 transition-all group bg-white rounded-lg shadow-sm">
                    <div class="flex justify-between items-start mb-4">
                        <div class="p-3 bg-red-50 rounded-full text-red-500 text-xl group-hover:bg-red-100 transition-colors">
                            🗑️
                        </div>
                        <div class="text-xs text-gray-400">
                            حذف ${new Date(project.deletedAt || project.lastModified).toLocaleDateString('ar-SA')}
                        </div>
                    </div>
                    
                    <h3 class="font-bold text-lg mb-2 text-gray-800">${project.name}</h3>
                    <p class="text-xs text-gray-500 mb-4">آخر تعديل: ${new Date(project.lastModified).toLocaleDateString('ar-SA')}</p>
                    
                    <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                        <button class="btn-restore btn btn-sm btn-outline-primary flex-1 py-1" data-id="${project.id}">
                            ♻️ استعادة
                        </button>
                        <button class="btn-permanent-delete btn btn-sm btn-outline-danger flex-1 py-1 text-red-600 hover:bg-red-50" data-id="${project.id}">
                            ✖️ حذف نهائي
                        </button>
                    </div>
                </div>
            `).join('');

            // Bind Events
            this._bindEvents();

        } catch (error) {
            console.error('Error loading trash:', error);
            listContainer.innerHTML = `<div class="col-span-full text-red-500 text-center">حدث خطأ أثناء تحميل البيانات.</div>`;
        }
    }

    _bindEvents() {
        // Restore
        this.container.querySelectorAll('.btn-restore').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.closest('button').dataset.id;
                if (confirm('هل أنت متأكد من استعادة هذا المشروع؟')) {
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
                const id = e.target.closest('button').dataset.id;
                if (confirm('تحذير: الحذف النهائي لا يمكن التراجع عنه! هل أنت متأكد؟')) {
                    try {
                        await ProjectManager.permanentDelete(id);
                        toast.success('تم الحذف نهائياً');
                        this._loadTrash(); // Refresh
                    } catch (err) {
                        toast.error('فشل الحذف النهائي');
                    }
                }
            });
        });
    }
}
