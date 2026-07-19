/**
 * Project Manager
 * Refactored to use PersistenceService (Hybrid Local/Cloud).
 */

import { PersistenceService } from './PersistenceService.js';

export class ProjectManager {

    /**
     * Save project
     * @param {object} data - Project data
     * @returns {Promise<{success:boolean, id:string, error?:string}>}
     */
    static async saveProject(data) {
        try {
            const projectInfo = data.projectInfo || {};
            const id = projectInfo.id || crypto.randomUUID();
            const isNew = !projectInfo.id;
            // Ensure ID is set in the data
            const cleanData = {
                ...data,
                projectInfo: {
                    ...projectInfo,
                    id,
                    name: projectInfo.name || 'مشروع جديد'
                }
            };

            const result = await PersistenceService.save(id, cleanData);

            if (result.success) {
                import('./WebhookService.js').then(({ WebhookService }) => {
                    if (isNew) {
                        WebhookService.triggerEvent('study.created', {
                            study_id: id,
                            project_name: cleanData.projectInfo?.name,
                        });
                    }
                    WebhookService.triggerEvent('study.saved', {
                        study_id: id,
                        project_name: cleanData.projectInfo?.name,
                    });
                });
                return { success: true, id };
            } else {
                return { success: false, error: result.error };
            }
        } catch (e) {
            console.error('Save failed', e);
            return { success: false, error: e.message };
        }
    }

    static async getAllProjects() {
        return await PersistenceService.listHeaders();
    }

    /**
     * @returns {Promise<{ data: object|null, source: 'cloud'|'local'|null }|null>}
     */
    static async loadProject(id) {
        try {
            const result = await PersistenceService.load(id);

            if (!result || !result.data) {
                console.warn(`Project ${id} not found in ${result?.source || 'any source'}`);
                return null;
            }

            console.log(`✅ Loaded project ${id} from ${result.source}`);

            // Ensure project has an ID
            if (!result.data.id && !result.data.projectInfo?.id) {
                result.data.projectInfo = result.data.projectInfo || {};
                result.data.projectInfo.id = id;
            }

            return { data: result.data, source: result.source };
        } catch (e) {
            console.error('Load project error:', e);
            throw e;
        }
    }

    /**
     * Soft Delete - Move to Trash
     */
    static async deleteProject(id) {
        const { data } = (await this.loadProject(id)) || {};
        if (!data) return { success: false, error: 'Project not found' };

        data.projectInfo = data.projectInfo || {};
        data.projectInfo.deleted = true;
        data.projectInfo.deletedAt = Date.now();
        // Update status for cloud sync if needed
        data.projectInfo.status = 'deleted';

        return await this.saveProject(data);
    }

    /**
     * Restore from Trash
     */
    static async restoreProject(id) {
        const { data } = (await this.loadProject(id)) || {};
        if (!data) return { success: false, error: 'Project not found' };

        data.projectInfo = data.projectInfo || {};
        data.projectInfo.deleted = false;
        data.projectInfo.deletedAt = null;
        data.projectInfo.status = 'draft'; // Reset status

        return await this.saveProject(data);
    }

    /**
     * Permanent Delete
     */
    static async permanentDelete(id) {
        return await PersistenceService.delete(id);
    }

    /**
     * Rename project — from the dashboard project list (no need to open the study)
     */
    static async renameProject(id, newName) {
        const trimmed = (newName || '').trim();
        if (!trimmed) return { success: false, error: 'الاسم فارغ' };

        const { data } = (await this.loadProject(id)) || {};
        if (!data) return { success: false, error: 'المشروع غير موجود' };

        data.projectInfo = data.projectInfo || {};
        data.projectInfo.name = trimmed;

        return await this.saveProject(data);
    }

    /**
     * Get Deleted Projects (Trash)
     */
    static async getDeletedProjects() {
        const all = await this.getAllProjects();
        return all.filter(p => p.deleted || p.status === 'deleted');
    }

    /**
     * Get Active Projects (Non-deleted)
     */
    static async getActiveProjects() {
        const all = await this.getAllProjects();
        return all.filter(p => !p.deleted && p.status !== 'deleted');
    }

    /**
     * Duplicate project — استنساخ دراسة موجودة
     * @param {string} id - معرف المشروع الأصلي
     * @param {object} options - { structureOnly: boolean, newName?: string }
     *   structureOnly: نسخة فرع جديد فارغة (نفس المنتجات/شروط الامتياز، بدون أي أرقام تشغيلية
     *   من الفرع الأصلي) بدل نسخة طبق الأصل — لمشغّلي السلاسل الذين يبدأون فرعاً برواتب/إيجار مختلفة.
     * @returns {Promise<{success: boolean, id?: string, error?: string}>}
     */
    static async duplicateProject(id, options = {}) {
        try {
            const result = await this.loadProject(id);
            if (!result?.data) {
                return { success: false, error: 'المشروع غير موجود' };
            }
            const original = result.data;
            const projectInfo = original.projectInfo || {};
            const originalName = projectInfo.name || 'مشروع';
            const newId = crypto.randomUUID();
            const newName = options.newName?.trim() || `نسخة من ${originalName}`;

            let duplicated;
            if (options.structureOnly) {
                // نسخ «قالب» الفرع فقط: المنتجات/الخدمات وشروط الامتياز تبقى (هوية السلسلة)،
                // وكل قسم آخر (تكاليف، رواتب، إيرادات، تمويل...) يُعاد لحالته الفارغة الافتراضية
                // بدل نسخ أرقام الفرع الأصلي حرفياً.
                const { createEmptyStudy } = await import('../core/schema.js');
                const empty = createEmptyStudy();
                const preservedProjectInfoKeys = ['products', 'introServices', 'customerValues', 'businessModel', 'franchiseDetails', 'concept', 'description'];
                const newProjectInfo = { ...empty.projectInfo, id: newId, name: newName };
                preservedProjectInfoKeys.forEach((key) => {
                    if (projectInfo[key] !== undefined) newProjectInfo[key] = projectInfo[key];
                });
                duplicated = { ...empty, id: newId, projectInfo: newProjectInfo };
                // appSettings (وضع الدراسة: مصغّر/بسيط/مفصّل) إعداد قالب لا رقم تشغيلي —
                // بلا هذا السطر كل فرع جديد يُعاد لوضع "مفصّل" الافتراضي حتى لو اختار
                // صاحب السلسلة عمداً وضعاً أخف لكل فروعه.
                if (original.appSettings) duplicated.appSettings = original.appSettings;
            } else {
                duplicated = {
                    ...original,
                    projectInfo: {
                        ...projectInfo,
                        id: newId,
                        name: newName,
                        deleted: false, // Ensure copy is not deleted
                        status: 'draft'
                    }
                };
            }

            const saveResult = await this.saveProject(duplicated);
            if (saveResult.success) {
                import('./WebhookService.js').then(({ WebhookService }) => {
                    WebhookService.triggerEvent('study.duplicated', {
                        original_id: id,
                        new_id: newId,
                        project_name: duplicated.projectInfo?.name,
                    });
                });
            }
            return saveResult;
        } catch (e) {
            console.error('Duplicate failed', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Export project to JSON string
     * @param {string} id - Project ID
     * @returns {Promise<{success: boolean, json?: string, filename?: string, error?: string}>}
     */
    static async exportProjectBackup(id) {
        try {
            const result = await this.loadProject(id);
            if (!result?.data) return { success: false, error: 'المشروع غير موجود' };
            
            const data = result.data;
            const projectName = data.projectInfo?.name || 'مشروع';
            const safeName = projectName.replace(/[^a-zA-Z0-9\u0600-\u06FF\s_-]/g, '').trim().replace(/\s+/g, '_');
            const dateStr = new Date().toISOString().split('T')[0];
            
            const json = JSON.stringify(data, null, 2);
            return { success: true, json, filename: `qarar_backup_${safeName}_${dateStr}.json` };
        } catch (e) {
            console.error('Export failed', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Import project from JSON text
     * @param {string} jsonString - JSON content of the project
     * @returns {Promise<{success: boolean, id?: string, error?: string}>}
     */
    static async importProjectBackup(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data || typeof data !== 'object') return { success: false, error: 'ملف غير صالح' };
            
            // Generate a new ID to avoid overwriting existing projects if imported multiple times
            const newId = crypto.randomUUID();
            data.projectInfo = data.projectInfo || {};
            data.projectInfo.id = newId;
            data.projectInfo.name = (data.projectInfo.name || 'مشروع مستورد') + ' (مستورد)';
            
            return await this.saveProject(data);
        } catch (e) {
            console.error('Import failed', e);
            return { success: false, error: 'تعذر قراءة الملف، تأكد أنه بصيغة صحيحة.' };
        }
    }
}
