/**
 * حارس انحدار المخطط (schema regression guard).
 * السبب: سكربت تقسيم (split_schema.cjs) أفرغ TABLE_SCHEMAS إلى {} فأصبحت كل جداول
 * الإدخال في المعالج ميتة حياً («No schema for table») دون أن يسقط أي اختبار.
 * هذا الحارس يفشل فوراً إذا عاد المخطط فارغاً أو نقص عنه جدول أساسي.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { TABLE_SCHEMAS, createEmptyStudy, SECTIONS } from '../schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// الجداول الأساسية التي يعتمد عليها المعالج والمحرك — غيابها يعطّل خطوات كاملة.
const REQUIRED_TABLES = [
  'products', 'introServices', 'customerValues',
  'keyPeople', 'partnershipContracts',
  'competitors', 'competitorBenchmarking', 'historicalData',
  'revenueStreams',
  'establishmentCosts', 'equipment', 'buildings', 'furniture',
  'positions', 'licenses',
  'references', 'reviewers',
];

describe('TABLE_SCHEMAS regression guard', () => {
  it('is a non-empty object', () => {
    expect(TABLE_SCHEMAS && typeof TABLE_SCHEMAS === 'object').toBe(true);
    expect(Object.keys(TABLE_SCHEMAS).length).toBeGreaterThan(20);
  });

  it('defines every required input table', () => {
    for (const t of REQUIRED_TABLES) {
      expect(TABLE_SCHEMAS[t], `TABLE_SCHEMAS.${t} مفقود`).toBeTruthy();
    }
  });

  it('every table exposes a non-empty columns array', () => {
    for (const [key, def] of Object.entries(TABLE_SCHEMAS)) {
      expect(Array.isArray(def.columns), `${key}.columns ليست مصفوفة`).toBe(true);
      expect(def.columns.length, `${key}.columns فارغة`).toBeGreaterThan(0);
    }
  });

  it('exposes the variable-cost column so the 30% default is visible to users', () => {
    const cols = (TABLE_SCHEMAS.revenueStreams?.columns || []).map(c => c.key);
    expect(cols).toContain('variableCostRate');
  });
});

/**
 * حارس مفاتيح مكررة داخل createEmptyStudy() — كان الكائن الحرفي المُعاد يحمل 6 مفاتيح قسم
 * معرَّفة مرتين (FINANCIAL_STATEMENTS/BREAK_EVEN/DECISION_DASHBOARD/BUSINESS_MODEL/
 * MONTE_CARLO/VALUATION): تعريف فارغ {} أولاً يُدهس بصمت بتعريف حقيقي لاحقاً — قنبلة صامتة:
 * من يعدّل التعريف الأول يظن أنه غيّر السلوك ولا شيء يتغير (تدقيق 2026-07-08).
 */
describe('createEmptyStudy(): لا مفاتيح أقسام مكررة', () => {
  it('لا يحمل الكائن الحرفي المصدري أي مفتاح [SECTIONS.X] مكرراً', () => {
    const src = readFileSync(join(__dirname, '../schema.js'), 'utf8');
    const fnStart = src.indexOf('export function createEmptyStudy');
    expect(fnStart, 'لم يُعثر على createEmptyStudy في schema.js').toBeGreaterThan(-1);
    // نلتقط جسم الدالة عبر تتبّع عمق الأقواس المعقوفة بدءاً من أول { بعد التعريف
    const bodyStart = src.indexOf('{', fnStart);
    let depth = 0, i = bodyStart, bodyEnd = -1;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { bodyEnd = i; break; } }
    }
    expect(bodyEnd, 'لم يُعثر على نهاية جسم createEmptyStudy').toBeGreaterThan(-1);
    const body = src.slice(bodyStart, bodyEnd);

    const keyRe = /\[SECTIONS\.([A-Z_]+)\]\s*:/g;
    const seen = new Map();
    let m;
    while ((m = keyRe.exec(body))) {
      const k = m[1];
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    const dups = [...seen.entries()].filter(([, count]) => count > 1);
    expect(dups, `مفاتيح [SECTIONS.X] مكررة: ${dups.map(([k, c]) => `${k}×${c}`).join('، ')}`).toEqual([]);
  });

  it('كل قسم في SECTIONS له قيمة افتراضية واحدة متّسقة (بدون undefined)', () => {
    const study = createEmptyStudy();
    for (const key of Object.values(SECTIONS)) {
      expect(study[key], `study.${key} غير معرَّف`).not.toBeUndefined();
    }
  });
});
