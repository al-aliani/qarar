/**
 * يوفّر Chart.js (كان يُحمَّل عبر CDN) كوحدة مُجمَّعة (bundled) بدل الاعتماد على شبكة خارجية.
 * تدقيق أداء 2026-08-22: لم يعد يُستورد ثابتاً في index.html (كان يسحب 207KB على كل
 * زيارة/خطوة). الآن يُستورد ديناميكياً عبر ensureChartGlobal() في
 * stepComponentRegistry.js/Wizard.js قبل رسم أيّ خطوة تستخدم `new Chart(...)` فعلياً —
 * فتبقى كل استخدامات `window.Chart`/`Chart` العالمي الحالية عبر تلك الملفات تعمل بلا
 * أي تعديل فيها، فقط بتأخير التحميل حتى الحاجة الفعلية.
 *
 * ملاحظة: ExcelJS وSheetJS(XLSX) *لا* تُحمَّلان هنا عمداً — فهما مكتبتان ثقيلتان يحتاجهما
 * التصدير فقط عند الطلب. يُحمَّلان بالاستيراد الديناميكي داخل web/export/excel.js
 * وweb/export/excelExporter.js حتى لا يثقل حجم الحزمة الأساسية لكل زائر.
 */
import Chart from 'chart.js/auto';

// مواءمة افتراضات الرسوم مع هوية «قرار» ورموز الثيم الحيّة:
// الخط العربي الموحّد + ألوان شبكة/نص تُقرأ من CSS variables فتتبع الوضع الفاتح/الداكن تلقائياً.
// (ألوان الـdatasets الصريحة داخل المكوّنات تبقى كما هي — هذه افتراضات فقط.)
function themeCharts() {
    try {
        const cs = getComputedStyle(document.documentElement);
        const muted = cs.getPropertyValue('--c-text-muted').trim() || '#5b665f';
        const border = cs.getPropertyValue('--c-border').trim() || 'rgba(28,36,32,0.14)';
        const primary = cs.getPropertyValue('--c-p-500').trim() || '#0e5b44';
        Chart.defaults.font.family = "'IBM Plex Sans Arabic', system-ui, sans-serif";
        Chart.defaults.color = muted;
        Chart.defaults.borderColor = border;
        Chart.defaults.plugins.legend.labels.boxWidth = 12;
        Chart.defaults.elements.line.borderColor = primary;
        Chart.defaults.elements.point.backgroundColor = primary;
    } catch (_) { /* لا نكسر التحميل إن تعذّرت القراءة */ }
}
themeCharts();
// إعادة التطبيق عند تبديل الثيم (data-theme على <html>) — الرسوم الجديدة ترث الألوان الصحيحة
new MutationObserver(themeCharts).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

window.Chart = Chart;
