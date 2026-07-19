/**
 * توليد فاتورة ضريبية مبسّطة متوافقة مع المرحلة 1 (ZATCA) من صفّ طلب مدفوع، مع رمز QR
 * (TLV/Base64) وعرضها في نافذة قابلة للطباعة/الحفظ PDF. كل القيم النصية مُهرّبة، والنافذة
 * تحمل CSP صارماً (لا سكربت؛ صورة QR بـ data: فقط). المبالغ من الطلب مباشرةً (total_sar/
 * vat_sar) فالمعروض = المُحصَّل. تُظهر تنبيهاً إن كان الرقم الضريبي غير مُدخَل بعد.
 */
import QRCode from 'qrcode';
import { MERCHANT_INFO } from '../config.js';
import { escapeHtml } from './escape.js';
import { buildZatcaTlvBase64 } from './zatcaTlv.js';

const TIER_LABELS = { self: 'الباقة الذاتية', reviewed: 'مراجَعة بخبير', full: 'الخدمة الكاملة' };
const money = (n) => Number(n || 0).toFixed(2);

function formatDateTime(iso) {
    try {
        return new Date(iso).toLocaleString('ar-SA', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', numberingSystem: 'latn'
        });
    } catch (_) { return String(iso || ''); }
}

/** يبني HTML الفاتورة (نقيّ من I/O — يسهّل الاختبار/إعادة الاستخدام). qrDataUrl صورة data:. */
export function renderInvoiceHtml(order, merchant, qrDataUrl) {
    const m = merchant || {};
    const total = Number(order.total_sar ?? order.amount_sar ?? 0);
    const vat = Number(order.vat_sar ?? 0);
    const net = Math.max(0, total - vat);
    const ts = order.paid_at || order.created_at || '';
    const items = (Array.isArray(order.items) && order.items.length)
        ? order.items
        : [{ name: TIER_LABELS[order.tier] || order.tier, price: total }];
    const rows = items.map((it) =>
        `<tr><td>${escapeHtml(it.name || '')}</td><td class="ltr">${money(it.price)}</td></tr>`
    ).join('');
    const vatCell = m.vatNumber
        ? `<span class="ltr">${escapeHtml(m.vatNumber)}</span>`
        : `<span style="color:#b91c1c;font-weight:700">غير مُدخَل — املأه في config قبل الإطلاق</span>`;

    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';">
<title>فاتورة ضريبية مبسّطة — ${escapeHtml(String(order.id || '').slice(0, 8))}</title>
<style>
  *{box-sizing:border-box} body{font-family:'Segoe UI',Tahoma,system-ui,sans-serif;color:#111;margin:0;padding:24px;background:#fff}
  .inv{max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:10px;padding:22px}
  .hd{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #0e5b44;padding-bottom:12px;margin-bottom:16px}
  .t{font-size:1.25rem;font-weight:800;color:#0e5b44} .sub{font-size:.8rem;color:#6b7280}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  .box{border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;font-size:.9rem;line-height:1.9}
  .lbl{font-size:.72rem;color:#6b7280;font-weight:700;margin-bottom:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:.9rem}
  th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:right} th{background:#f3f4f6;font-weight:700}
  .ltr{direction:ltr;unicode-bidi:isolate;text-align:left;font-variant-numeric:tabular-nums}
  .tot{margin-inline-start:auto;max-width:320px}
  .tot>div{display:flex;justify-content:space-between;padding:6px 0;font-size:.92rem}
  .tot .g{border-top:2px solid #0e5b44;margin-top:4px;padding-top:8px;font-weight:800;font-size:1.05rem;color:#0e5b44}
  .ft{margin-top:16px;font-size:.72rem;color:#6b7280;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px}
  @media print{body{padding:0} .inv{border:none}}
</style></head><body>
  <div class="inv">
    <div class="hd">
      <div><div class="t">فاتورة ضريبية مبسّطة</div><div class="sub">Simplified Tax Invoice</div></div>
      <div>${qrDataUrl ? `<img src="${qrDataUrl}" width="120" height="120" alt="QR">` : ''}</div>
    </div>
    <div class="grid">
      <div class="box">
        <div class="lbl">البائع</div>
        <div>${escapeHtml(m.name || '')}</div>
        <div>الرقم الضريبي: ${vatCell}</div>
        ${m.crNumber ? `<div>س.ت: <span class="ltr">${escapeHtml(m.crNumber)}</span></div>` : ''}
        ${m.unifiedNumber ? `<div>الرقم الموحّد: <span class="ltr">${escapeHtml(m.unifiedNumber)}</span></div>` : ''}
        ${m.address ? `<div>${escapeHtml(m.address)}</div>` : ''}
      </div>
      <div class="box">
        <div class="lbl">الفاتورة</div>
        <div>رقم: <span class="ltr">${escapeHtml(String(order.id || '').slice(0, 8))}</span></div>
        <div>التاريخ: <span class="ltr">${escapeHtml(formatDateTime(ts))}</span></div>
        <div>طريقة الدفع: ${escapeHtml(order.provider || '—')}</div>
      </div>
    </div>
    <table><thead><tr><th>البند</th><th class="ltr">المبلغ (شامل الضريبة)</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="tot">
      <div><span>الإجمالي قبل الضريبة</span><span class="ltr">${money(net)} ﷼</span></div>
      <div><span>ضريبة القيمة المضافة (15%)</span><span class="ltr">${money(vat)} ﷼</span></div>
      <div class="g"><span>الإجمالي المستحق</span><span class="ltr">${money(total)} ﷼</span></div>
    </div>
    <div class="ft">فاتورة إلكترونية — المرحلة الأولى (رمز QR بترميز TLV) وفق متطلبات هيئة الزكاة والضريبة والجمارك. استخدم طباعة المتصفح (Ctrl+P) للحفظ PDF.</div>
  </div>
</body></html>`;
}

/** يبني رمز QR ويفتح الفاتورة في نافذة للطباعة/الحفظ. */
export async function openTaxInvoice(order) {
    const m = MERCHANT_INFO;
    const total = Number(order.total_sar ?? order.amount_sar ?? 0);
    const vat = Number(order.vat_sar ?? 0);
    const ts = order.paid_at || order.created_at || new Date().toISOString();
    const tlv = buildZatcaTlvBase64({
        sellerName: m.name, vatNumber: m.vatNumber,
        timestamp: ts, total: money(total), vatTotal: money(vat)
    });
    let qr = '';
    try { qr = await QRCode.toDataURL(tlv, { margin: 1, width: 150 }); } catch (_) { /* بلا QR أفضل من فشل الفاتورة */ }
    const html = renderInvoiceHtml(order, m, qr);
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.focus(); }
    return html;
}
