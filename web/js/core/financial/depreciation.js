function toArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
}

function rateOrDefault(v, dflt) {
    if (v === null || v === undefined || v === '') return dflt;
    const n = Number(v);
    return Number.isFinite(n) ? n : dflt;
}

/**
 * إهلاك عنصر في سنة مُعيَّنة — يُوقِف الإهلاك بعد life، وتستوعب السنة الأخيرة (yr === life)
 * كامل المتبقي من base مهما كان اتجاه انحراف التقريب.
 *
 * لماذا: life = Math.round(1/rate) تقريب لأقرب سنة، فـ life × rate ≠ 1 عموماً — والانحراف
 * ذو اتجاهين:
 *   • تجاوز (life × rate > 1): rate = 0.15 ⇒ life = 7 ⇒ 7 × 0.15 = 1.05. السقف القديم
 *     min(dep, remaining) كان يعالج هذا وحده، والسنة السابعة تُقيَّد عند
 *     remaining = base − 6 × 0.15 × base = 0.10 × base. السلوك هنا لم يتغيّر إطلاقاً.
 *   • نقص  (life × rate < 1): rate = 0.30 ⇒ life = 3 ⇒ 3 × 0.30 = 0.90، وrate = 0.80
 *     ⇒ life = 1 ⇒ 0.80. min(dep, remaining) لا يراه أصلاً، فيُسرَّب 10% (أو 20%) من الأصل
 *     بلا إهلاك إلى الأبد — ومع دورة الإحلال صار التسريب يتكرر لكل جيل لا مرة واحدة
 *     (معدة 100,000 بنسبة 0.80 تُستبدل كل سنة بكامل ثمنها ويُهلَك 80% فقط ⇒ صافي الأصول
 *     الثابتة ينمو 20,000/سنة بلا سقف). (إصلاح 2026-08-25)
 *
 * الثابت المضمون الآن: Σ_{yr=1..life} dep(yr) = base بالضبط لأي rate > 0.
 * ملاحظة: remaining في السنة الأخيرة موجب دائماً — لأن life ≤ 1/rate + 0.5 ⇒
 * rate × (life − 1) ≤ 1 − 0.5 × rate < 1 — فـ Math.max(0, …) حزام أمان لا أكثر.
 */
export function itemDepAtYear(it, yr) {
    if (!(it.life > 0) || yr > it.life) return 0;
    const remaining = it.base - it.dep * (yr - 1);
    if (yr >= it.life) return Math.max(0, remaining);   // السنة الأخيرة تستوعب المتبقي كاملاً
    return Math.max(0, Math.min(it.dep, remaining));
}

/**
 * إهلاك عنصر قابل للإحلال في السنة yr، شاملاً أصول الإحلال المشتراة في سنوات سابقة.
 * (إصلاح 2026-08-25)
 *
 * العيب المُصلَح: replaceableItems كانت تُبنى مرة واحدة من المدخلات الأصلية فقط، فبعد
 * yr > life يُعيد itemDepAtYear صفراً إلى الأبد بينما getReplacementCostAtYear يُحمِّل ثمن
 * الأصل البديل نقداً — أصل يُشترى ويُرسمَل في الأصول الثابتة ولا يُهلَك أبداً.
 *
 * دالة خالصة من yr وحدها (لا حالة متراكمة قابلة للتلوث): تُشتقّ «الجيل» النشط حسابياً،
 * فتصح بأي ترتيب استدعاء وبأي عدد مرات.
 *
 * دفعات الإحلال تقع في السنوات p_k = k·L + 1 لِـ k ≥ 1 (نفس شرط getReplacementCostAtYear:
 * (yr-1) % L === 0 && yr > 1)، فكل جيل يغطي بالضبط L سنة ولا تتداخل الأجيال — الجيل k يغطي
 * السنوات k·L+1 .. (k+1)·L. إذن لكل سنة جيل واحد نشط فقط:
 *     k = floor((yr-1)/L)،  والعمر داخله a = yr − k·L   حيث 1 ≤ a ≤ L
 * الأساس = base للجيل 0 (الأصل الأصلي)، وreplacementBase لكل جيل k ≥ 1.
 * سنة الجيل الأخيرة (نفس منطق itemDepAtYear بعد إصلاح 2026-08-25) تستوعب المتبقي كاملاً،
 * فيتحقق Σ إهلاك الجيل = أساسه بالضبط: لا تجاوز (يكسر هوية الميزانية عبر قصّ Math.max(0,…)
 * في balanceSheet.js:46) ولا نقص (كان يُسرَّب لكل جيل على حدة فينمو صافي الأصول الثابتة
 * بلا سقف مع كل دورة إحلال).
 * عند k = 0 تُعيد هذه الدالة نفس قيمة itemDepAtYear حرفياً (a = yr) — لا انحراف في سلوك
 * الأصل الأصلي.
 */
export function replaceableItemDepAtYear(it, yr) {
    const life = it.life;
    if (!(life > 0) || !(yr >= 1)) return 0;
    const generation = Math.floor((yr - 1) / life);
    const age = yr - generation * life;               // 1..life
    const base = generation === 0 ? it.base : it.replacementBase;
    const dep = generation === 0 ? it.dep : it.replacementDep;
    const remaining = base - dep * (age - 1);
    if (age >= life) return Math.max(0, remaining);   // السنة الأخيرة من الجيل تستوعب المتبقي
    return Math.max(0, Math.min(dep, remaining));
}

export function buildDepreciationModel(ctx) {
    const {
        technical,
        techResources,
        capexBreakdown,
        launchStrategy,
        getSaving,
        // إطفاء التأسيس لسنة مُعيَّنة (engine.js) — كان يُمرَّر كمجموع ثابت
        // establishmentAmortization، وهو ليس بالضرورة شحن السنة الأولى بعد تقييد
        // itemDepAtYear. الافتراضي دالةُ صفرٍ: توافق خلفي لأي مستدعٍ لا يمرّرها. (2026-08-25)
        establishmentAmortAtYear = () => 0,
        // نسبة الطوارئ الفعلية المستخدمة في رسملة المعدات (engine.js:214): contingencyRate
        // المُدخل + نصف علاوة المخاطر. الافتراضي 0.10 يطابق القيمة الافتراضية في المحرك
        // (توافق خلفي لأي مستدعٍ لا يمرّرها). (2026-08-25)
        computedContingencyRate = 0.10
    } = ctx;

    // إصلاح 2026-08-25: كان المعامل مصمتاً على 1.10 بينما engine.js يُرسمِل المعدات بـ
    // (1 + computedContingencyRate) (engine.js:414-416) — يتطابقان صدفةً فقط عند 0.10 بالضبط.
    // أي تجاوز صريح من المستخدم لـcontingencyRate، أو أي علاوة مخاطر > 0، كان يفصل أساس
    // الإهلاك عن المبلغ المُرسمَل فعلاً؛ وعند نسبة أقل من 10% كان أساس الإهلاك يتجاوز الأصل
    // المُرسمَل فيقصّه Math.max(0,…) في lib/calc/balanceSheet.js:46 وتنكسر هوية الميزانية.
    const equipmentScale = (launchStrategy === 'Outsourcing' ? 0.3 : (launchStrategy === 'Pilot_Phase' ? 0.5 : 1.0)) * (1 + computedContingencyRate);

    // تدقيق حي 2026-07-22: buildReplaceable كان يقبل flatRate لإجبار مبلغ الإهلاك على
    // defaultRate (15%) بصرف النظر عن نسبة الاستهلاك التي يُدخلها العميل لكل قطعة معدات —
    // بينما نفس النسبة المُدخلة تُستخدم فعلاً لحساب عمر الأصل (life) وتوقيت إعادة الشراء.
    // النتيجة: عميل يُدخل نسبة استهلاك أسرع (مثلاً 30%) يرى عمراً أقصر صحيحاً، لكن مبلغ
    // الإهلاك السنوي المعروض يبقى محسوباً وكأنه 15% دائماً — تناقض داخلي، وخلافاً تماماً
    // لفئتي الأثاث والموارد التقنية أدناه اللتين تستخدمان نسبة العميل للمبلغ والعمر معاً.
    // لا مبرر موثَّق لهذا الاستثناء، فأُزيل ليتسق مع بقية الفئات.
    const buildReplaceable = (arr, defaultRate, category, scale) => toArray(arr).map(item => {
        const cost = Number(item.price || item.cost || 0);
        const qty = Number(item.quantity || item.count || 1);
        const itemRate = rateOrDefault(item.depreciationRate, defaultRate);
        const saving = getSaving(category);
        const base = cost * qty * (1 - saving) * scale;
        // 2026-08-25 (تصحيح لاحق في نفس اليوم): أساس الأصل البديل = base نفسه، لا cost*qty
        // الخام. المحاولة الأولى أبقته خاماً بحجة أن الخصم/الطوارئ/مضاعِف الاستراتيجية
        // «تخصّ لحظة التأسيس» — وهذا خطأ: هذه الثلاثة ليست بنود تأسيس بل نمذجة للأصل نفسه،
        // فمشروع باستراتيجية Outsourcing (مضاعِف 0.3) كان يُرسمِل 66,000 معدات ثم يُنفق
        // 200,000 «إحلالاً» لنفس الأصل — إنفاق 3× ما يملكه، وقفزة إهلاك موجبة في سنة الإحلال.
        // الأصل البديل هو نفس الأصل بنفس نمذجته ⇒ نفس الأساس. أثر مقصود: تدفّق الإحلال
        // النقدي ينخفض لمشاريع Outsourcing/Pilot_Phase وللأصول ذات الخصم المؤسسي، ويرتفع
        // بمقدار الطوارئ. ومكسب بنيوي: كل الأجيال متطابقة ⇒ «المُرسمَل = المُهلَك» بالبناء
        // ولا قفزة في EBIT عند الإحلال. (getReplacementCostAtYear أدناه يقرأ نفس الحقل.)
        const replacementBase = base;
        return {
            // اسم/فئة العنصر — لبناء جدول إهلاك مسمّى لكل أصل (assetSchedule) بدل تجميعه
            // في رقم فئة واحد فقط؛ لا يغيّر أي مستهلك حالي (يستخدم فقط .dep/.life).
            name: item.name || item.label || category,
            category,
            base, dep: base * itemRate, life: itemRate > 0 ? Math.round(1 / itemRate) : 0,
            replacementBase, replacementDep: replacementBase * itemRate
        };
    });

    const replaceableItems = [
        ...buildReplaceable(technical.equipment, 0.15, 'Equipment', equipmentScale),
        ...buildReplaceable(technical.furniture, 0.20, 'Furniture', 1),
        ...buildReplaceable(techResources.techResources, 0.25, 'TechResources', 1)
    ];

    // 2026-08-25: صار يستدعي replaceableItemDepAtYear (لا itemDepAtYear) كي يُهلَك الأصل
    // البديل المشترى في سنة الإحلال بدل توقّف الإهلاك للأبد بعد استنفاد عمر الأصل الأصلي.
    const replaceableDepAtYear = (yr) => replaceableItems.reduce(
        (d, it) => d + replaceableItemDepAtYear(it, yr), 0);

    // تدقيق حي 2026-07-22: buildings/vehicles/servicesCapex («الفئات الدائمة») كانت تُهلَك
    // بمبلغ ثابت (permanentAnnualDep المُشتقّ سابقاً) كل سنة إلى الأبد بلا سقف — فبعد انتهاء
    // عمرها الافتراضي (buildings 5%=20 سنة، vehicles 20%=5 سنوات، servicesCapex 15%≈6.7
    // سنوات) يستمر القيد فيتجاوز تراكم الإهلاك تكلفة الأصل نفسها، فتختل هوية الميزانية
    // (isBalanced=false) بمجرد تجاوز أفق الدراسة عمر أحد هذه الأصول. الإصلاح: نفس مبدأ
    // replaceableItems أعلاه تماماً — كل عنصر يتوقف إهلاكه عند نهاية عمره الافتراضي (life).
    const permanentItems = [
        ...toArray(technical.buildings).map(item => {
            const cost = Number(item.price || item.cost || 0);
            const qty = Number(item.quantity || item.count || 1);
            const rate = rateOrDefault(item.depreciationRate, 0.05);
            const saving = getSaving('Buildings');
            const base = cost * qty * (1 - saving);
            return { base, dep: base * rate, life: rate > 0 ? Math.round(1 / rate) : 0 };
        }),
        ...toArray(technical.vehicles).map(item => {
            const cost = Number(item.price || item.cost || 0);
            const qty = Number(item.quantity || item.count || 1);
            const rate = rateOrDefault(item.depreciationRate, 0.20);
            const saving = getSaving('Vehicles');
            const base = cost * qty * (1 - saving);
            return { base, dep: base * rate, life: rate > 0 ? Math.round(1 / rate) : 0 };
        }),
        ...(capexBreakdown.servicesCapex > 0 ? [{ base: capexBreakdown.servicesCapex, dep: capexBreakdown.servicesCapex * 0.15, life: Math.round(1 / 0.15) }] : [])
    ];
    const permanentDepAtYear = (yr) => permanentItems.reduce(
        (d, it) => d + itemDepAtYear(it, yr), 0);

    // 2026-08-25: مشتقّة من replaceableItems نفسها (لا من إعادة قراءة المصفوفات الخام) كي
    // يكون «المبلغ المُرسمَل = أساس الإهلاك» خاصية بناء لا مصادفة صيانة: كلاهما replacementBase.
    // التوقيت مطابق 1:1 للسلوك السابق (نفس المصفوفات الثلاث بنفس ترتيبها، نفس النسب
    // الافتراضية، ونفس life: rate ≤ 0 ⇒ life = 0 ⇒ لا إحلال). أما المبلغ فتغيّر عمداً في
    // نفس اليوم (ع-2): replacementBase = base المُقيَّس لا cost×qty الخام.
    const getReplacementCostAtYear = (yr) => replaceableItems.reduce((acc, it) => {
        if (!(it.life > 0) || yr <= 1) return acc;
        return acc + (((yr - 1) % it.life === 0) ? it.replacementBase : 0);
    }, 0);

    /**
     * نفس مبلغ الإحلال أعلاه لكن مُفصَّلاً بفئة الأصل — يحتاجه المحرك لإضافة الأصل
     * البديل إلى **مجموعة الإهلاك الزكوي/الضريبي الصحيحة** (ZATCA بالقسط المتناقص:
     * معدات وموارد تقنية 25%، أثاث 10%). بلا التفصيل كان لا بدّ من افتراض مجموعة
     * واحدة لكل الإحلال، وهو تحريف: أثاث بنسبة 25% بدل 10% يُبالغ في الإهلاك النظامي.
     * الفئات هي نفسها المستعملة في buildReplaceable ('Equipment' | 'Furniture' |
     * 'TechResources')، ومجموع القيم = getReplacementCostAtYear(yr) بحكم البناء.
     */
    const getReplacementByCategoryAtYear = (yr) => replaceableItems.reduce((acc, it) => {
        if (!(it.life > 0) || yr <= 1) return acc;
        if ((yr - 1) % it.life !== 0) return acc;
        acc[it.category] = (acc[it.category] || 0) + it.replacementBase;
        return acc;
    }, {});

    // «الإهلاك السنوي الرسمي» المعروض للمستخدم (AssetsPortfolioView.js:59) والمُصدَّر في
    // result.depreciation وdepreciationSchedules.book، وهو أيضاً احتياط الميزانية عند غياب
    // جدول قائمة الدخل (lib/calc/balanceSheet.js:39).
    //
    // إصلاح 2026-08-25 (الدفعة الثالثة): كان يُحسب بمسار موازٍ (Σ base × rate لكل فئة +
    // مكوّن معدات مشتق) يتفرّع عن الشحن الفعلي بمجرد أن يقيّد itemDepAtYear الأساس. الدفعة
    // الثانية جعلت السنة الأولى تستوعب كامل الأساس عند life = 1، ففتحت الفجوة: أثاث
    // 100k@0.7 + موارد تقنية 80k@0.8 + مبنى 50k@0.8 + مركبة 60k@0.9 ⇒ البطاقة 228,000
    // بينما قائمة الدخل تشحن 290,000 (تبخيس 21%). الآن مشتق حرفياً من نفس دوال قائمة الدخل
    // للسنة الأولى (engine.js: permanentDepAtYear(i) + replaceableDepAtYear(i) +
    // establishmentAmortAtYear(i))، فالتطابق خاصية بناء لا مصادفة صيانة.
    const annualDepreciation =
        permanentDepAtYear(1) + replaceableDepAtYear(1) + establishmentAmortAtYear(1);

    return {
        annualDepreciation,
        permanentDepAtYear,
        replaceableDepAtYear,
        getReplacementCostAtYear,
        getReplacementByCategoryAtYear,
        // مُصدَّرة لأول مرة — تُستهلك في engine.js لبناء result.assetSchedule (جدول
        // إهلاك مسمّى لكل أصل بدل رقم فئة مجمّع فقط).
        replaceableItems
    };
}
