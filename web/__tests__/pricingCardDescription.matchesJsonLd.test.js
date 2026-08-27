/**
 * تدقيق 2026-08-27 (فحص شامل للموقع الحي): بطاقة «مراجَع بخبير» (1,999 — الموصى بها)
 * في landing.html كانت تصف الباقة بـ«نبني الدراسة ونراجع الافتراضات قبل التسليم» —
 * أي بناء كامل — بينما JSON-LD في نفس الصفحة وFAQ نفسها وhelp.html وabout.html
 * وpricing.html كلها تحصر الباقة في «مراجعة مختص لافتراضاتك». عميل يدفع 1,999
 * متوقعاً أن المنصة تبني الدراسة نيابة عنه كان سيكتشف العكس بعد الشراء — أخطر
 * تناقض شراء على الموقع، وباقة «خدمة كاملة» (4,999) هي وحدها من يتولى البناء.
 *
 * الحارس يقرأ وصف بطاقة "مراجَع بخبير" من نص landing.html الخام ويقارنه بوصف
 * "مراجَع بخبير" في كتلة JSON-LD من نفس الملف — لا قيمة يدوية منسوخة هنا، بل
 * مصدرا الحقيقة يجب أن يتطابقا دائماً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const landingPath = resolve(dirname(fileURLToPath(import.meta.url)), '../landing.html');

function loadLanding() {
    return readFileSync(landingPath, 'utf8');
}

function extractCardDescription(html) {
    const cardMatch = /<div class="name">مراجَع بخبير<\/div>[\s\S]*?<p class="desc">([^<]+)<\/p>/.exec(html);
    return cardMatch ? cardMatch[1].trim() : null;
}

function extractJsonLdDescription(html) {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    for (const [, raw] of blocks) {
        const data = JSON.parse(raw);
        const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
        for (const node of nodes) {
            const offers = Array.isArray(node?.offers) ? node.offers : [];
            const match = offers.find((o) => o?.name === 'مراجَع بخبير');
            if (match) return match.description ?? null;
        }
    }
    return null;
}

describe('landing.html — وصف بطاقة «مراجَع بخبير» يطابق JSON-LD (لا وعد ببناء الدراسة)', () => {
    it('نص البطاقة المرئي يطابق حرفياً وصف JSON-LD لنفس الباقة', () => {
        const html = loadLanding();
        const cardDesc = extractCardDescription(html);
        const jsonLdDesc = extractJsonLdDescription(html);

        expect(cardDesc, 'تعذر العثور على بطاقة «مراجَع بخبير» في landing.html').toBeTruthy();
        expect(jsonLdDesc, 'تعذر العثور على عرض «مراجَع بخبير» داخل JSON-LD').toBeTruthy();
        expect(cardDesc).toBe(jsonLdDesc);
    });

    it('وصف البطاقة لا يعد ببناء الدراسة — هذا حصراً وعد باقة «خدمة كاملة»', () => {
        const cardDesc = extractCardDescription(loadLanding());
        expect(cardDesc).not.toMatch(/نبني الدراسة/);
    });

    it('[إثبات الحارس] إعادة إدخال النص الأصلي المتناقض تُفشل كلا الاختبارين', () => {
        // يستهدف نص بطاقة "مراجَع بخبير" حصراً (لا الوصف المطابق داخل JSON-LD
        // الذي يسبقها في الملف) — استبدال عام كان سيصيب JSON-LD أولاً فيُبقي
        // الاختبار أخضر زوراً رغم عودة العيب الأصلي إلى البطاقة نفسها.
        const html = loadLanding().replace(
            /(<div class="name">مراجَع بخبير<\/div>[\s\S]*?<p class="desc">)[^<]+(<\/p>)/,
            '$1نبني الدراسة ونراجع الافتراضات قبل التسليم.$2',
        );
        const cardDesc = extractCardDescription(html);
        const jsonLdDesc = extractJsonLdDescription(html);

        expect(cardDesc).not.toBe(jsonLdDesc);
        expect(cardDesc).toMatch(/نبني الدراسة/);
    });
});
