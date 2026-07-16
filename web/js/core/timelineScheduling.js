/**
 * timelineScheduling.js — منطق محرّك جدولة خطة التنفيذ (المسار الحرج، المسارات
 * الموازية، مخاطر التأخر، الربط بالتكلفة/التمويل). كل دالة هنا نقية (لا DOM
 * ولا شبكة) لتبقى قابلة للاختبار مباشرة؛ Timeline.js يستهلكها للعرض فقط.
 *
 * نموذج البيانات المتوقَّع لكل نشاط: { id, name, category, startMonth, duration,
 * dependsOn?: (string|number)[] } — dependsOn حقل اختياري جديد، أي نشاط بلا هذا
 * الحقل يُعامَل كمستقل (بلا تبعيات) حفاظاً على توافق الخطط المحفوظة سابقاً.
 */

function toId(v) { return String(v); }

/** خريطة id → نشاط، وaid → قائمة معرّفات تعتمد عليه هذا النشاط (dependsOn مُطبَّعة لنصوص). */
function buildGraph(activities) {
    const byId = new Map();
    (activities || []).forEach(a => { if (a && a.id != null) byId.set(toId(a.id), a); });
    const deps = new Map(); // id -> Set(dependsOn ids موجودة فعلاً فقط)
    byId.forEach((a, id) => {
        const raw = Array.isArray(a.dependsOn) ? a.dependsOn : [];
        deps.set(id, new Set(raw.map(toId).filter(d => byId.has(d) && d !== id)));
    });
    return { byId, deps };
}

/** ترتيب طوبولوجي (Kahn) — يعيد null عند وجود دورة (لا نرمي، الدورة بيانات مستخدم واقعية محتملة). */
function topoOrder(byId, deps) {
    const inDegree = new Map();
    byId.forEach((_, id) => inDegree.set(id, 0));
    deps.forEach((set) => set.forEach(dep => {})); // no-op placeholder for clarity
    // inDegree[id] = عدد التبعيات التي يعتمد عليها id (وليس العكس) — نحسبها من deps مباشرة.
    byId.forEach((_, id) => inDegree.set(id, deps.get(id)?.size || 0));

    const queue = [...byId.keys()].filter(id => inDegree.get(id) === 0);
    const order = [];
    const remaining = new Map(inDegree);
    // معتمِدون على كل id (عكس deps) — لتقليل inDegree عند إنجاز id.
    const dependents = new Map();
    byId.forEach((_, id) => dependents.set(id, []));
    deps.forEach((set, id) => set.forEach(dep => dependents.get(dep)?.push(id)));

    while (queue.length) {
        const id = queue.shift();
        order.push(id);
        (dependents.get(id) || []).forEach(dependentId => {
            remaining.set(dependentId, remaining.get(dependentId) - 1);
            if (remaining.get(dependentId) === 0) queue.push(dependentId);
        });
    }

    if (order.length !== byId.size) return null; // دورة تمنع ترتيباً كاملاً
    return { order, dependents };
}

/**
 * المسار الحرج (CPM قياسي): earliestStart/Finish (تمريرة أمامية من المدد+التبعيات)
 * ثم latestStart/Finish (تمريرة خلفية من نهاية المشروع)، slack = latestStart - earliestStart،
 * حرج إن slack=0. يتجاهل startMonth المُدخل يدوياً عمداً — هذا جدول "المدة الدنيا
 * الممكنة نظرياً" لا الجدول الفعلي المُدخل، ليكشف فجوات/تأخيرات حين تُقارَن.
 * @returns {{ok:true, totalDuration:number, byId:Object}|{ok:false, reason:'cycle'|'empty'}}
 */
export function computeCriticalPath(activities) {
    const { byId, deps } = buildGraph(activities);
    if (!byId.size) return { ok: false, reason: 'empty' };

    const topo = topoOrder(byId, deps);
    if (!topo) return { ok: false, reason: 'cycle' };

    const earliestStart = new Map();
    const earliestFinish = new Map();
    topo.order.forEach(id => {
        const a = byId.get(id);
        const dur = Math.max(0, Number(a.duration) || 0);
        const depSet = deps.get(id);
        const es = depSet.size
            ? Math.max(...[...depSet].map(d => earliestFinish.get(d) || 0))
            : 0;
        earliestStart.set(id, es);
        earliestFinish.set(id, es + dur);
    });

    const totalDuration = Math.max(0, ...[...earliestFinish.values()]);

    const latestFinish = new Map();
    const latestStart = new Map();
    [...topo.order].reverse().forEach(id => {
        const a = byId.get(id);
        const dur = Math.max(0, Number(a.duration) || 0);
        const lf = topo.dependents.get(id).length
            ? Math.min(...topo.dependents.get(id).map(dep => latestStart.get(dep)))
            : totalDuration;
        latestFinish.set(id, lf);
        latestStart.set(id, lf - dur);
    });

    const result = {};
    byId.forEach((a, id) => {
        const slack = latestStart.get(id) - earliestStart.get(id);
        result[id] = {
            earliestStart: earliestStart.get(id),
            earliestFinish: earliestFinish.get(id),
            latestStart: latestStart.get(id),
            latestFinish: latestFinish.get(id),
            slack,
            isCritical: slack === 0
        };
    });

    return { ok: true, totalDuration, byId: result };
}

/** مجموعة أسلاف نشاط (تبعياته المباشرة وغير المباشرة) — لفحص الاستقلالية بين نشاطين. */
function ancestorsOf(id, deps, cache = new Map()) {
    if (cache.has(id)) return cache.get(id);
    const acc = new Set();
    (deps.get(id) || new Set()).forEach(dep => {
        acc.add(dep);
        ancestorsOf(dep, deps, cache).forEach(a => acc.add(a));
    });
    cache.set(id, acc);
    return acc;
}

/**
 * اقتراح مسارات موازية: تجميع استرشادي (لا حل أمثل) — نشاطان "مستقلان" إن لم
 * يكن أحدهما سلفاً للآخر في شجرة التبعيات. تجميع جشع (greedy graph coloring)
 * بترتيب earliestStart من computeCriticalPath: كل نشاط ينضم لأول مجموعة كل
 * أعضائها مستقلون عنه، وإلا يبدأ مجموعة جديدة.
 * @returns {{ok:true, groups: string[][]}|{ok:false, reason:'cycle'|'empty'}}
 */
export function suggestParallelTracks(activities) {
    const cpm = computeCriticalPath(activities);
    if (!cpm.ok) return cpm;

    const { deps } = buildGraph(activities);
    const cache = new Map();
    const ids = Object.keys(cpm.byId).sort((a, b) => cpm.byId[a].earliestStart - cpm.byId[b].earliestStart);

    const independent = (a, b) => {
        const ancA = ancestorsOf(a, deps, cache);
        const ancB = ancestorsOf(b, deps, cache);
        return !ancA.has(b) && !ancB.has(a);
    };

    const groups = [];
    ids.forEach(id => {
        const target = groups.find(g => g.every(member => independent(id, member)));
        if (target) target.push(id);
        else groups.push([id]);
    });

    return { ok: true, groups };
}

/** نطاقات تباين تقديرية عامة لكل تصنيف (مرجع تقريبي واحد، ليست بيانات مقيسة) — يُعرَّف
 * صراحة كافتراض استرشادي في الواجهة، لا كنسبة تأخر مقيسة من دراسات فعلية. */
export const DELAY_RISK_VARIANCE = Object.freeze({
    legal: 0.30,
    technical: 0.20,
    hr: 0.10,
    marketing: 0.15,
    launch: 0.10
});

/** يعيد نطاق تأخر تقريبي (بالأشهر) لكل نشاط حسب تصنيفه. */
export function estimateDelayRisk(activities) {
    return (activities || []).map(a => {
        const variance = DELAY_RISK_VARIANCE[a?.category] ?? DELAY_RISK_VARIANCE.technical;
        const duration = Math.max(0, Number(a?.duration) || 0);
        const extraMonths = Math.round(duration * variance * 10) / 10;
        return { id: a?.id, category: a?.category, variance, extraMonths };
    });
}

/**
 * تدفق نقدي زمني حقيقي من الأنشطة المرتبطة ببنود تأسيس فعلية — الربط بالاسم
 * (costItemName) لا بمعرّف، لأن establishmentCosts (DynamicTable) لا تُعطي صفوفها
 * معرّفاً ثابتاً؛ الربط بالاسم أكثر مقاومة لإعادة الترتيب من الاعتماد على الفهرس.
 * @returns {Record<number, number>} شهر (1-12) → إجمالي تكلفة تأسيس مرتبطة تبدأ فيه
 */
export function computeLinkedCashFlow(activities, establishmentCosts) {
    const costsByName = new Map(
        (establishmentCosts || [])
            .filter(c => c && c.name)
            .map(c => [c.name.trim(), Number(c.amount) || 0])
    );
    const byMonth = {};
    (activities || []).forEach(a => {
        if (!a?.costItemName) return;
        const amount = costsByName.get(a.costItemName.trim());
        if (!amount) return;
        const month = Math.max(1, Math.min(12, Number(a.startMonth) || 1));
        byMonth[month] = (byMonth[month] || 0) + amount;
    });
    return byMonth;
}

/**
 * تنبيه تصادم سيولة: يقارن التكلفة التراكمية المرتبطة بالجدول الزمني (حتى كل شهر)
 * برأس المال المُدخَل فعلياً (حقوق ملكية + قرض بنكي مُدخلان من شاشة التمويل) — لا
 * نموذج جدولة صرف حقيقي لأن هذا التطبيق لا يملك مفهوم "جدول صرف القرض" أصلاً،
 * فالافتراض الوحيد الصادق هو توفر كامل رأس المال المُدخل منذ الشهر الأول (لا نخترع
 * جدول صرف غير موجود في المحرك، ولا نستخدم paidCapital المُشتقة داخل calculateStudy
 * لتفادي حلقة اعتماد على المحرك الكامل من شاشة عرض بسيطة).
 * @returns {{month:number, required:number, available:number, shortfall:number}[]}
 */
export function checkFinancingCollision(activities, establishmentCosts, financing) {
    const byMonth = computeLinkedCashFlow(activities, establishmentCosts);
    const available = Number(financing?.sources?.equity?.amount || 0) + Number(financing?.sources?.bankLoan?.amount || 0);
    if (!available) return [];

    const months = Object.keys(byMonth).map(Number).sort((a, b) => a - b);
    let cumulative = 0;
    const warnings = [];
    months.forEach(month => {
        cumulative += byMonth[month];
        if (cumulative > available) {
            warnings.push({ month, required: cumulative, available, shortfall: cumulative - available });
        }
    });
    return warnings;
}
