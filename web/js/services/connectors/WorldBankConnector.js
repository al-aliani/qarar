/**
 * WorldBankConnector — مؤشرات الاقتصاد الكلّي للسعودية من واجهة البنك الدولي الحيّة المجانية.
 *
 * بديل قانوني لـ SAMA: بيانات البنك الدولي مفتوحة (CC BY-4.0) بلا مفتاح API.
 *   - 'macro.inflation'  → المؤشر FP.CPI.TOTL.ZG  (تضخّم CPI % سنوياً YoY)
 *   - 'macro.gdpGrowth'  → المؤشر NY.GDP.MKTP.KD.ZG (نمو الناتج المحلي % سنوياً)
 *
 * نقطة النهاية:
 *   GET https://api.worldbank.org/v2/country/SAU/indicator/<INDICATOR>?format=json&mrv=1
 *   الاستجابة: [meta, [ { date, value } ]]. نأخذ آخر قيمة غير null.
 *
 * ملاحظة تحويل الوحدة: محرّك «قرار» يتوقّع assumptions.inflationRate ككسر (مثل 0.02).
 *   لذا 'macro.inflation' تُرجع value = pct/100 (كسر). أمّا 'macro.gdpGrowth' فتُرجع
 *   value = pct (رقم نسبة مئوية) بوحدة '%'.
 *
 * دفاعي بالكامل: يحرس typeof fetch (بيئة node)، ولا يرمي أبداً — عند أي فشل/فراغ يعيد unavailable(...).
 */

import { datum, unavailable, PROVENANCE, registerConnector } from '../DataConnectors.js';

const BASE = 'https://api.worldbank.org/v2/country/SAU/indicator';

const INDICATORS = Object.freeze({
    inflation: 'FP.CPI.TOTL.ZG',   // CPI inflation % YoY
    gdpGrowth: 'NY.GDP.MKTP.KD.ZG' // GDP growth % annual
});

/**
 * محلّل استجابة البنك الدولي — يستخرج آخر نقطة بيانات غير null.
 * مُصدَّر كتصدير مُسمّى للاختبار بلا شبكة.
 *
 * @param {*} json  الاستجابة المُفكّكة: [meta, [ { date, value } ]]
 * @returns {{ pct:number, year:string } | null}  النسبة المئوية والسنة، أو null إن تعذّر.
 */
export function parseWorldBankLatest(json) {
    if (!Array.isArray(json) || json.length < 2) return null;
    const rows = json[1];
    if (!Array.isArray(rows)) return null;
    // نبحث عن أوّل صفّ بقيمة عددية محدّدة (mrv=1 يعيد الأحدث، لكن نبقى دفاعيين).
    for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const v = row.value;
        if (v === null || v === undefined) continue;
        const num = Number(v);
        if (!Number.isFinite(num)) continue;
        return { pct: num, year: row.date != null ? String(row.date) : '' };
    }
    return null;
}

/**
 * جلب مؤشر واحد وتحويله إلى Datum حسب مفتاحه.
 * @param {'inflation'|'gdpGrowth'} kind
 * @returns {Promise<import('../DataConnectors.js').Datum>}
 */
async function fetchIndicator(kind) {
    if (typeof fetch !== 'function') {
        return unavailable('تعذّر جلب مؤشر World Bank');
    }
    const indicator = INDICATORS[kind];
    const url = `${BASE}/${indicator}?format=json&mrv=1`;

    let json;
    try {
        const res = await fetch(url);
        if (!res || !res.ok) return unavailable('تعذّر جلب مؤشر World Bank');
        json = await res.json();
    } catch {
        return unavailable('تعذّر جلب مؤشر World Bank');
    }

    const latest = parseWorldBankLatest(json);
    if (!latest) return unavailable('تعذّر جلب مؤشر World Bank');

    const common = {
        source: 'World Bank',
        sourceUrl: 'https://data.worldbank.org',
        year: latest.year,
        provenance: PROVENANCE.SOURCED
    };

    if (kind === 'inflation') {
        // المحرّك يتوقّع كسراً: 2.34% → 0.0234
        return datum(latest.pct / 100, {
            ...common,
            unit: 'نسبة/سنة',
            note: 'CPI YoY — محوّل لكسر'
        });
    }
    // gdpGrowth: نُبقيها نسبة مئوية
    return datum(latest.pct, {
        ...common,
        unit: '%'
    });
}

/** موصّل التضخّم (كسر). */
export function worldBankInflationConnector() {
    return fetchIndicator('inflation');
}

/** موصّل نمو الناتج المحلي (نسبة مئوية). */
export function worldBankGdpGrowthConnector() {
    return fetchIndicator('gdpGrowth');
}

// ── تسجيل ذاتي عند تحميل الوحدة ───────────────────────────────────────────────
registerConnector('macro.inflation', worldBankInflationConnector);
registerConnector('macro.gdpGrowth', worldBankGdpGrowthConnector);
