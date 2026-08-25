// أداة قياس حجم الحزمة (تدقيق أداء) — تُشغَّل بعد `npm run build`.
// تطبع: حجم كل حزمة أوّلية خاماً وبـbrotli، وقائمة modulepreload من index.html،
// والاستيرادات الثابتة لـmain-*.js. للاستعمال اليدوي فقط، ليست جزءاً من البناء.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const distDir = path.resolve(process.cwd(), 'web/dist');
const assetsDir = path.join(distDir, 'assets');

const brotli = (buf) =>
    zlib.brotliCompressSync(buf, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length;

const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

const entry = (html.match(/<script[^>]+src="([^"]*\/main-[^"]+\.js)"/) || [])[1];
const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map(
    (m) => m[1],
);

const read = (url) => fs.readFileSync(path.join(distDir, url.replace(/^\//, '')));

const staticImportsOf = (url) => {
    const src = fs.readFileSync(path.join(distDir, url.replace(/^\//, '')), 'utf8');
    return [
        ...src.matchAll(/(?:^|[;}])import\s*(?:[^"';]*?from\s*)?["']([^"']+)["']/g),
    ].map((m) => path.posix.join(path.posix.dirname(url.replace(/^\//, '')), m[1]));
};

// الحمولة الأولية الحقيقية = الإدخال + كل ما يستورده استيراداً ثابتاً (بشكل تعدٍّ)
// + أي حزمة معلَّقة بـmodulepreload. الاستيراد الثابت إلزامي حتى بلا preload.
const seen = new Map();
const walk = (url, kind) => {
    const key = url.replace(/^\//, '');
    if (seen.has(key)) return;
    seen.set(key, kind);
    for (const dep of staticImportsOf(url)) walk(dep, 'static-import');
};

walk(entry, 'entry');
const entryStatics = staticImportsOf(entry);
for (const p of preloads) walk(p, seen.has(p.replace(/^\//, '')) ? 'both' : 'modulepreload');

const rows = [...seen].map(([file, kind]) => {
    const buf = read(file);
    return { file: path.basename(file), kind, raw: buf.length, br: brotli(buf) };
});

const staticImports = entryStatics;

const totalRaw = rows.reduce((s, r) => s + r.raw, 0);
const totalBr = rows.reduce((s, r) => s + r.br, 0);

console.log('=== الحمولة الأولية لـ index.html (JS) ===');
for (const r of rows) {
    console.log(
        `${r.kind.padEnd(14)} ${r.file.padEnd(34)} raw=${String(r.raw).padStart(8)}  br=${String(r.br).padStart(7)}`,
    );
}
console.log(`${''.padEnd(14)} ${'TOTAL'.padEnd(34)} raw=${String(totalRaw).padStart(8)}  br=${String(totalBr).padStart(7)}`);

console.log('\n=== استيرادات main الثابتة (من الكود نفسه) ===');
console.log(staticImports.length ? staticImports.join('\n') : '(لا شيء)');

console.log('\n=== عدد ملفات main-*.js في dist (كشف تراكم البناءات) ===');
console.log(fs.readdirSync(assetsDir).filter((f) => /^main-.*\.js$/.test(f)).length);
