/**
 * Project Manager
 * Refactored to use PersistenceService (Hybrid Local/Cloud).
 */

import { PersistenceService } from './PersistenceService.js';

// بصمة ملف النسخة الاحتياطية: بدونها لا شيء يميّز ملف «قرار» عن أي JSON آخر،
// وكان الاستيراد يقبل أي ملف ككائن دراسة صالح.
const BACKUP_APP = 'qarar';
const BACKUP_FORMAT_VERSION = 1;

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
            
            const json = JSON.stringify({
                app: BACKUP_APP,
                formatVersion: BACKUP_FORMAT_VERSION,
                exportedAt: new Date().toISOString(),
                data
            }, null, 2);
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
        let parsed;
        try {
            parsed = JSON.parse(jsonString);
        } catch (e) {
            console.error('Import failed', e);
            return { success: false, error: 'تعذر قراءة الملف، تأكد أنه بصيغة صحيحة.' };
        }

        try {
            const { createEmptyStudy, SECTIONS } = await import('../core/schema.js');

            const data = this._unwrapBackup(parsed, SECTIONS);
            if (!data) {
                return {
                    success: false,
                    error: 'هذا الملف ليس نسخة احتياطية من «قرار». اختر ملف qarar_backup_*.json الذي صدّرته من هنا.'
                };
            }

            // تطبيع على المخطط: المستدعي (DecisionDashboard) يطبّق مفاتيح الملف
            // المستورَد فقط عبر store.update، وupdateSection تدمج سطحياً داخل القسم —
            // فأي مفتاح غائب عن الملف كان يبقى حاملاً قيمة الدراسة المفتوحة قبله
            // (خلط دراستين في ملف واحد يُصدَّر لاحقاً).
            // النشر السطحي `{ ...empty, ...data }` كان يغطّي الأقسام الغائبة **كلياً**
            // فقط؛ القسم الحاضر **جزئياً** (نسخة قديمة صُدِّرت قبل توسّع المخطط) كان
            // يُؤخذ كما هو، فتنجو مفاتيحه الناقصة من الدراسة السابقة. الدمج العميق مع
            // المخطط يجعل كل مفتاح حاضراً بقيمته الافتراضية فلا يبقى مكان للتسرّب.
            // نستعير _deepMerge من المخزن بدل كتابة دمج ثالث: هو نفسه المستخدَم في
            // mergeWithDefaults عند تحميل أي مسودة، ويعامل النصوص/الأرقام كاستبدال
            // كامل (لا يفكّك "4.0.0" إلى كائن مفهرس بالأحرف).
            const { store } = await import('../core/store.js');
            const imported = store._deepMerge(createEmptyStudy(), data);
            imported.projectInfo = {
                ...imported.projectInfo,
                // Generate a new ID to avoid overwriting existing projects if imported multiple times
                id: crypto.randomUUID(),
                name: (data.projectInfo?.name || 'مشروع مستورد') + ' (مستورد)'
            };

            return await this.saveProject(imported);
        } catch (e) {
            console.error('Import failed', e);
            return { success: false, error: 'تعذر قراءة الملف، تأكد أنه بصيغة صحيحة.' };
        }
    }

    /**
     * يقبل شكلين فقط ويُعيد حالة الدراسة، وإلا null:
     * 1) مغلّف «قرار» ({ app: 'qarar', data }) — ما يكتبه exportProjectBackup.
     * 2) حالة دراسة خام (ملفات صُدِّرت قبل المغلّف): كائن يحمل projectInfo وثلاثة
     *    أقسام معروفة على الأقل من المخطط.
     * @param {*} parsed - ناتج JSON.parse للملف
     * @param {object} SECTIONS - أسماء أقسام المخطط (مصدر واحد، بلا قائمة مكرّرة هنا)
     */
    static _unwrapBackup(parsed, SECTIONS) {
        const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
        if (!isPlainObject(parsed)) return null;

        if (parsed.app === BACKUP_APP) {
            return isPlainObject(parsed.data) ? parsed.data : null;
        }

        if (!isPlainObject(parsed.projectInfo)) return null;
        const knownSections = Object.values(SECTIONS).filter(s => s !== 'projectInfo');
        const present = knownSections.filter(s => isPlainObject(parsed[s]) || Array.isArray(parsed[s]));
        return present.length >= 3 ? parsed : null;
    }
}
