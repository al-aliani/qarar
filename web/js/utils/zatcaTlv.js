/**
 * ترميز TLV لرمز QR الخاص بالفاتورة الضريبية المبسّطة — المرحلة الأولى من هيئة الزكاة
 * والضريبة والجمارك (ZATCA). خمسة حقول إلزامية، كلٌّ منها Tag-Length-Value:
 *   1) اسم البائع  2) الرقم الضريبي  3) الطابع الزمني (ISO 8601)
 *   4) الإجمالي شامل الضريبة  5) إجمالي ضريبة القيمة المضافة
 * تُدمج البايتات ثم تُرمّز Base64، وهذا ما يُشفَّر داخل QR. دالة نقية بلا اعتماديات
 * (تُختبَر بمعزل) — القيم قصيرة (< 256 بايت) فطول كل حقل بايت واحد يكفي للمرحلة 1.
 */
export function buildZatcaTlvBase64({ sellerName, vatNumber, timestamp, total, vatTotal }) {
    const enc = new TextEncoder();
    const tlv = (tag, value) => {
        const v = enc.encode(String(value ?? ''));
        const out = new Uint8Array(2 + v.length);
        out[0] = tag;
        out[1] = v.length;
        out.set(v, 2);
        return out;
    };
    const parts = [
        tlv(1, sellerName),
        tlv(2, vatNumber),
        tlv(3, timestamp),
        tlv(4, total),
        tlv(5, vatTotal),
    ];
    let len = 0;
    for (const p of parts) len += p.length;
    const merged = new Uint8Array(len);
    let off = 0;
    for (const p of parts) { merged.set(p, off); off += p.length; }
    let bin = '';
    for (let i = 0; i < merged.length; i++) bin += String.fromCharCode(merged[i]);
    return (typeof btoa !== 'undefined') ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}
