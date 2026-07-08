/**
 * حارس انحدار المخطط (schema regression guard).
 * السبب: سكربت تقسيم (split_schema.cjs) أفرغ TABLE_SCHEMAS إلى {} فأصبحت كل جداول
 * الإدخال في المعالج ميتة حياً («No schema for table») دون أن يسقط أي اختبار.
 * هذا الحارس يفشل فوراً إذا عاد المخطط فارغاً أو نقص عنه جدول أساسي.
 */
import { describe, it, expect } from 'vitest';
import { TABLE_SCHEMAS } from '../schema.js';

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
