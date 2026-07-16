/**
 * فحص إرشادي (heuristic) لتوفر نطاق .sa ومقابض إنستغرام/إكس لاسم تجاري مقترح.
 * لا يوجد WHOIS/API رسمي مجاني لهذا — البديل الوحيد الصادق هو طلب HEAD/GET فعلي
 * للرابط المرشّح وتفسير الاستجابة: 200=مأخوذ على الأرجح، تعذّر/404=متاح على
 * الأرجح. هذا ليس استعلام سجل رسمي، ويُعلَن كذلك صراحة في `checked`/`note` —
 * لا نُخمّن توفراً مؤكداً من أداة لا تملك مصدراً موثوقاً لذلك.
 */

/** تحويل تقريبي (best-effort) لحروف عربية شائعة إلى ما يقابلها لاتينياً — لا يوجد
 * معيار رسمي لهذا، والنتيجة تقريبية خصوصاً للأسماء العربية الخالصة. */
const TRANSLIT: Record<string, string> = {
    'ا': 'a', 'أ': 'a', 'إ': 'a', 'آ': 'a', 'ى': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's',
    'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
    'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
    'ة': 'a', 'ء': '', 'ؤ': 'o', 'ئ': 'e'
};

/** يحوّل اسماً (عربي/مختلط) إلى مُعرّف لاتيني تقريبي صالح كسلاج نطاق/مقبض تواصل. */
export function slugify(name: string): string {
    const source = (name || '').toString().trim();
    const translit = source.split('').map(ch => TRANSLIT[ch] ?? ch).join('');
    return translit.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30);
}

/** true=مأخوذ على الأرجح، false=متاح على الأرجح، null=تعذّر تحديد ذلك. */
export function interpretAvailability(taken: boolean | null): boolean | null {
    return taken === null ? null : !taken;
}

/** فحص رابط واحد؛ fetchImpl قابل للحقن للاختبار بلا شبكة حقيقية. */
async function probeUrl(url: string, fetchImpl: typeof fetch): Promise<boolean | null> {
    try {
        const res = await fetchImpl(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
        return res.ok;
    } catch {
        try {
            const res = await fetchImpl(url, { method: 'GET', signal: AbortSignal.timeout(4000) });
            return res.ok;
        } catch {
            return null;
        }
    }
}

export interface NameAvailabilityResult {
    name: string;
    slug: string;
    domainAvailable: boolean | null;
    instagramAvailable: boolean | null;
    xAvailable: boolean | null;
    checked: 'heuristic' | 'unsupported';
    note: string;
}

/** فحص مرشّح واحد؛ fetchImpl قابل للحقن (افتراضياً fetch العام) — يتيح اختبار
 * Vitest حقيقياً بلا شبكة عبر تمرير دالة وهمية. */
export async function checkOneCandidate(name: string, fetchImpl: typeof fetch = fetch): Promise<NameAvailabilityResult> {
    const slug = slugify(name);
    if (slug.length < 2) {
        return {
            name, slug,
            domainAvailable: null, instagramAvailable: null, xAvailable: null,
            checked: 'unsupported',
            note: 'الاسم عربي بالكامل — تعذّر توليد معرّف لاتيني موثوق تلقائياً'
        };
    }

    const [domainTaken, igTaken, xTaken] = await Promise.all([
        probeUrl(`https://${slug}.sa`, fetchImpl),
        probeUrl(`https://instagram.com/${slug}`, fetchImpl),
        probeUrl(`https://x.com/${slug}`, fetchImpl)
    ]);

    return {
        name, slug,
        domainAvailable: interpretAvailability(domainTaken),
        instagramAvailable: interpretAvailability(igTaken),
        xAvailable: interpretAvailability(xTaken),
        checked: 'heuristic',
        note: 'فحص إرشادي بطلب فعلي للرابط — ليس استعلام WHOIS/API رسمي'
    };
}
