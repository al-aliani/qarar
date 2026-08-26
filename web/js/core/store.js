/**
 * Study Store (State Management)
 * Handles loading/saving studies, reactivity, and auto-calculation triggers.
 */
import { createEmptyStudy, SECTIONS } from './schema.js';
import { DataBridge } from '../services/DataBridge.js';
import { encryptionService, SENSITIVE_FIELDS } from '../utils/encryption.js';
import { storageManager } from '../utils/storageManager.js';
import { monitoring } from '../utils/monitoring.js';

const STORAGE_KEY = 'mac_blash_study_v2';
const STORAGE_KEY_BACKUP = 'mac_blash_study_v2_backup';
const VERSION_HISTORY_KEY = 'qarar_version_history';

/**
 * Storage strategy (توحيد الحفظ):
 * - mac_blash_study_v2: المسودة الحالية (أسرع قراءة/كتابة) — مصدر واحد للمسودة النشطة.
 * - PersistenceService (feas_project_${id}): المشاريع المحفوظة + المزامنة السحابية عند تسجيل الدخول.
 * - عند الحفظ: يُكتَب إلى mac_blash فوراً، ثم _syncToCloud ينسخ إلى feas_project_${id} وإلى Supabase إن وُجد مستخدم.
 * - عند التحميل من ProjectManager أو ملف: hydrateFromDraft/state= then save → mac_blash و feas_project_ متزامنان.
 * - لا يُستخدم feas_autosave؛ AutoSave يوجّه إلى ProjectManager → PersistenceService فقط.
 */
class StudyStore {
    constructor() {
        this.state = createEmptyStudy();
        this.listeners = new Set();
        this.saveStatusListeners = new Set(); // For save status updates (Saving/Saved/Offline)
        this._localSaveTimeout = null;
        this._cloudSyncTimeout = null; // Debounce timer for cloud sync
        this._lastSaveStatus = { location: 'local', success: true };
        this._saveInProgress = false; // Prevent concurrent saves (race condition protection)
        this._saveQueue = []; // Queue for pending saves
        this._versionHistory = []; // آخر 10 نسخ للاستعادة (في الذاكرة)
        this._versionHistoryMax = 10;
        this._undoStack = [];
        this._redoStack = [];
        this._undoMax = 50;
        this._dirty = false; // تغييرات غير محفوظة (لتنبيه الخروج — مركز تنمية)
        // Load is async, but we don't await in constructor
        this.load().catch(err => {
            console.error('Failed to load in constructor:', err);
            monitoring.captureException(err, { source: 'store.constructor' });
        });

        // Listen for changes in other tabs
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', async (e) => {
                if (e.key !== STORAGE_KEY) return;
                // تبويب آخر كتب المسودة. الاستبدال غير المشروط كان يمحو عمل هذا التبويب:
                // فتحُ دراسة أخرى من لوحة التحكم في تبويب B يُطلق هذا الحدث في تبويب A،
                // فتُستبدل حالته بالكامل بينما نموذج الويزارد ما زال يعرض الدراسة القديمة
                // (لا مشترك في subscribe يعيد رسم الخطوة) — فيُكتب أول تعديل تالٍ داخل
                // الدراسة الأخرى. لا يُستبدل عمل المستخدم بناءً على إشارة تبويب آخر:
                // نتبنّى القادم فقط إن كان **نفس الدراسة** ولا توجد تعديلات غير محفوظة هنا.
                const incomingId = await this._peekStoredProjectId(e.newValue);
                const currentId = this.state?.projectInfo?.id ?? null;
                if (this._dirty || !incomingId || incomingId !== currentId) {
                    console.warn('[Store] تجاهُل تحديث من تبويب آخر (دراسة مختلفة أو تعديلات غير محفوظة هنا)');
                    monitoring.addBreadcrumb('Cross-tab update ignored', 'storage', 'warning', {
                        incomingId, currentId, dirty: this._dirty
                    });
                    return;
                }
                console.log('State updated from another tab, reloading...');
                await this.load();
                this.notify();
            });

            // Flush pending saves before closing
            window.addEventListener('beforeunload', async () => {
                await this.flush();
            });
        }
    }

    /**
     * هوية الدراسة داخل حمولة المسودة كما هي في التخزين — قراءة فقط، بلا ترطيب ولا
     * تعديل للحالة. الحمولات الكبيرة موطنها IndexedDB فيصل حدث storage بـnewValue = null،
     * فنقرأ عبر storageManager. تعذُّر القراءة أو التحليل يُعيد null = «هوية مجهولة»،
     * وهي ليست إذناً بالاستبدال.
     * @param {string|null} rawValue - قيمة الحدث الجديدة إن وُجدت
     * @returns {Promise<string|null>}
     */
    async _peekStoredProjectId(rawValue) {
        let raw = rawValue;
        if (typeof raw !== 'string' || !raw) {
            try {
                raw = await storageManager.getItem(STORAGE_KEY);
            } catch (_) {
                return null;
            }
        }
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return parsed?.projectInfo?.id ?? null;
        } catch (_) {
            return null;
        }
    }

    async load() {
        try {
            // يُحمَّل أولاً وبمعزل عن حالة الدراسة نفسها كي يكون جاهزاً قبل أي saveLocal لاحق في هذه الدالة
            await this._loadVersionHistory();

            // 1. Load local draft first (fast) - using StorageManager
            const raw = await storageManager.getItem(STORAGE_KEY);
            if (raw) {
                try {
                    let parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

                    if (!parsed || typeof parsed !== 'object') {
                        throw new Error('Parsed state is invalid (null or not an object)');
                    }

                    this.state = await this._hydrate(parsed);
                } catch (parseErr) {
                    console.warn('Main save corrupted, trying backup...');
                    monitoring.captureException(parseErr, { source: 'store.load', step: 'main_parse' });

                    const backupRaw = await storageManager.getItem(STORAGE_KEY_BACKUP);
                    if (backupRaw) {
                        try {
                            let parsed = typeof backupRaw === 'string' ? JSON.parse(backupRaw) : backupRaw;

                            if (!parsed || typeof parsed !== 'object') {
                                throw new Error('Backup state is invalid');
                            }

                            this.state = await this._hydrate(parsed);
                            console.info('Restored from backup successfully.');
                            monitoring.addBreadcrumb('Restored from backup', 'storage', 'info');
                        } catch (backupErr) {
                            console.error('Backup also corrupted:', backupErr);
                            monitoring.captureException(backupErr, { source: 'store.load', step: 'backup_parse' });
                            throw parseErr;
                        }
                    } else {
                        throw parseErr;
                    }
                }
            } else {
                // Try backup even if main is missing
                const backupRaw = await storageManager.getItem(STORAGE_KEY_BACKUP);
                if (backupRaw) {
                    try {
                        let parsed = typeof backupRaw === 'string' ? JSON.parse(backupRaw) : backupRaw;

                        if (!parsed || typeof parsed !== 'object') {
                            throw new Error('Backup state is invalid');
                        }

                        this.state = await this._hydrate(parsed);
                        console.info('Restored from backup (main missing).');
                        monitoring.addBreadcrumb('Restored from backup (main missing)', 'storage', 'info');
                    } catch (backupErr) {
                        console.error('Backup corrupted:', backupErr);
                        monitoring.captureException(backupErr, { source: 'store.load', step: 'backup_parse_missing_main' });
                        this._startEmptyWithoutOverwriting('backup_parse_missing_main');
                    }
                } else {
                    // لا مسودة ولا نسخة احتياطية: إما مستخدم جديد (فراغ حقيقي فيُبذَر
                    // التخزين) وإما فشل قراءة — storageManager يُعيد null عمداً حين يكون
                    // موطن المفتاح IndexedDB وهي غير متاحة. الفشل ليس دليلاً على الفراغ.
                    if (this._localDraftHomeUnreachable()) {
                        this._startEmptyWithoutOverwriting('storage_unreadable');
                    } else {
                        await this.reset();
                    }
                }
            }

            // 2. Check Cloud if available (using PersistenceService)
            if (typeof window !== 'undefined') {
                try {
                    const { PersistenceService } = await import('../services/PersistenceService.js');
                    const { getAuthUser } = await import('../../supabaseClient.js');
                    const { user } = await getAuthUser();

                    if (user && this.state?.projectInfo?.id) {
                        // Try to load from cloud for the current project
                        const projectId = this.state.projectInfo.id;
                        const cloudResult = await PersistenceService.load(projectId);

                        if (cloudResult && cloudResult.data && cloudResult.source === 'cloud') {
                            // Cloud data is newer or only available in cloud.
                            // _hydrate repairs rows that were uploaded encrypted by the old
                            // (removed) at-rest encryption — see _sanitizeCorruptedFields.
                            console.log('✅ Loaded study from cloud:', projectId);
                            this.state = await this._hydrate(cloudResult.data);
                            await this.saveLocal(); // Update local cache (re-writes repaired plaintext)
                            this.notify();
                        } else if (cloudResult && cloudResult.data && cloudResult.source === 'local') {
                            // Local data exists, but we checked cloud first (good)
                            console.log('📦 Using local study (cloud check completed)');
                        }
                    }
                } catch (err) {
                    console.warn('Cloud load check failed (non-critical), using local:', err);
                    // Non-critical: continue with local data
                }
            }
        } catch (e) {
            console.error('Failed to load study:', e);
            monitoring.captureException(e, { source: 'store.load', operation: 'load' });
            this._startEmptyWithoutOverwriting('load_failed');
        }
    }

    /**
     * علامة storageManager: «موطن قيمة هذا المفتاح هو IndexedDB». وجودها مع قراءة
     * أعادت null يعني أن هناك بيانات تعذّرت قراءتها — لا أن التخزين فارغ.
     * (تُقرأ العلامة مباشرة لأن storageManager لا يكشف سبب الـnull.)
     */
    _localDraftHomeUnreachable() {
        if (typeof localStorage === 'undefined') return false;
        try {
            return localStorage.getItem(`${STORAGE_KEY}_ref`) === 'indexeddb'
                || localStorage.getItem(`${STORAGE_KEY_BACKUP}_ref`) === 'indexeddb';
        } catch (_) {
            return false;
        }
    }

    /**
     * مسار فشل القراءة: نبدأ بحالة فارغة **في الذاكرة فقط** — بلا saveLocal.
     * reset() كانت تُستدعى هنا فتكتب الدراسة الفارغة فوق mac_blash_study_v2 ونسختها
     * الاحتياطية وتزيل علامة _ref، فتُظلَّل نسخة IndexedDB السليمة نهائياً: عمل
     * المستخدم يُدمَّر بسبب فشل قراءة قد يكون عابراً. لا كتابة قبل أن يقرر المستخدم
     * (الحفظ التلقائي لا يكتب ما لم يُرفع _dirty بتعديل فعلي منه).
     */
    _startEmptyWithoutOverwriting(reason) {
        this.state = createEmptyStudy();
        monitoring.addBreadcrumb('Draft unreadable — started empty without overwriting', 'storage', 'error', { reason });
        if (typeof window !== 'undefined') {
            import('../utils/toast.js')
                .then(({ toast }) => toast.error(
                    'تعذّر قراءة مسودتك المحفوظة على هذا الجهاز. لم نكتب فوقها — افتح دراسة من لوحة التحكم أو استورد نسخة احتياطية.',
                    12000
                ))
                .catch(() => { });
        }
        this.notify();
    }

    /**
     * مسار ترطيب موحّد لأي حالة قادمة من التخزين (محلي أو سحابي):
     * 1) محاولة فك تشفير الحقول الموروثة (يعمل فقط إن كان مفتاح الجلسة نفسه ما زال حياً).
     * 2) الدمج مع المخطط الافتراضي.
     * 3) تعقيم الحقول التالفة: أي حقل حسّاس بقي نصاً مشفّراً غير قابل للفك
     *    (مفتاحه فُقد بإغلاق التبويب) يُعاد إلى قيمته الافتراضية بدل أن يكسر المحرك.
     */
    async _hydrate(parsed) {
        const decrypted = await encryptionService.decryptSensitiveFields(parsed, SENSITIVE_FIELDS);
        const merged = this.mergeWithDefaults(decrypted);
        const repaired = this._sanitizeCorruptedFields(merged);
        if (repaired.length) {
            console.warn('[Store] أُصلحت حقول تالفة من التشفير القديم (أُعيدت للافتراضي):', repaired);
            monitoring.addBreadcrumb('Repaired corrupted encrypted fields', 'storage', 'warning', { fields: repaired });
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('qarar:data-repaired', { detail: { fields: repaired } }));
            }
        }
        return merged;
    }

    /**
     * يكتشف بقايا التشفير القديم: نص Base64 في موضع يتوقع المخطط فيه
     * مصفوفة/كائناً/رقماً، ويعيده إلى الافتراضي. يعيد قائمة الحقول المُصلحة.
     */
    _sanitizeCorruptedFields(state) {
        const defaults = createEmptyStudy();
        const repaired = [];
        for (const field of SENSITIVE_FIELDS) {
            const keys = field.split('.');
            let tgt = state;
            let dfl = defaults;
            for (let i = 0; i < keys.length - 1; i++) {
                tgt = tgt?.[keys[i]];
                dfl = dfl?.[keys[i]];
            }
            if (!tgt || typeof tgt !== 'object' || !dfl) continue;
            const last = keys[keys.length - 1];
            const val = tgt[last];
            const defVal = dfl[last];
            if (typeof val !== 'string') continue;
            if (typeof defVal === 'number' || typeof defVal === 'boolean') {
                // أرقام حُفظت كنصوص (مسار fallback القديم): "0.15" → 0.15
                const n = Number(val);
                if (Number.isFinite(n)) {
                    tgt[last] = typeof defVal === 'boolean' ? Boolean(n) : n;
                } else {
                    tgt[last] = defVal;
                    repaired.push(field);
                }
            } else if (Array.isArray(defVal) || (typeof defVal === 'object' && defVal !== null)) {
                // نص مكان بنية = حمولة مشفّرة فُقد مفتاحها
                tgt[last] = JSON.parse(JSON.stringify(defVal));
                repaired.push(field);
            }
        }
        return repaired;
    }

    // Safe Deep Merge for Schema Evolution
    mergeWithDefaults(loadedState) {
        const defaults = createEmptyStudy();
        return this._deepMerge(defaults, loadedState);
    }

    _deepMerge(target, source) {
        if (!source || typeof source !== 'object') return target;

        Object.keys(source).forEach(key => {
            const targetValue = target[key];
            const sourceValue = source[key];

            if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
                target[key] = sourceValue; // Arrays: overwrite (don't merge items to avoid dupes)
            } else if (Array.isArray(targetValue) && typeof sourceValue === 'string') {
                // نص مكان مصفوفة (حمولة تشفير قديمة تالفة) — أبقِ الافتراضي السليم
                return;
            } else if (typeof targetValue === 'object' && targetValue !== null && typeof sourceValue === 'string') {
                // نص مكان كائن — نفس الحالة
                return;
            } else if (typeof targetValue === 'object' && typeof sourceValue === 'object' && targetValue !== null && sourceValue !== null) {
                target[key] = this._deepMerge({ ...targetValue }, sourceValue);
            } else {
                target[key] = sourceValue;
            }
        });

        return target;
    }

    async reset() {
        this.state = createEmptyStudy();
        await this.saveLocal();
        this.notify();
    }

    /**
     * Replace state with a draft (e.g. from legacy feas_autosave migration).
     * Merges with schema defaults, saves to mac_blash, notifies.
     * @param {object} data - Parsed draft
     */
    async hydrateFromDraft(data) {
        if (!data || typeof data !== 'object') return;
        this.state = this.mergeWithDefaults(data);
        await this.saveLocal();
        this.notify();
    }

    save() {
        if (!this.state) return;
        this.state.updatedAt = new Date().toISOString();
        // الحفظ المحلي ثم المزامنة السحابية عبر مسار واحد موحّد:
        // saveLocal → _syncToCloud → PersistenceService (studies: user_id + data).
        this.saveLocalDebounced();
    }

    saveLocalDebounced() {
        if (this._localSaveTimeout) clearTimeout(this._localSaveTimeout);
        this._localSaveTimeout = setTimeout(async () => {
            await this.saveLocal();
        }, 1000); // Wait 1 second before writing to disk
    }

    // Force save immediately
    async flush() {
        if (this._localSaveTimeout) {
            clearTimeout(this._localSaveTimeout);
            await this.saveLocal();
        }
    }

    async saveLocal() {
        if (!this.state) {
            console.error('Cannot save: state is null');
            return;
        }

        if (!this.validateState(this.state)) {
            console.error('Cannot save: Invalid state structure detected');
            return;
        }

        // تحذيرات التحقق (لا تمنع الحفظ)
        import('../utils/validation.js').then(({ validateStudy }) => {
            const { errors } = validateStudy(this.state);
            if (errors.length) console.warn('[Store] تحذيرات التحقق:', errors);
        }).catch(() => { });

        // Race condition protection: queue save if one is in progress
        if (this._saveInProgress) {
            console.debug('[Store] Save in progress, queuing...');
            return new Promise((resolve) => {
                this._saveQueue.push(resolve);
            });
        }

        this._saveInProgress = true;

        try {
            // تدقيق اختبار عميل 2026-07-12: استنساخان عميقان منفصلان (JSON.stringify+parse
            // مرتين) على كل حفظة كانا يساهمان في تجمّد محسوس مع نمو حجم الدراسة. لا شيء
            // يُعدِّل stateToSave أو نسخة سجل الإصدارات بعد إنشائها — فاستنساخ واحد يكفي
            // للاثنين معاً، وstructuredClone أسرع من الجولة النصية عبر JSON.
            const stateToSave = structuredClone(this.state);

            // Version history (آخر N نسخ)
            this._versionHistory.push({
                timestamp: new Date().toISOString(),
                state: stateToSave
            });
            if (this._versionHistory.length > this._versionHistoryMax) {
                this._versionHistory = this._versionHistory.slice(-this._versionHistoryMax);
            }
            await this._persistVersionHistory();

            // ملاحظة (2026-07-04): أُزيل تشفير الحقول قبل الحفظ نهائياً.
            // كان المفتاح يعيش في sessionStorage فيفنى بإغلاق التبويب، فتُرفع نسخة
            // مشفّرة غير قابلة للفك إلى السحابة وتعود كنص Base64 مكان المصفوفات
            // («اختفاء» الإيرادات/الرواتب). الحماية الحقيقية = RLS في Supabase.
            const jsonString = JSON.stringify(stateToSave);

            // Check localStorage size (warn if approaching limit)
            const sizeInBytes = new Blob([jsonString]).size;
            const sizeInMB = sizeInBytes / (1024 * 1024);
            if (sizeInMB > 4) {
                console.warn(`[Store] Data size is ${sizeInMB.toFixed(2)}MB, approaching localStorage limit (5-10MB)`);
            }

            console.debug(`[Store] Saving to local storage at ${new Date().toISOString()} (${sizeInMB.toFixed(2)}MB)`);

            // Use StorageManager (handles IndexedDB fallback automatically)
            await storageManager.setItem(STORAGE_KEY, jsonString);
            await storageManager.setItem(STORAGE_KEY_BACKUP, jsonString);

            this._dirty = false;

            monitoring.addBreadcrumb('Data saved', 'storage', 'info', { size: sizeInMB.toFixed(2) + 'MB' });

            // Try cloud sync if PersistenceService is available (non-blocking with debounce)
            if (this._cloudSyncTimeout) clearTimeout(this._cloudSyncTimeout);
            this._cloudSyncTimeout = setTimeout(() => {
                this._syncToCloud(stateToSave).catch(err => {
                    console.warn('[Store] Cloud sync failed (non-critical):', err);
                    monitoring.addBreadcrumb('Cloud sync failed', 'storage', 'warning', { error: err.message });
                });
            }, 800); // 800ms debounce for cloud sync

            // Process queued saves
            this._processSaveQueue();

        } catch (e) {
            console.error('Failed to save to storage:', e);
            monitoring.captureException(e, { source: 'store.saveLocal', operation: 'save' });
            this._saveInProgress = false;
            this._processSaveQueue(); // Process queue even on error

            // محاولة أخيرة بنسخة جديدة من الحالة (قد يكون فشل الأولى عابراً)
            try {
                const stateToSave = JSON.parse(JSON.stringify(this.state));
                const jsonString = JSON.stringify(stateToSave);
                await storageManager.setItem(STORAGE_KEY, jsonString);
                await storageManager.setItem(STORAGE_KEY_BACKUP, jsonString);
                this._dirty = false;
                console.warn('Saved without encryption (fallback mode)');
                monitoring.addBreadcrumb('Saved without encryption', 'storage', 'warning');
            } catch (fallbackErr) {
                console.error('Fallback save also failed:', fallbackErr);
                monitoring.captureException(fallbackErr, { source: 'store.saveLocal', operation: 'fallback_save' });
            } finally {
                this._saveInProgress = false;
                this._processSaveQueue();
            }
        } finally {
            this._saveInProgress = false;
            this._processSaveQueue();
        }
    }

    /**
     * Process queued saves after current save completes
     */
    _processSaveQueue() {
        if (this._saveQueue.length > 0 && !this._saveInProgress) {
            const resolve = this._saveQueue.shift();
            if (resolve) {
                this.saveLocal().then(() => resolve()).catch(() => resolve());
            }
        }
    }

    validateState(state) {
        if (!state || typeof state !== 'object') return false;
        // ensure we don't save an empty object over a valid study accidentally
        if (Object.keys(state).length === 0) return false;
        return true;
    }

    /**
     * تاريخ الإصدارات (آخر N نسخ في الذاكرة)
     * @returns {{ timestamp: string, state: object }[]}
     */
    getVersionHistory() {
        return this._versionHistory.map(v => ({ timestamp: v.timestamp, state: v.state }));
    }

    canUndo() { return this._undoStack.length > 0; }
    canRedo() { return this._redoStack.length > 0; }

    async undo() {
        if (!this.canUndo()) return false;
        this._redoStack.push(this._cloneState(this.state));
        this.state = this.mergeWithDefaults(this._undoStack.pop());
        this._dirty = true;
        await this.saveLocal();
        this.notify();
        return true;
    }

    async redo() {
        if (!this.canRedo()) return false;
        this._undoStack.push(this._cloneState(this.state));
        this.state = this.mergeWithDefaults(this._redoStack.pop());
        this._dirty = true;
        await this.saveLocal();
        this.notify();
        return true;
    }

    /**
     * استعادة إصدار سابق من الذاكرة (بالفهرس 0 = الأقدم في القائمة الحالية)
     * @param {number} index - index in _versionHistory (0 = oldest of last N)
     */
    async restoreVersion(index) {
        if (!this._versionHistory.length || index < 0 || index >= this._versionHistory.length) return false;
        const entry = this._versionHistory[this._versionHistory.length - 1 - index];
        if (!entry?.state) return false;
        this.state = this.mergeWithDefaults(entry.state);
        await this.saveLocal();
        this.notify();
        return true;
    }

    /**
     * يُحمَّل مرة واحدة عند التهيئة (من load()) كي يبقى سجل الإصدارات حياً بعد إعادة تحميل الصفحة.
     */
    async _loadVersionHistory() {
        try {
            const raw = await storageManager.getItem(VERSION_HISTORY_KEY);
            if (!raw) return;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (Array.isArray(parsed)) {
                this._versionHistory = parsed.slice(-this._versionHistoryMax);
            }
        } catch (e) {
            console.warn('[Store] Failed to load persisted version history:', e);
            monitoring.captureException(e, { source: 'store._loadVersionHistory' });
        }
    }

    /**
     * يُستدعى بعد كل تحديث لـ _versionHistory في saveLocal() كي يبقى متزامناً مع localStorage.
     */
    async _persistVersionHistory() {
        try {
            await storageManager.setItem(VERSION_HISTORY_KEY, JSON.stringify(this._versionHistory));
        } catch (e) {
            console.warn('[Store] Failed to persist version history:', e);
            monitoring.captureException(e, { source: 'store._persistVersionHistory' });
        }
    }

    get() {
        return this.state;
    }

    getState() {
        return this.state;
    }

    set(data) {
        this._recordUndo();
        this.state = data;
        this._redoStack = [];
        this.save();
        this.notify();
    }

    _cloneState(value) {
        try { return structuredClone(value); } catch (_) { return JSON.parse(JSON.stringify(value)); }
    }

    _recordUndo() {
        if (!this.state) return;
        this._undoStack.push(this._cloneState(this.state));
        if (this._undoStack.length > this._undoMax) this._undoStack.shift();
        this._redoStack = [];
    }

    updateSection(section, data) {
        this._recordUndo();
        // Auto-initialize if missing (migration for old saves)
        if (!this.state[section]) {
            console.warn(`Section ${section} missing, initializing from schema...`);
            const defaults = createEmptyStudy();
            this.state[section] = defaults[section] || {};
        }

        // النشر السطحي كان يعامل أي قيمة كأنها كائن: نصّ مثل id/version يُفكَّك إلى
        // كائن مفهرس بالأحرف ({"0":"4","1":".",...})، ومصفوفة تُدمج بالفهرس فتبقى
        // عناصر المصفوفة السابقة في المواضع الزائدة. الدمج مقصود للكائنات العادية
        // وحدها؛ ما عداها (نص/رقم/بولياني/null/مصفوفة) استبدال كامل.
        // undefined يبقى بلا أثر كما كان ({ ...obj, ...undefined } نسخة بلا تغيير) —
        // كي لا يمحو مستدعٍ قسماً كاملاً بلا قصد.
        const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
        if (isPlainObject(this.state[section]) && isPlainObject(data)) {
            this.state[section] = { ...this.state[section], ...data };
        } else if (data !== undefined) {
            this.state[section] = data;
        }

        // Auto-bridge: If services updated, sync to revenue
        if (section === 'services') {
            const newRevenue = DataBridge.syncServicesToRevenue(this.state);
            if (newRevenue) {
                this.state.revenue.streams = newRevenue;
                console.log('🌉 DataBridge: Synced services to revenue');
            }
        }

        this._syncSwot(section);

        this._dirty = true;
        this.save();
        this.notify(section);
    }

    update(section, data) {
        this.updateSection(section, data);
    }

    /**
     * مزامنة SWOT ثنائية الاتجاه: strategic.swot (مصفوفات — المصدر الغني بالتوليد)
     * ↔ marketing.swot (نصوص أسطر — تقرؤها خطوة الدراسة السوقية والتقارير).
     * كان في الدراسة تحليلان رباعيان منفصلان يتناقضان، وسوقيّهما بلا «فرص» أصلاً
     * (تدقيق ٢٠٢٦-٠٧-٠٦). حُرّاس التساوي يمنعون أي حلقة تحديث.
     */
    _syncSwot(section, path = '') {
        const touchesStrategic = section === 'strategic' && (path === '' || path.startsWith('swot'));
        const touchesMarketing = section === 'marketing' && (path === '' || path.startsWith('swot'));
        if (!touchesStrategic && !touchesMarketing) return;

        const KEYS = ['strengths', 'weaknesses', 'opportunities', 'threats'];
        const toText = (arr) => (Array.isArray(arr) ? arr : []).map(x => String(x ?? '').trim()).filter(Boolean).join('\n');
        const toList = (txt) => String(txt ?? '').split(/\n|؛/).map(s => s.trim()).filter(Boolean);

        this.state.marketing = this.state.marketing || {};
        this.state.marketing.swot = this.state.marketing.swot || {};
        this.state.strategic = this.state.strategic || {};
        this.state.strategic.swot = this.state.strategic.swot || {};
        const mk = this.state.marketing.swot;
        const stg = this.state.strategic.swot;

        if (touchesStrategic) {
            KEYS.forEach(k => {
                const txt = toText(stg[k]);
                if ((mk[k] ?? '') !== txt) mk[k] = txt;
            });
        } else {
            KEYS.forEach(k => {
                const list = toList(mk[k]);
                if (toText(stg[k]) !== list.join('\n')) stg[k] = list;
            });
        }
    }

    updatePath(section, path, value) {
        this._recordUndo();
        // Auto-initialize if missing (migration for old saves)
        if (this.state[section] === undefined) {
            console.warn(`Section ${section} missing, initializing from schema...`);
            const defaults = createEmptyStudy();
            this.state[section] = defaults[section] || {};
        }

        console.debug(`[Store] Updating path: ${section}.${path}`, value);

        // If path is empty, update the entire section (for array sections)
        if (!path || path === '') {
            this.state[section] = value;

            // Auto-bridge for path updates (if whole section replaced or specific path?)
            // If replacing whole section 'services'
            if (section === 'services') {
                const newRevenue = DataBridge.syncServicesToRevenue(this.state);
                if (newRevenue) {
                    this.state.revenue.streams = newRevenue;
                    console.log('🌉 DataBridge: Synced services to revenue');
                }
            }

            this._syncSwot(section);

            this._dirty = true;
            this.save();
            this.notify(section);
            return;
        }

        const keys = path.split('.');
        let target = this.state[section];

        // If section is an array, we can't navigate into it with paths
        if (Array.isArray(target)) {
            // For array sections, the path should be empty (handled above)
            // or we need to handle indexed access
            console.warn(`Cannot update path "${path}" on array section "${section}"`);
            return;
        }

        for (let i = 0; i < keys.length - 1; i++) {
            if (!target[keys[i]]) target[keys[i]] = {};
            target = target[keys[i]];
        }

        target[keys[keys.length - 1]] = value;

        // Auto-bridge for deep updates
        if (section === 'services') {
            const newRevenue = DataBridge.syncServicesToRevenue(this.state);
            if (newRevenue) {
                this.state.revenue.streams = newRevenue;
                console.log('🌉 DataBridge: Synced services to revenue');
            }
        }

        this._syncSwot(section, path);

        this._dirty = true;
        this.save();
        this.notify(section);
    }

    exportJSON() {
        return JSON.stringify(this.state, null, 2);
    }

    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notify(changedSection = null) {
        for (const listener of this.listeners) {
            try {
                listener(this.state, changedSection);
            } catch (e) {
                console.error("Listener error:", e);
            }
        }
    }

    /**
     * Sync to cloud using PersistenceService (non-blocking)
     */
    async _syncToCloud(data) {
        try {
            this._notifySaveStatus({ saving: true });
            const { PersistenceService } = await import('../services/PersistenceService.js');
            const projectId = this.state?.projectInfo?.id || this.state?.id || crypto.randomUUID();

            // Ensure project ID is set in state
            if (!this.state.projectInfo) this.state.projectInfo = {};
            if (!this.state.projectInfo.id) this.state.projectInfo.id = projectId;
            if (!this.state.id) this.state.id = projectId;

            const result = await PersistenceService.save(projectId, data);

            this._lastSaveStatus = {
                location: result.location || 'local',
                success: result.success !== false,
                error: result.error
            };
            this._notifySaveStatus(this._lastSaveStatus);

            if (result.location === 'both') {
                console.debug(`[Store] Saved to both local and cloud (project: ${projectId})`);
            } else if (result.location === 'local') {
                console.debug(`[Store] Saved to local only (not authenticated, project: ${projectId})`);
            }

            return result;
        } catch (err) {
            // Non-critical: cloud save failed, but local save succeeded
            console.warn('[Store] Cloud sync error:', err);
            this._lastSaveStatus = {
                location: 'local',
                success: true,
                error: err.message
            };
            this._notifySaveStatus(this._lastSaveStatus);
            // Don't throw - local save succeeded, cloud is optional
            return { success: false, location: 'local', error: err.message };
        }
    }

    /**
     * Notify save status listeners (for UI updates like "Saving..." / "Saved" / "Offline")
     */
    _notifySaveStatus(status) {
        for (const listener of this.saveStatusListeners) {
            try {
                listener(status);
            } catch (e) {
                console.error("Save status listener error:", e);
            }
        }
    }

    /**
     * Subscribe to save status updates
     */
    subscribeSaveStatus(callback) {
        this.saveStatusListeners.add(callback);
        // Immediately notify with last status
        if (this._lastSaveStatus) {
            callback(this._lastSaveStatus);
        }
        return () => this.saveStatusListeners.delete(callback);
    }

    /**
     * Get last save status
     */
    getLastSaveStatus() {
        return this._lastSaveStatus || { location: 'local', success: true };
    }
}

export const store = new StudyStore();
window.studyStore = store; // Expose for sidebar actions using dynamic imports
