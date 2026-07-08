/**
 * حارس مفاتيح مكررة في labels.js وfieldHelpTexts.js — قواميس مسطّحة تُدهس بصمت في JS
 * (لا خطأ وقت التحليل)، وكانت سبب تسريب «معدل النمو المستدام» فوق حقل نمو السوق العادي
 * (تدقيق 2026-07-08). يقرأ نص الملف مباشرة (لا AST كامل) لأن التكرار يحدث في جسم كائن واحد.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * يتتبّع عمق الأقواس المعقوفة {} كي يفحص فقط مفاتيح المستوى الأول داخل الكائن المُصدَّر
 * (LABELS / FIELD_HELP_TEXTS)، متجاهلاً مفاتيح متكررة شرعياً داخل كل حقل متداخل
 * (مثل help/example داخل كل إدخال في fieldHelpTexts.js).
 */
function findTopLevelObjectKeyDuplicates(filePath) {
    const src = readFileSync(filePath, 'utf8');
    const lines = src.split('\n');
    const keyRe = /^\s*'?([A-Za-z_][A-Za-z0-9_.]*)'?\s*:/;
    const seen = new Map();
    let depth = 0;
    let sawFirstBrace = false;
    lines.forEach((line, i) => {
        // نتجاهل تعليقات السطر الكامل عند حساب المفاتيح (لا عند حساب الأقواس، تبسيطاً)
        const isComment = /^\s*\/\//.test(line);
        const m = !isComment && depth === 1 ? line.match(keyRe) : null;
        if (m) {
            const key = m[1];
            if (!seen.has(key)) seen.set(key, []);
            seen.get(key).push(i + 1);
        }
        for (const ch of line) {
            if (ch === '{') { depth++; sawFirstBrace = true; }
            else if (ch === '}') depth--;
        }
    });
    if (!sawFirstBrace) throw new Error(`لم يُعثر على أي كائن في ${filePath}`);
    return [...seen.entries()].filter(([, lineNums]) => lineNums.length > 1);
}

describe('labels.js: لا مفاتيح مكررة في LABELS', () => {
    it('كل مفتاح يظهر مرة واحدة فقط', () => {
        const dups = findTopLevelObjectKeyDuplicates(join(__dirname, '../labels.js'));
        expect(dups, `مفاتيح مكررة تدهس بعضها بصمت: ${dups.map(([k, l]) => `${k}@${l.join(',')}`).join('; ')}`).toEqual([]);
    });
});

describe('fieldHelpTexts.js: لا مفاتيح مكررة في FIELD_HELP_TEXTS', () => {
    it('كل مفتاح يظهر مرة واحدة فقط', () => {
        const dups = findTopLevelObjectKeyDuplicates(join(__dirname, '../fieldHelpTexts.js'));
        expect(dups, `مفاتيح مكررة تدهس بعضها بصمت: ${dups.map(([k, l]) => `${k}@${l.join(',')}`).join('; ')}`).toEqual([]);
    });
});

describe('getLabel — مطابقة المسار الكامل قبل الجزء الأخير', () => {
    it('مسار مخصَّص (terminalValue.growthRate) يتفوّق على المفتاح العام (growthRate)', async () => {
        const { getLabel } = await import('../labels.js');
        expect(getLabel('terminalValue.growthRate')).toBe('معدل النمو المستدام');
        expect(getLabel('growthRate')).not.toBe('معدل النمو المستدام');
    });

    it('مفتاح غير معرَّف يعود بنسخة مقروءة من deCamelize بدل مسار خام', async () => {
        const { getLabel } = await import('../labels.js');
        expect(getLabel('someUnknownFieldXyz')).not.toBe('');
        expect(getLabel('someUnknownFieldXyz')).not.toContain('undefined');
    });
});

describe('getFieldHelp — مطابقة المسار الكامل قبل الجزء الأخير', () => {
    it('نمو حجم السوق (marketAnalysis.growthRate) له شرح مستقل عن نمو القيمة النهائية (طريقة جوردون)', async () => {
        const { getFieldHelp } = await import('../fieldHelpTexts.js');
        const marketHelp = getFieldHelp('marketAnalysis.growthRate');
        const terminalHelp = getFieldHelp('growthRate');
        expect(marketHelp?.help).not.toContain('جوردون');
        expect(terminalHelp?.help).toContain('جوردون');
    });
});
