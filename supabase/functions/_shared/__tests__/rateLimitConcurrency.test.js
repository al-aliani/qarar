/**
 * تدقيق 2026-08-29: rateLimit.ts/anonRateLimit.ts كانا (قبل هذا التغيير) ينفّذان
 * الحدّ كـ"تحقق-ثم-تسجيل" (check-then-increment) بخطوتين شبكيتين منفصلتين تماماً:
 * SELECT count(*) للتحقق، ثم — فقط إن كان دون الحد — INSERT منفصل للتسجيل.
 * rateLimit.test.js/anonRateLimit.test.js (المموَّهان بالكامل، استدعاء واحد
 * تسلسلي في كل اختبار) لا يمكنهما اكتشاف هذا العطل بنيوياً: لا يوجد فيهما أي
 * تنفيذ متزامن فعلي. هذا الملف مختلف تماماً في غرضه: إثبات آلية السباق نفسها
 * (لا سلوك الغلاف) عبر تنفيذ متزامن حقيقي (Promise.all ضد حالة مشتركة)، ثم
 * إثبات أن قفلاً استشارياً لكل مفتاح (نفس ما تنفّذه check_and_record_rate_limit/
 * check_and_record_anon_rate_limit عبر pg_advisory_xact_lock، migration
 * 20260829030000) يمنع التجاوز فعلياً تحت نفس ظروف التزامن بالضبط.
 *
 * لماذا نموذج محاكاة لا Postgres حقيقي: لا توجد في هذا المستودع أي بنية اختبار
 * تشغّل قاعدة بيانات حقيقية محلياً (لا `supabase start`، لا حاوية Postgres في
 * أي workflow — تحقَّق عبر بحث شامل قبل كتابة هذا الملف)؛ كل اختبار حرج بهذا
 * المشروع (بما فيه توقيع Webhook التشفيري بـwebhookVerify.ts) يُختبَر عبر
 * إعادة إنتاج المنطق بأساسيات Node قياسية بلا خدمة خارجية، بنفس المبدأ هنا.
 * الفارق الجوهري عن "تزييف متزامن ساذج" (الذي يرفضه العطل بالتصميم): كل
 * استدعاء "شبكي" هنا (قراءة/كتابة) يمرّ فعلياً عبر `await` حقيقي على مؤقّت
 * (setTimeout) بدل قيمة جاهزة متزامنة — هذا ما يسمح لحلقة الأحداث (event loop)
 * بمقاطعة/تشبيك (interleave) عدة استدعاءات متزامنة فعلياً قبل اكتمال أي منها،
 * تماماً كما تتشابك معاملتان (transactions) Postgres حقيقيتان متزامنتان في
 * الشبكة الحقيقية. النمط القديم أدناه (oldCheckThenInsert) نسخة طبق الأصل من
 * منطق rateLimit.ts/anonRateLimit.ts القديم (قبل هذا التغيير)؛ النمط الجديد
 * (atomicCheckAndRecord) يحاكي pg_advisory_xact_lock عبر قفل تسلسلي بالوعود
 * (promise-chained mutex) مفتاحه (user/ip، endpoint) — نفس مفتاح القفل الحقيقي
 * بالضبط.
 */
import { describe, it, expect } from 'vitest';

// يحاكي زمن استدعاء شبكي حقيقي (طلب PostgREST/RPC) — تأخير حقيقي عبر
// المؤقّت لا وعد محلول فوراً، كي تتشابك الاستدعاءات المتزامنة فعلاً عبر
// حلقة الأحداث بدل أن تُنفَّذ الواحدة تلو الأخرى صورياً.
function tick() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/** جدول أحداث حدّ المعدّل مموَّه بالكامل بالذاكرة — لا اتصال شبكي فعلي. */
class FakeRateLimitTable {
    constructor() {
        this.rows = [];
    }
    async countSince(key, endpoint, sinceMs) {
        await tick(); // جولة قراءة شبكية
        return this.rows.filter((r) => r.key === key && r.endpoint === endpoint && r.at >= sinceMs).length;
    }
    async insert(key, endpoint) {
        await tick(); // جولة كتابة شبكية منفصلة تماماً عن القراءة أعلاه
        this.rows.push({ key, endpoint, at: Date.now() });
    }
}

/**
 * النمط القديم المُصلَح بهذا التغيير — نسخة حرفية من منطق rateLimit.ts/
 * anonRateLimit.ts قبل الإصلاح: SELECT (count) ثم — فقط إن كان دون الحد —
 * INSERT، كخطوتين مستقلّتين تماماً بلا أي قفل بينهما.
 */
async function oldCheckThenInsert(table, key, endpoint, max, sinceMs) {
    const count = await table.countSince(key, endpoint, sinceMs);
    if (count >= max) return { ok: false };
    await table.insert(key, endpoint);
    return { ok: true };
}

/**
 * قفل تسلسلي بالوعود لكل مفتاح — يحاكي pg_advisory_xact_lock(key): استدعاء
 * جديد لنفس المفتاح ينتظر اكتمال (التزام) الاستدعاء السابق بالكامل قبل أن
 * يبدأ تنفيذه هو؛ مفاتيح مختلفة لا تحجب بعضها إطلاقاً (نفس دلالة القفل
 * الاستشاري الحقيقي: مُسلسِل لكل مفتاح فقط، لا قفل عام واحد).
 */
function makeKeyedLock() {
    const chains = new Map();
    return function withLock(lockKey, fn) {
        const prev = chains.get(lockKey) || Promise.resolve();
        const run = () => fn();
        const next = prev.then(run, run); // ننفّذ fn بعد استقرار prev سواء نجح أو فشل
        chains.set(lockKey, next.catch(() => {})); // لا نسمح لفشل استدعاء بكسر سلسلة الانتظار للاحقين
        return next;
    };
}

/**
 * النمط الذرّي الجديد — نفس جسم check_and_record_rate_limit/check_and_record_
 * anon_rate_limit بالضبط (قفل → قراءة العدّ → تحقّق → تسجيل)، لكن كل استدعاء
 * لنفس المفتاح مُسلسَل بدل متسابق.
 */
function makeAtomicChecker(table) {
    const withLock = makeKeyedLock();
    return function checkAndRecord(key, endpoint, max, sinceMs) {
        return withLock(`${key}:${endpoint}`, async () => {
            const count = await table.countSince(key, endpoint, sinceMs);
            if (count >= max) return { ok: false };
            await table.insert(key, endpoint);
            return { ok: true };
        });
    };
}

describe('سباق تزامن حدّ المعدّل — إثبات العطل القديم والإصلاح الذرّي بتنفيذ متزامن فعلي', () => {
    it('[إثبات الثغرة] النمط القديم (SELECT ثم INSERT منفصلان): طلبات متزامنة عند حدود الحد تتجاوزه بالكامل', async () => {
        const table = new FakeRateLimitTable();
        const MAX = 3;
        const CONCURRENT = 10;
        const sinceMs = Date.now() - 60_000;

        // كل الاستدعاءات العشرة تنطلق بنفس اللحظة (Promise.all) على نفس المفتاح —
        // كل استدعاء يقرأ العدّ (0) قبل أن يكمل أي استدعاء آخر تسجيله فعلياً،
        // لأن القراءة والكتابة كلتاهما تمران بجولة `tick()` منفصلة (انظر تعليق
        // الملف: هذا تشابك حقيقي عبر حلقة الأحداث، لا تكرار سيناريو مُعدّ يدوياً).
        const results = await Promise.all(
            Array.from({ length: CONCURRENT }, () => oldCheckThenInsert(table, 'user-1', 'create-checkout', MAX, sinceMs))
        );

        const succeeded = results.filter((r) => r.ok).length;
        // العطل الفعلي: كل الطلبات العشرة نجحت رغم أن الحد 3 فقط — كل استدعاء
        // رأى "دون الحد" في نفس اللحظة التي رآه فيها البقية، قبل أن يسجّل أيٌّ
        // منها شيئاً بعد.
        expect(succeeded).toBe(CONCURRENT);
        expect(table.rows).toHaveLength(CONCURRENT);
        expect(table.rows.length).toBeGreaterThan(MAX); // التجاوز الفعلي المُثبَت
    });

    it('[إثبات الإصلاح] النمط الذرّي (قفل استشاري لكل مفتاح): نفس التزامن بالضبط لا يتجاوز الحد أبداً', async () => {
        const table = new FakeRateLimitTable();
        const MAX = 3;
        const CONCURRENT = 10;
        const sinceMs = Date.now() - 60_000;
        const checkAndRecord = makeAtomicChecker(table);

        const results = await Promise.all(
            Array.from({ length: CONCURRENT }, () => checkAndRecord('user-1', 'create-checkout', MAX, sinceMs))
        );

        const succeeded = results.filter((r) => r.ok).length;
        // بالضبط الحد المسموح ينجح — البقية تُرفَض لأن كل استدعاء ينتظر التزام
        // الاستدعاء السابق فعلياً قبل أن يقرأ العدّ (لا يمكنه رؤية حالة قديمة).
        expect(succeeded).toBe(MAX);
        expect(table.rows).toHaveLength(MAX);
        expect(table.rows.length).toBeLessThanOrEqual(MAX);
    });

    it('[حبس النطاق] القفل يُسلسِل نفس المفتاح (مستخدم+دالة) فقط — مستخدمان مختلفان لا يحجب أحدهما الآخر', async () => {
        const table = new FakeRateLimitTable();
        const MAX = 2;
        const sinceMs = Date.now() - 60_000;
        const checkAndRecord = makeAtomicChecker(table);

        const [resultsA, resultsB] = await Promise.all([
            Promise.all(Array.from({ length: 5 }, () => checkAndRecord('user-A', 'create-checkout', MAX, sinceMs))),
            Promise.all(Array.from({ length: 5 }, () => checkAndRecord('user-B', 'create-checkout', MAX, sinceMs))),
        ]);

        expect(resultsA.filter((r) => r.ok)).toHaveLength(MAX);
        expect(resultsB.filter((r) => r.ok)).toHaveLength(MAX);
    });

    it('[تكرار الإثبات] نفس اختبار الثغرة/الإصلاح بحدّ وتزامن مختلفَين تماماً — النتيجة ليست خاصة بقيم معيّنة', async () => {
        const MAX = 1;
        const CONCURRENT = 6;
        const sinceMs = Date.now() - 60_000;

        const oldTable = new FakeRateLimitTable();
        const oldResults = await Promise.all(
            Array.from({ length: CONCURRENT }, () => oldCheckThenInsert(oldTable, 'user-2', 'places-nearby', MAX, sinceMs))
        );
        expect(oldResults.filter((r) => r.ok)).toHaveLength(CONCURRENT); // تجاوز كامل مرة أخرى

        const newTable = new FakeRateLimitTable();
        const checkAndRecord = makeAtomicChecker(newTable);
        const newResults = await Promise.all(
            Array.from({ length: CONCURRENT }, () => checkAndRecord('user-2', 'places-nearby', MAX, sinceMs))
        );
        expect(newResults.filter((r) => r.ok)).toHaveLength(MAX); // محصور بالحد تماماً
    });
});
