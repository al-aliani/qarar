/**
 * فحص أولي آلي (بحث كلمات مفتاحية، لا فهم لغوي حقيقي) لأهم بنود/مخاطر شائعة في نص
 * عقد شراكة يلصقه المستخدم يدوياً — لا استخراج نص من PDF (يحتاج مكتبة تحليل PDF
 * غير موجودة في المشروع بعد، pdf.js أو مشابه؛ يُترك كقرار تبعية مستقبلي)، ولا OCR
 * للصور الممسوحة. مدخل نصي مباشر (لصق أو ملف .txt) فقط في هذا الإصدار.
 */
const RISK_KEYWORDS = [
    { pattern: /غير قابل(ة)? للإلغاء|irrevocable/i, label: 'بند عدم قابلية الإلغاء — تحقق من شروط الخروج قبل التوقيع' },
    { pattern: /حصري|exclusiv/i, label: 'بند حصرية — قد يقيّد التعامل مع أطراف أخرى في نفس النشاط' },
    { pattern: /غرامة|penalty|تعويض جزائي/i, label: 'بند غرامة/تعويض جزائي — تحقق من قيمته وشروط استحقاقه' },
    { pattern: /منافسة|non-compete|عدم منافسة/i, label: 'بند عدم منافسة — قد يقيّد نشاطك بعد انتهاء الشراكة' },
    { pattern: /(تلقائي[\s\S]{0,20}(تجدي?د|جدَّد)|(تجدي?د|جدَّد)[\s\S]{0,20}تلقائي|auto-?renew)/i, label: 'بند تجديد تلقائي — تحقق من مهلة الإشعار بعدم التجديد' },
    { pattern: /سرية|confidential|عدم إفصاح/i, label: 'بند سرية/عدم إفصاح — التزام قائم حتى بعد انتهاء العلاقة غالباً' },
    { pattern: /تحكيم|arbitration/i, label: 'بند تحكيم — يحدّد جهة فض النزاع بدل المحاكم العادية' },
    { pattern: /ملكية فكرية|intellectual property/i, label: 'بند ملكية فكرية — تحقق من ملكية ما يُنتَج أثناء الشراكة' }
];

/**
 * @param {string} contractText
 * @returns {{flags: Array<{label:string}>, wordCount:number}}
 */
export function scanContractRisks(contractText) {
    const text = (contractText || '').toString();
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (!wordCount) return { flags: [], wordCount: 0 };
    const flags = RISK_KEYWORDS.filter(k => k.pattern.test(text)).map(k => ({ label: k.label }));
    return { flags, wordCount };
}
