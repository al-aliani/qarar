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
        const { data } = await this.loadProject(id);
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
        const { data } = await this.loadProject(id);
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
     * @param {object} options - { structureOnly: boolean } — نسخ الهيكل فقط (بدون بيانات) أو كامل
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

            const duplicated = {
                ...original,
                projectInfo: {
                    ...projectInfo,
                    id: newId,
                    name: `نسخة من ${originalName}`,
                    deleted: false, // Ensure copy is not deleted
                    status: 'draft'
                }
            };

            if (options.structureOnly) {
                // مسح البيانات التفصيلية والاحتفاظ بالهيكل فقط
                const { createEmptyStudy } = await import('../core/schema.js');
                const empty = createEmptyStudy();
                duplicated.projectInfo = { ...empty.projectInfo, ...duplicated.projectInfo, id: newId, name: `نسخة من ${originalName}` };
                duplicated.executiveSummary = empty.executiveSummary;
                duplicated.marketing = empty.marketing;
                duplicated.revenue = empty.revenue;
                duplicated.costs = empty.costs;
                duplicated.financing = empty.financing;
                duplicated.riskAnalysis = empty.riskAnalysis;
                duplicated.appendices = empty.appendices;
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
}
