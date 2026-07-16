/**
 * scanContractRisks — فحص كلمات مفتاحية شائعة في نص عقد شراكة (لا فهم لغوي حقيقي).
 */
import { describe, it, expect } from 'vitest';
import { scanContractRisks } from '../contractRiskScan.js';

describe('scanContractRisks', () => {
    it('نص فارغ: wordCount=0 وflags فارغة بلا رمي', () => {
        expect(scanContractRisks('')).toEqual({ flags: [], wordCount: 0 });
        expect(scanContractRisks(undefined)).toEqual({ flags: [], wordCount: 0 });
    });

    it('يرصد بند عدم المنافسة عند وجوده', () => {
        const result = scanContractRisks('يلتزم الطرف الثاني ببند عدم منافسة لمدة سنتين بعد انتهاء العقد.');
        expect(result.flags.some(f => f.label.includes('منافسة'))).toBe(true);
    });

    it('يرصد عدة بنود معاً (غرامة + تجديد تلقائي)', () => {
        const result = scanContractRisks('يُجدَّد العقد تلقائياً ما لم يُخطَر أحد الطرفين، وتُفرض غرامة تأخير 5%.');
        const labels = result.flags.map(f => f.label);
        expect(labels.some(l => l.includes('غرامة'))).toBe(true);
        expect(labels.some(l => l.includes('تجديد'))).toBe(true);
    });

    it('نص عادي بلا كلمات مفتاحية: flags فارغة رغم وجود نص فعلي (wordCount>0)', () => {
        const result = scanContractRisks('هذا نص عقد عام بلا أي بند خاص مذكور هنا إطلاقاً اليوم.');
        expect(result.wordCount).toBeGreaterThan(0);
        expect(result.flags).toEqual([]);
    });
});
