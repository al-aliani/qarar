// استيراد ديناميكي لتجنب 500 عند تحميل الملف (إذا كان Supabase أو auditLogger غير متاحين)
async function _getSupabase() {
    const m = await import('../../supabaseClient.js');
    return { getSupabaseClient: m.getSupabaseClient, getAuthUser: m.getAuthUser };
}
async function _getAuditLogger() {
    const m = await import('../utils/auditLogger.js');
    return { log: m.log, ACTIONS: m.ACTIONS };
}
async function _getEngineVersion() {
    const m = await import('../core/engine.js');
    return m.ENGINE_VERSION;
}

const COMPRESS_PREFIX = 'LZ:';
// lz-string تبعية محلية مُجمَّعة عبر Vite (optimizeDeps.include). لا CDN.

// تُصدَّر دوال lz-string أحياناً في الأعلى (بناء ESM) وأحياناً تحت .default (npm CJS).
// نُعيد الكائن الذي يحمل الدوال فعلاً حتى يعمل الضغط في الحالتين.
function getLZ(LZ) {
    if (LZ && typeof LZ.compressToUTF16 === 'function') return LZ;
    if (LZ && LZ.default && typeof LZ.default.compressToUTF16 === 'function') return LZ.default;
    return LZ;
}

/**
 * ضغط البيانات المحلية (LZ-string) — معيار حرج
 */
async function compress(str) {
    try {
        const mod = await import('lz-string');
        const LZ = getLZ(mod);
        const c = LZ.compressToUTF16(str);
        return c ? COMPRESS_PREFIX + c : str;
    } catch {
        return str;
    }
}

async function decompress(str) {
    if (!str || !str.startsWith(COMPRESS_PREFIX)) return str;
    try {
        const mod = await import('lz-string');
        const LZ = getLZ(mod);
        return LZ.decompressFromUTF16(str.slice(COMPRESS_PREFIX.length)) || str;
    } catch {
        return str;
    }
}

/**
 * PersistenceService
 * 
 * Strategy: "Draft Cache First, Cloud Sync Second"
 * 
 * 1. Save (W): Always writes to localStorage immediately (fast).
 * 2. Sync (W): Debounced sync to Supabase if authenticated.
 * 3. Load (R): Try loading from Supabase first (source of truth).
 *    If offline/fail, fall back to localStorage (Draft Cache).
 */

const LOCAL_STORAGE_KEY_PREFIX = 'feas_project_';
const SUPA_TABLE_STUDIES = 'studies';

// تدقيق شامل 2026-09-16 (دمج تعديل متزامن): تعديل فعلي متزامن لنفس الدراسة من جهازين/
// تبويبين كان يُفقِد أحدهما بالكامل — الحفظ اللاحق upsert غير مشروط يكتب فوق أي تعديل
// وصل للسحابة بعد آخر مرة قرأنا/كتبنا فيها هذا الجهاز، بصرف النظر عن كونه في قسم مختلف
// تماماً لا علاقة له بما عدّله المستخدم هنا. الحل: دمج ثلاثي على مستوى القسم الأعلى
// (projectInfo/technical/hr/revenue/...) قبل كل كتابة سحابية — قسم لم يتغيّر إلا على
// جهاز واحد يُؤخذ كما هو من ذلك الجهاز، ولا يُفقَد أي قسم يخص الطرف الآخر. القاعدة
// المرجعية (base) هي آخر لقطة سحابية معروفة لهذا الجهاز (تُحدَّث عند كل قراءة/كتابة
// ناجحة) — بلا هذه اللقطة (أول حفظ في الجلسة قبل أي تحميل ناجح) نتراجع لمقارنة
// ثنائية بسيطة (محلي مقابل سحابي حالي) بدل دمج ثلاثي كامل. تعارض حقيقي (نفس القسم
// تغيّر على الطرفين معاً) نادر عملياً (أغلب التعديلات المتزامنة تمس خطوات/أقسام
// مختلفة من المعالج) ويُحسَم بإبقاء نسخة الجهاز الذي يحفظ الآن — تحسين جوهري على
// الوضع الحالي (فقدان كامل لكل الأقسام الأخرى) لا حلاً كاملاً لكل تعارض نظرياً ممكن.
const _remoteSnapshotCache = new Map();

function _deepEqual(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; }
}

function _deepClone(obj) {
    return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

/**
 * دمج ثلاثي على مستوى القسم الأعلى فقط (لا حقول فرعية، لا مصفوفات) — انظر تعليق
 * _remoteSnapshotCache أعلاه للسياق الكامل.
 * @param {object|null} base - آخر لقطة سحابية معروفة (null = لا مرجع، تراجع لثنائي)
 * @param {object} local - النسخة المطلوب حفظها من هذا الجهاز
 * @param {object} remote - النسخة الحالية فعلياً في السحابة الآن
 * @returns {object} النسخة المدموجة الواجب كتابتها
 */
function _mergeStudySections(base, local, remote) {
    const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
    const merged = {};
    for (const key of keys) {
        const localVal = local ? local[key] : undefined;
        const remoteVal = remote ? remote[key] : undefined;
        if (_deepEqual(localVal, remoteVal)) { merged[key] = localVal; continue; }
        if (!base) { merged[key] = localVal; continue; } // لا مرجع: نفضّل نسخة الجهاز الحافظ الآن
        const localChanged = !_deepEqual(localVal, base[key]);
        const remoteChanged = !_deepEqual(remoteVal, base[key]);
        if (remoteChanged && !localChanged) { merged[key] = remoteVal; continue; } // لم نمسّه هنا — لا نفقد تعديل الطرف الآخر
        merged[key] = localVal; // localChanged فقط، أو تعارض حقيقي على نفس القسم — نُبقي المحلي
    }
    return merged;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// دفعة 5 (2026-08-27، طبقة Availability): محاولة واحدة فقط كانت تكفي لتصنيف
// فشل عابر (مهلة شبكة قصيرة، 503 مؤقت من Supabase) كفشل نهائي — أشيع أنماط
// الفشل واقعياً transient لا يستدعي تدخلاً يدوياً. 3 محاولات بتأخير تصاعدي
// بسيط (500ms ثم 1500ms) قبل الاستسلام فعلياً لـcloudSyncFailed.
const CLOUD_SYNC_RETRY_DELAYS_MS = [500, 1500];

export class PersistenceService {

    /**
     * Save project data.
     * Always saves to LocalStorage.
     * If user is logged in, also attempts to sync to Supabase (debounced).
     * 
     * @param {string} id - Project ID (UUID)
     * @param {object} data - Full project JSON
     * @returns {Promise<{success: boolean, location: 'local'|'cloud'|'both', error?: string}>}
     */
    static async save(id, data) {
        try {
            // Clean data before saving (remove circular refs, ensure proper types)
            const cleanData = this._sanitize(data);

            // إضافة updated_at لحل التعارضات + بصمة إصدار المحرك (قرار لجنة
            // 2026-08-27، انظر engine.js:ENGINE_VERSION) — تُقارَن عند فتح
            // الدراسة لاحقاً (ProjectOverviewView) لتنبيه العميل إن تغيّرت
            // معادلات المحرك منذ آخر حفظ.
            let engineVersion = null;
            try { engineVersion = await _getEngineVersion(); } catch (_) { /* لا تمنع الحفظ لفشل الاستيراد */ }
            const dataWithMeta = { ...cleanData, _meta: { ...(cleanData._meta || {}), updatedAt: new Date().toISOString(), ...(engineVersion ? { engineVersion } : {}) } };
            await this._saveLocal(id, dataWithMeta);
            try {
                const { log, ACTIONS } = await _getAuditLogger();
                log(ACTIONS.SAVE, { id, location: 'local' });
            } catch (_) { }

            // 2. Cloud Save (offline: نجاح محلي فقط)
            // ملاحظة: _meta.updatedAt عمداً لا يُرفع هنا — العمود المستقل
            // updated_at في _saveCloud (نفسه المستخدم في حل التعارضات) هو
            // مصدر الحقيقة للسحابة، وتكراره داخل JSON زائد لا فائدة منه. أما
            // engineVersion فبلا عمود مستقل — يجب أن يصل ضمن JSON نفسه وإلا
            // اختفى تماماً للمستخدمين المسجَّلين (الأغلبية) رغم نجاحه محلياً.
            const cloudData = engineVersion
                ? { ...cleanData, _meta: { ...(cleanData._meta || {}), engineVersion } }
                : cleanData;
            const { getAuthUser } = await _getSupabase();
            const { user } = await getAuthUser();
            if (user) {
                const savedCloudData = await this._saveCloudWithRetry(id, cloudData, user.id);
                try {
                    const { log, ACTIONS } = await _getAuditLogger();
                    log(ACTIONS.SAVE, { id, location: 'both' });
                } catch (_) { }
                // دُمِج تعديل من جهاز آخر (انظر _mergeStudySections) — النسخة الفعلية
                // في السحابة الآن تحمل أقساماً هذا الجهاز لا يعرفها بعد؛ نُعيدها
                // للمستدعي (store.js) كي يحدّث حالته في الذاكرة والمسودة المحلية،
                // وإلا بقي هذا الجهاز يقارن بنسخة محلية ناقصة في الحفظ التالي.
                const merged = savedCloudData && !_deepEqual(savedCloudData, cloudData) ? savedCloudData : null;
                if (merged) await this._saveLocal(id, { ...dataWithMeta, ...merged });
                return { success: true, location: 'both', ...(merged ? { merged } : {}) };
            }

            return { success: true, location: 'local' };
        } catch (e) {
            console.error("PersistenceService.save error:", e);
            // بلوكر #43: فشل حفظ سحابي كان يُسجَّل بconsole فقط — لا يصل لأي مراقبة
            // (لا Sentry ولا سجل تدقيق)، فيختفي صامتاً حتى لو Sentry مضبوط فعلياً.
            try {
                const { monitoring } = await import('../utils/monitoring.js');
                monitoring.captureException(e, { source: 'PersistenceService.save', studyId: id });
            } catch (_) { /* لا نمنع نجاح الحفظ المحلي بسبب فشل الإبلاغ نفسه */ }
            // إبلاغ صادق: الحفظ المحلي نجح لكن المزامنة السحابية فشلت —
            // كان يُبلَّغ success بلا تمييز فتظهر رسالة «تم الحفظ» رغم فشل السحابة
            return { success: true, location: 'local', cloudSyncFailed: true, error: `Cloud sync failed: ${e.message}` };
        }
    }

    /**
     * Sanitizes data for storage (removes functions, handles undefined)
     */
    static _sanitize(data) {
        return JSON.parse(JSON.stringify(data, (key, value) => {
            if (value === undefined) return null;
            return value;
        }));
    }

    /**
     * Load project data.
     * Strategy: حل تعارضات المزامنة — last-write-wins حسب updated_at
     * 
     * @param {string} id 
     * @returns {Promise<{data: object|null, source: 'cloud'|'local'|null, error?: string}>}
     */
    static async load(id) {
        const localData = await this._loadLocal(id);
        const localTs = localData?._meta?.updatedAt ? new Date(localData._meta.updatedAt).getTime() : 0;

        const { getAuthUser } = await _getSupabase();
        const { user } = await getAuthUser();
        let cloudData = null;
        let cloudTs = 0;
        if (user) {
            try {
                const res = await this._loadCloudWithMeta(id);
                cloudData = res?.data || null;
                cloudTs = res?.updatedAt ? new Date(res.updatedAt).getTime() : 0;
            } catch (e) {
                console.warn("Cloud load failed, falling back to local:", e);
                // دفعة 6 (2026-08-27، اتساق المراقبة): نفس فجوة save() المُصلَحة سابقاً
                // (بلوكر #43) — فشل هنا كان يظهر بconsole فقط رغم أن التراجع للنسخة
                // المحلية قد يُخفي بيانات سحابية أحدث حقيقية عن العميل بصمت تام.
                try {
                    const { monitoring } = await import('../utils/monitoring.js');
                    monitoring.captureException(e, { source: 'PersistenceService.load', studyId: id });
                } catch (_) { /* لا نمنع التراجع للنسخة المحلية بسبب فشل الإبلاغ نفسه */ }
            }
        }

        // حل تعارضات: الأحدث يفوز
        if (cloudData && localData) {
            if (cloudTs >= localTs) {
                await this._saveLocal(id, cloudData);
                return { data: cloudData, source: 'cloud' };
            }
            await this._saveCloud(id, localData, user.id);
            return { data: localData, source: 'local' };
        }
        if (cloudData) {
            await this._saveLocal(id, cloudData);
            return { data: cloudData, source: 'cloud' };
        }
        if (localData) return { data: localData, source: 'local' };
        return { data: null, source: null };
    }

    /**
     * Delete project
     */
    static async delete(id) {
        this._deleteLocal(id);
        const { getAuthUser } = await _getSupabase();
        const { user } = await getAuthUser();
        if (user) {
            await this._deleteCloud(id);
        }
    }

    /**
     * List all projects (Headers only)
     * Merges local and cloud lists.
     */
    static async listHeaders() {
        const local = this._listLocalHeaders();
        let cloud = [];

        const { getAuthUser } = await _getSupabase();
        const { user } = await getAuthUser();
        if (user) {
            try {
                cloud = await this._listCloudHeaders(user.id);
            } catch (e) {
                console.warn("Cloud list failed:", e);
                // دفعة 6 (2026-08-27، اتساق المراقبة): نفس فجوة save()/load() — فشل هنا
                // بلا مراقبة يعني أن هذا الخطأ الحقيقي (الذي قد يحرم عميلاً مدفوعاً من
                // رؤية دراساته) لا يترك أي أثر يراه الأدمن عبر Sentry.
                try {
                    const { monitoring } = await import('../utils/monitoring.js');
                    monitoring.captureException(e, { source: 'PersistenceService.listHeaders' });
                } catch (_) { /* لا نمنع التراجع للقائمة المحلية بسبب فشل الإبلاغ نفسه */ }
                // فشل الجلب كان يُبتلع فتُرجَع قائمة محلية فارغة على جهاز جديد،
                // فتعرضها لوحة التحكم كـ«لا توجد دراسات محفوظة بعد» لعميل دراساته في
                // السحابة. الثابت: قائمة فارغة من هنا تعني فراغاً حقيقياً لا فشل قراءة —
                // فإن لم يبقَ شيء محلي نُبلّغ الفشل ليعرضه المستدعي كخطأ قابل لإعادة المحاولة.
                if (local.length === 0) {
                    throw new Error('تعذّر الوصول إلى دراساتك السحابية — تحقق من الاتصال وأعد المحاولة');
                }
            }
        }

        // Merge: Cloud wins on metadata if ID exists in both.
        // Actually, for a simple list, we just want unique IDs.
        const map = new Map();

        local.forEach(p => map.set(p.id, { ...p, source: 'local' }));
        cloud.forEach(p => {
            if (map.has(p.id)) {
                // If exists locally, mark as synced or prefer cloud metadata
                map.set(p.id, { ...map.get(p.id), ...p, source: 'synced' });
            } else {
                map.set(p.id, { ...p, source: 'cloud' });
            }
        });

        // بلا هذا الترتيب: قائمة المشاريع تخرج بترتيب دمج محلي/سحابي عشوائي فعلياً،
        // فـ"الأحدث" (projects[0] في لوحة التحكم وشريط الجودة) غير مضمون أن يكون كذلك.
        return Array.from(map.values())
            .sort((a, b) => new Date(b.lastModified || 0) - new Date(a.lastModified || 0));
    }

    // --- Local Storage Helpers ---

    static async _saveLocal(id, data) {
        const key = `${LOCAL_STORAGE_KEY_PREFIX}${id}`;
        const json = JSON.stringify(data);
        const stored = await compress(json);
        localStorage.setItem(key, stored);

        // Update index
        const idxKey = `${LOCAL_STORAGE_KEY_PREFIX}index`;
        let index = [];
        try {
            index = JSON.parse(localStorage.getItem(idxKey) || '[]');
        } catch { }

        const existingIdx = index.findIndex(x => x.id === id);
        const existingFolderId = existingIdx >= 0 ? (index[existingIdx].folderId || null) : null;

        // Runway: folderId عادة لا يكون جزءاً من مخطط projectInfo للويزارد (لا سؤال/حقل
        // له هناك) — فحين تُشغَّل هذه الدالة من حفظ الويزارد التلقائي (autoSave) بدل
        // إجراء تعيين المجلد نفسه من لوحة التحكم، لا يحمل data.projectInfo مفتاح
        // folderId إطلاقاً (undefined)، لا null. التمييز بين "المفتاح غائب" (المستدعي
        // لا يعرف عن المجلدات، فحافظ على القيمة الحالية) و"المفتاح موجود بقيمة null"
        // (المستخدم اختار «بدون مجلد» صراحة من القائمة المنسدلة) هو ما يمنع أن يمحو
        // الحفظ التلقائي تعيين المجلد الذي ضبطه المستخدم للتو من لوحة المشاريع.
        const hasFolderIdKey = !!data.projectInfo && Object.prototype.hasOwnProperty.call(data.projectInfo, 'folderId');

        // Update info in index (Runway: folderId for تنظيم)
        const info = {
            id,
            name: data.projectInfo?.name || 'مشروع جديد',
            lastModified: new Date().toISOString(),
            folderId: hasFolderIdKey ? (data.projectInfo.folderId || null) : existingFolderId,
            deleted: data.projectInfo?.deleted || false,
            deletedAt: data.projectInfo?.deletedAt || null
        };

        if (existingIdx >= 0) {
            index[existingIdx] = info;
        } else {
            index.push(info);
        }
        localStorage.setItem(idxKey, JSON.stringify(index));
    }

    static async _loadLocal(id) {
        const key = `${LOCAL_STORAGE_KEY_PREFIX}${id}`;
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const decompressed = await decompress(raw);
        try {
            return typeof decompressed === 'string' ? JSON.parse(decompressed) : decompressed;
        } catch {
            return null;
        }
    }

    static _deleteLocal(id) {
        localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}${id}`);
        // update index
        const idxKey = `${LOCAL_STORAGE_KEY_PREFIX}index`;
        let index = [];
        try { index = JSON.parse(localStorage.getItem(idxKey) || '[]'); } catch { }
        index = index.filter(x => x.id !== id);
        localStorage.setItem(idxKey, JSON.stringify(index));
    }

    static _listLocalHeaders() {
        const idxKey = `${LOCAL_STORAGE_KEY_PREFIX}index`;
        try {
            return JSON.parse(localStorage.getItem(idxKey) || '[]');
        } catch {
            return [];
        }
    }

    // --- Cloud Helpers (Supabase) ---

    /**
     * دفعة 5 (2026-08-27، طبقة Availability): يعيد محاولة _saveCloud حتى نجاحها
     * أو استنفاد كل المحاولات — فشل عابر واحد (مهلة شبكة، 503 مؤقت) لم يعد
     * يُسقِط المزامنة فوراً. يرمي خطأ المحاولة الأخيرة فقط إن فشلت الجميع
     * (نفس عقد _saveCloud الأصلي — المستدعي save() يلتقطه كما كان).
     */
    static async _saveCloudWithRetry(id, data, userId) {
        let lastError;
        for (let attempt = 0; attempt <= CLOUD_SYNC_RETRY_DELAYS_MS.length; attempt++) {
            try {
                return await this._saveCloud(id, data, userId);
            } catch (e) {
                lastError = e;
                if (attempt < CLOUD_SYNC_RETRY_DELAYS_MS.length) {
                    await sleep(CLOUD_SYNC_RETRY_DELAYS_MS[attempt]);
                }
            }
        }
        throw lastError;
    }

    static async _saveCloud(id, data, userId) {
        const { getSupabaseClient } = await _getSupabase();
        const { supabase } = await getSupabaseClient();
        if (!supabase) throw new Error("Supabase client not available");

        // تدقيق أمني (دفعة 6): حارس خفيف قبل الرفع السحابي — دفاع بالعمق إلى جانب RLS
        // (لا بديل عنها، بل طبقة إضافية). كانت data تُرفع كما هي بعد _sanitize فقط
        // (بلا فحص حجم أو شكل)، فحمولة مشوَّهة (ليست كائناً عادياً) أو ضخمة بشكل غير
        // طبيعي (خلل عميل أو تلاعب) تُكتب مباشرة في عمود JSONB دون أي حد أعلى.
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error("بيانات الدراسة غير صالحة للحفظ السحابي: يجب أن تكون كائناً (object)");
        }
        const MAX_CLOUD_PAYLOAD_CHARS = 5 * 1024 * 1024; // 5MB نصي — أكبر بكثير من أي دراسة حقيقية
        let serialized;
        try {
            serialized = JSON.stringify(data);
        } catch (e) {
            throw new Error(`تعذر تجهيز بيانات الدراسة للحفظ السحابي: ${e?.message || e}`);
        }
        if (!serialized || serialized.length > MAX_CLOUD_PAYLOAD_CHARS) {
            throw new Error(
                `حجم بيانات الدراسة (${serialized ? serialized.length : 0} حرف) يتجاوز الحد الأقصى المسموح به للحفظ السحابي (${MAX_CLOUD_PAYLOAD_CHARS} حرف)`
            );
        }

        // دمج ثلاثي مع أي تعديل وصل من جهاز/تبويب آخر منذ آخر مزامنة معروفة لهذا
        // الجهاز — انظر تعليق _remoteSnapshotCache/_mergeStudySections أعلى الملف.
        // maybeSingle (لا single) عمداً: دراسة جديدة لم تُحفَظ سحابياً بعد لا صف لها
        // إطلاقاً، وهذا متوقَّع تماماً لا خطأ.
        let dataToSave = data;
        try {
            const { data: existingRow } = await supabase
                .from(SUPA_TABLE_STUDIES)
                .select('data')
                .eq('id', id)
                .maybeSingle();
            const remoteData = existingRow?.data || null;
            if (remoteData && !_deepEqual(remoteData, data)) {
                dataToSave = _mergeStudySections(_remoteSnapshotCache.get(id) || null, data, remoteData);
            }
        } catch (_) {
            // فشل القراءة التمهيدية (شبكة، إلخ) لا يجوز أن يمنع الحفظ نفسه —
            // نتراجع لكتابة data كما هي بدل إسقاط الحفظ بالكامل بسبب خطوة تحسينية.
        }

        // كتابة واحدة إلى جدول studies الكنسي (user_id + data) — المخطط الموحّد.
        // data كاملة الدراسة تُخزَّن في عمود data (JSONB). لا نكتب status لتفادي
        // مخالفة قيد CHECK إن حملت projectInfo.status قيمة خارج المسموح.
        const studyRow = {
            id: id,
            user_id: userId,
            title: dataToSave.projectInfo?.name || 'مشروع جديد',
            data: dataToSave,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from(SUPA_TABLE_STUDIES)
            .upsert(studyRow);

        if (error) throw error;
        _remoteSnapshotCache.set(id, _deepClone(dataToSave));
        return dataToSave;
    }

    static async _loadCloud(id) {
        const res = await this._loadCloudWithMeta(id);
        return res?.data || null;
    }

    static async _loadCloudWithMeta(id) {
        const { getSupabaseClient } = await _getSupabase();
        const { supabase } = await getSupabaseClient();
        if (!supabase) return null;

        const { data, error } = await supabase
            .from(SUPA_TABLE_STUDIES)
            .select('data, updated_at')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (data?.data) _remoteSnapshotCache.set(id, _deepClone(data.data));
        return { data: data?.data || null, updatedAt: data?.updated_at };
    }

    static async _deleteCloud(id) {
        const { getSupabaseClient } = await _getSupabase();
        const { supabase } = await getSupabaseClient();
        if (!supabase) return;

        // Cascade delete should handle inputs if configured, but let's be safe
        const { error } = await supabase.from(SUPA_TABLE_STUDIES).delete().eq('id', id);
        // كان الخطأ يُبتلع بصمت — دراسة «محذوفة» تبقى في السحابة وتعود عند المزامنة
        if (error) throw new Error(`فشل الحذف السحابي: ${error.message}`);
    }

    static async _listCloudHeaders(userId) {
        const { getSupabaseClient } = await _getSupabase();
        const { supabase } = await getSupabaseClient();
        if (!supabase) return [];

        // studies table has 'title' (project name). Use it for listing.
        // تدقيق شامل 2026-09-16: عمود status لا يُكتب أبداً عند الحذف (deleteProject
        // يضبط projectInfo.deleted داخل JSON فقط، لتفادي قيد CHECK على status — انظر
        // _saveCloud أدناه)، وكان d.status يُقرأ هنا ثم يُسقَط بالكامل بلا استخدام. أي
        // دراسة مصدرها السحابة حصراً (بلا فهرس محلي سابق على هذا الجهاز) كانت تُفقد
        // علم الحذف تماماً — تعود «نشطة» على جهاز آخر وتغيب عن سلة المحذوفات هناك.
        // القراءة الآن من data.projectInfo مباشرة (نفس الحقل الذي يكتبه deleteProject
        // فعلياً)، بنفس شكل _listLocalHeaders (deleted/deletedAt).
        const { data, error } = await supabase
            .from(SUPA_TABLE_STUDIES)
            .select('id, title, updated_at, deleted:data->projectInfo->>deleted, deletedAt:data->projectInfo->>deletedAt')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        return data.map(d => ({
            id: d.id,
            name: (d.title && d.title.trim()) ? d.title.trim() : 'مشروع جديد',
            lastModified: d.updated_at,
            deleted: d.deleted === 'true',
            deletedAt: d.deletedAt ? Number(d.deletedAt) : null
        }));
    }
}
