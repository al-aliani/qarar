/**
 * تدقيق 2026-07-08 (ملاحظة عالية #27): getScoreColor كانت تُعيد hex ثابتة
 * (#10b981/#3b82f6/#f59e0b/#ef4444) لا تتبع متغيرات الثيم (variables.css)، فتبقى
 * حلقة عداد لوحة القرار بنفس اللون حرفياً بين الوضعين الفاتح والداكن.
 */
import { describe, it, expect } from 'vitest';
import { DecisionDashboard } from '../DecisionDashboard.js';

const dd = Object.create(DecisionDashboard.prototype);

describe('DecisionDashboard.getScoreColor — يتبع متغيرات الثيم لا hex ثابتة (#27)', () => {
    it('لا يُعيد أي قيمة hex ثابتة لأي درجة', () => {
        [95, 70, 50, 10].forEach(score => {
            expect(dd.getScoreColor(score)).not.toMatch(/^#[0-9a-fA-F]{3,6}$/);
        });
    });

    it('يُعيد var(--c-success) للدرجات المرتفعة (≥80)', () => {
        expect(dd.getScoreColor(80)).toBe('var(--c-success)');
        expect(dd.getScoreColor(95)).toBe('var(--c-success)');
    });

    it('يُعيد var(--c-warning) للدرجات المتوسطة (40-59)', () => {
        expect(dd.getScoreColor(40)).toBe('var(--c-warning)');
        expect(dd.getScoreColor(59)).toBe('var(--c-warning)');
    });

    it('يُعيد var(--c-danger) للدرجات المنخفضة (<40)', () => {
        expect(dd.getScoreColor(0)).toBe('var(--c-danger)');
        expect(dd.getScoreColor(39)).toBe('var(--c-danger)');
    });
});
