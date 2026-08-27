/**
 * تدقيق 2026-08-27: excelExporter.js وحده كان يميّز صفرَي نقطة التعادل المتعاكسين
 * (breakEvenAchievable/breakEvenReason من engine.js) بينما BankReportGenerator.js
 * وProfessionalReviewReportGenerator.js وMonshaatReportGenerator.js وweb/js/services/
 * ReportGenerator.js استمرت تطبع `fmt(ind.breakEvenPointValue || 0)` الساذجة — مشروع
 * يخسر على كل وحدة (هامش مساهمة سالب، breakEvenAchievable=false، والمحرك يضع القيمة
 * الرقمية صفراً عمداً في هذه الحالة — انظر engine.js:1160) كان يظهر «0 ريال» في 4 صيغ
 * تقارير مختلفة — أفضل قراءة ممكنة لأسوأ مشروع ممكن، على تقرير قد يُقدَّم لبنك حقيقي.
 *
 * formatBreakEvenValue الآن مصدر وحيد للحقيقة (web/export/utils.js) تستهلكه الصيغ
 * الأربع جميعها (SAFE.breakeven).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatBreakEvenValue, SAFE } from '../utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const fmt = (v) => `${v} ﷼`;

describe('formatBreakEvenValue — يميّز صفرَي نقطة التعادل المتعاكسين', () => {
    it('breakEvenAchievable=false (يخسر على كل وحدة): رسالة صريحة لا "0 ﷼"', () => {
        const result = formatBreakEvenValue({ breakEvenAchievable: false, breakEvenPointValue: 0 }, fmt);
        expect(result).toBe('غير قابل للتعادل — هامش المساهمة سالب');
        expect(result).not.toMatch(/^0/);
    });

    it('breakEvenReason=covered_by_non_operating: رسالة "محقق عند صفر وحدات" لا "0 ﷼"', () => {
        const result = formatBreakEvenValue(
            { breakEvenAchievable: true, breakEvenReason: 'covered_by_non_operating', breakEvenPointValue: 0 },
            fmt,
        );
        expect(result).toBe('محقق عند صفر وحدات — الإيراد غير التشغيلي يغطي كل التكاليف الثابتة');
    });

    it('قيمة حقيقية موجبة وbreakEvenAchievable=true: تُنسَّق عملة طبيعياً', () => {
        const result = formatBreakEvenValue({ breakEvenAchievable: true, breakEvenPointValue: 125000 }, fmt);
        expect(result).toBe('125000 ﷼');
    });

    it('غياب حقيقي للقيمة (null) بلا onMissing: تعود للسلوك القديم fmt(0)', () => {
        const result = formatBreakEvenValue({ breakEvenAchievable: true, breakEvenPointValue: null }, fmt);
        expect(result).toBe('0 ﷼');
    });

    it('غياب حقيقي للقيمة (null) مع onMissing: تستخدم البديل بدل fmt(0)', () => {
        const onMissing = vi.fn(() => '— بديل —');
        const result = formatBreakEvenValue({ breakEvenAchievable: true, breakEvenPointValue: null }, fmt, onMissing);
        expect(result).toBe('— بديل —');
        expect(onMissing).toHaveBeenCalledTimes(1);
    });

    it('breakEvenAchievable=false يتفوّق على onMissing حتى لو كانت القيمة null أيضاً', () => {
        const onMissing = vi.fn(() => '— بديل —');
        const result = formatBreakEvenValue({ breakEvenAchievable: false, breakEvenPointValue: null }, fmt, onMissing);
        expect(result).toBe('غير قابل للتعادل — هامش المساهمة سالب');
        expect(onMissing).not.toHaveBeenCalled();
    });

    it('SAFE.breakeven هو نفس الدالة المصدَّرة (نقطة استهلاك واحدة لكل المستوردين عبر SAFE)', () => {
        expect(SAFE.breakeven).toBe(formatBreakEvenValue);
    });

    it('[إثبات الحارس] النمط القديم "|| 0" كان سيُظهر 0 ﷼ لمشروع خاسر بالكامل', () => {
        const ind = { breakEvenAchievable: false, breakEvenPointValue: 0 };
        const oldBehavior = fmt(ind.breakEvenPointValue || 0);
        expect(oldBehavior).toBe('0 ﷼');
        expect(formatBreakEvenValue(ind, fmt)).not.toBe(oldBehavior);
    });
});

describe('ملفات التقارير الأربعة تستهلك SAFE.breakeven ولا تطبع "|| 0" الساذجة بعد الآن', () => {
    const read = (p) => readFileSync(resolve(__dirname, p), 'utf-8');

    it.each([
        '../BankReportGenerator.js',
        '../ProfessionalReviewReportGenerator.js',
        '../MonshaatReportGenerator.js',
    ])('%s: يستخدم SAFE.breakeven ولا "breakEvenPointValue || 0"', (relPath) => {
        const src = read(relPath);
        expect(src).not.toMatch(/breakEvenPointValue\s*\|\|\s*0/);
        expect(src).toMatch(/SAFE\.breakeven\(/);
    });

    it('web/js/services/ReportGenerator.js: يستخدم SAFE.breakeven مع بديل وحدات/شهر، لا الفحص الساذج القديم', () => {
        const src = read('../../js/services/ReportGenerator.js');
        expect(src).not.toMatch(/breakEvenPointValue\s*!=\s*null\s*\?\s*formatCurrency/);
        expect(src).toMatch(/SAFE\.breakeven\(/);
    });
});
