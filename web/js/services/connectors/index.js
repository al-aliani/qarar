/**
 * connectors/index.js — نقطة الإقلاع الموحّدة لطبقة موصّلات البيانات.
 *
 * استيراد هذه الوحدة الواحدة يُوصّل السجل بأكمله: كل موصّل يُسجّل نفسه ذاتياً
 * (side-effect) عند تحميله عبر registerConnector(...) في DataConnectors.js.
 * لذلك يكفي أن يستوردها التطبيق مرة واحدة عند الإقلاع، فتصبح كل المفاتيح متاحة
 * لـ suggest(key, ctx) دون أن يعرف المستهلك أي موصّل يخدم أي مفتاح.
 *
 * الاستيرادات أدناه لأثرها الجانبي فقط (تسجيل الموصّلات) — لا تُصدّر شيئاً بذاتها.
 */

// ── تحميل الموصّلات لأثر التسجيل الذاتي فقط ──────────────────────────────────
import './OverpassConnector.js';        // يسجّل: market.competitors
import './WorldBankConnector.js';       // يسجّل: macro.inflation، macro.gdpGrowth
import './GastatSnapshotConnector.js';  // يسجّل: demographics.city، market.tam
import './GooglePlacesConnector.js';    // يسجّل: market.competitorsPrecise

// ── إعادة تصدير الواجهة العامة للطبقة ────────────────────────────────────────
export {
    suggest,
    PROVENANCE,
    provenanceLabel,
    isUsable,
    availableKeys,
    datum,
    unavailable
} from '../DataConnectors.js';
