/**
 * حارس تزامن الأسعار بين web/js/core/pricing.js وكل صفحات HTML تحت web/.
 *
 * لماذا حارس لا توليد: كتل JSON-LD ونصوص الصفحات ثابتة داخل HTML ولا تستطيع
 * استيراد وحدة JS وقت التشغيل. فالبديل العملي أن يفشل الاختبار لحظة اختلاف أي
 * رقم مكتوب يدوياً عن المصدر. خطورة JSON-LD خاصة: جوجل يعرض سعر Offer في نتائج
 * البحث، فقد يصل العميل برقم غير الذي يدفعه.
 *
 * ثلاث قواعد، والمسح تعاودي على كل web/**\/*.html (عدا dist وnode_modules)
 * حتى تُلتقط أي صفحة تُضاف لاحقاً لا الصفحات المعروفة اليوم فقط:
 *   1) كل "price" داخل كتل application/ld+json = سعر الباقة المطابقة بالاسم.
 *   2) نص كل عنصر يحمل data-price / data-price-min / data-price-max = القيمة
 *      المنسّقة من المصدر (هذا ما يراه الزائر والزاحف قبل تنفيذ أي سكربت).
 *   3) ممنوع كتابة أي سعر باقة في نص الصفحة خارج تلك العناصر — بلا هذه القاعدة
 *      يبقى الرقم السردي بلا مرساة، فإذا تغيّر السعر في المصدر لم يعد لأي حارس
 *      طريقة لمعرفة أن «299» في الفقرة كانت سعراً.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';
import { PRICING_PACKAGES, PRICE_MIN, PRICE_MAX, formatPrice } from '../../core/pricing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, '../../..');
const SKIP_DIRS = new Set(['dist', 'node_modules']);

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...htmlFiles(join(dir, entry.name)));
    } else if (entry.name.endsWith('.html')) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/** كل عرض سعر داخل كتل JSON-LD، مع اسم الباقة المجاور إن وُجد. */
function jsonLdOffers(src) {
  const found = [];
  const blocks = src.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const block of blocks) {
    let data;
    try {
      data = JSON.parse(block[1]);
    } catch {
      throw new Error('كتلة JSON-LD غير صالحة — تعذّر تحليلها');
    }
    // مواضع مفاتيح "price" في نص الكتلة، بالترتيب نفسه الذي يزورها به walk،
    // لتحمل رسالةُ الفشل رقمَ سطر صحيحاً في الملف الأصلي.
    const contentStart = block.index + block[0].indexOf(block[1]);
    const keyOffsets = [...block[1].matchAll(/"price"\s*:/g)].map((m) => contentStart + m.index);
    let seen = 0;
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      if ('price' in node) {
        found.push({
          name: typeof node.name === 'string' ? node.name : null,
          price: Number(node.price),
          raw: String(node.price),
          line: lineOf(src, keyOffsets[seen++] ?? block.index)
        });
      }
      Object.values(node).forEach(walk);
    };
    walk(data);
  }
  return found;
}

/** العناصر المربوطة بالمصدر: نتحقق من نصّها الثابت ثم نحذفها قبل مسح النص السردي. */
function boundElements(src) {
  const found = [];
  const stripped = src.replace(
    /<(\w+)((?:[^>]*?\s)?data-price(?:-min|-max)?(?:=["'][^"']*["'])?[^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, _tag, attrs, text, index) => {
      const id = attrs.match(/\bdata-price=["']([^"']*)["']/);
      const kind = id ? id[1] : /data-price-min/i.test(attrs) ? '#min' : '#max';
      found.push({ kind, text: text.trim(), line: lineOf(src, index) });
      return ' '.repeat(match.length);
    }
  );
  return { found, stripped };
}

/**
 * نص الصفحة المرئي: بلا سكربتات ولا أنماط ولا تعليقات ولا وسوم.
 * الإخفاء بمسافات بنفس الطول (مع إبقاء الأسطر) كي تبقى مواضع النص مطابقة
 * للملف الأصلي، فيصحّ رقم السطر في رسالة الفشل.
 */
const blank = (s) => s.replace(/[^\n]/g, ' ');
const proseOf = (src) =>
  src
    .replace(/<script[\s\S]*?<\/script>/gi, blank)
    .replace(/<style[\s\S]*?<\/style>/gi, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<[^>]*>/g, blank);

const PAID = PRICING_PACKAGES.filter((p) => p.price > 0);
const byId = Object.fromEntries(PRICING_PACKAGES.map((p) => [p.id, p]));
const byName = Object.fromEntries(PRICING_PACKAGES.map((p) => [p.name, p]));
const KNOWN_PRICES = new Set(PRICING_PACKAGES.map((p) => p.price));

const FILES = htmlFiles(WEB_ROOT);

describe('تزامن الأسعار بين pricing.js وصفحات HTML العامة', () => {
  it('يجد صفحات HTML ليمسحها (حماية من مسح فارغ يمرّ صامتاً)', () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  it('كل سعر في JSON-LD يطابق سعر باقته في pricing.js', () => {
    const errors = [];
    for (const file of FILES) {
      const src = readFileSync(file, 'utf8');
      const where = relative(WEB_ROOT, file).replace(/\\/g, '/');
      for (const offer of jsonLdOffers(src)) {
        const pkg = offer.name ? byName[offer.name] : null;
        if (pkg) {
          if (offer.price !== pkg.price) {
            errors.push(
              `${where}:${offer.line} — JSON-LD يعلن «${offer.name}» بـ${offer.raw} ` +
                `بينما pricing.js يقول ${pkg.price} (هذا ما يعرضه جوجل في نتائج البحث)`
            );
          }
        } else if (!KNOWN_PRICES.has(offer.price)) {
          errors.push(
            `${where}:${offer.line} — JSON-LD يعلن سعراً (${offer.raw}) لا يقابله أي باقة في pricing.js`
          );
        }
      }
    }
    expect(errors, `\n${errors.join('\n')}\n`).toEqual([]);
  });

  it('نص كل عنصر data-price يطابق القيمة المنسّقة من pricing.js', () => {
    const errors = [];
    for (const file of FILES) {
      const src = readFileSync(file, 'utf8');
      const where = relative(WEB_ROOT, file).replace(/\\/g, '/');
      for (const el of boundElements(src).found) {
        let expected;
        if (el.kind === '#min') expected = formatPrice(PRICE_MIN);
        else if (el.kind === '#max') expected = formatPrice(PRICE_MAX);
        else if (byId[el.kind]) expected = formatPrice(byId[el.kind].price);
        else {
          errors.push(`${where}:${el.line} — data-price="${el.kind}" لا يقابله أي باقة في pricing.js`);
          continue;
        }
        if (el.text !== expected) {
          errors.push(
            `${where}:${el.line} — data-price="${el.kind}" مكتوب فيه «${el.text}» ` +
              `والمصدر يقول «${expected}»`
          );
        }
      }
    }
    expect(errors, `\n${errors.join('\n')}\n`).toEqual([]);
  });

  it('لا سعر باقة مكتوباً في نص الصفحة خارج عنصر data-price', () => {
    const errors = [];
    for (const file of FILES) {
      const src = readFileSync(file, 'utf8');
      const where = relative(WEB_ROOT, file).replace(/\\/g, '/');
      const prose = proseOf(boundElements(src).stripped);
      for (const pkg of PAID) {
        for (const form of new Set([String(pkg.price), formatPrice(pkg.price)])) {
          const re = new RegExp(`(?<![\\d,.])${form.replace('.', '\\.')}(?![\\d,.])`, 'g');
          for (const hit of prose.matchAll(re)) {
            errors.push(
              `${where}:${lineOf(prose, hit.index)} — «${form}» (سعر باقة «${pkg.name}») مكتوب في النص ` +
                `بلا ربط بالمصدر. لُفّه بـ<span data-price="${pkg.id}">${form}</span> ليحرسه هذا الاختبار`
            );
          }
        }
      }
    }
    expect(errors, `\n${errors.join('\n')}\n`).toEqual([]);
  });
});
