/**
 * بند 2.4 (خطة الدفعة 2، 2026-07-12): مولّد TOWS من SWOT. الفجوة كانت قائمة بالكامل
 * (لا generateTOWS في الشجرة سابقاً). فخّان مذكوران صراحةً في الخطة:
 *   1) القراءة يجب أن تكون من strategic.swot (المصدر الغني)، لا marketing.towsMatrix.
 *   2) نسيان تسجيل الدالة في كائن InternalAIGenerator المجمَّع يرمي TypeError وقت
 *      التشغيل (علة سبق حدوثها فعلياً مع 7 دوال أخرى — انظر التعليق أعلى الكائن).
 * واختبارات batch6/batch7 تعاقب النصوص الثابتة المتطابقة بين المشاريع — نفس المعيار هنا.
 */
import { describe, it, expect } from 'vitest';
import { generateTOWS, InternalAIGenerator } from '../InternalAIGenerator.js';

describe('generateTOWS — التسجيل في الكائن المجمَّع', () => {
    it('مسجّلة في InternalAIGenerator (لا ترمي TypeError عند استدعائها عبر الكائن المجمَّع)', () => {
        expect(typeof InternalAIGenerator.generateTOWS).toBe('function');
        expect(() => InternalAIGenerator.generateTOWS({})).not.toThrow();
    });
});

describe('generateTOWS — يزاوج بنود SWOT الفعلية (لا قوالب ثابتة)', () => {
    it('مشروعان مختلفان ببنود SWOT مختلفة ينتجان نص TOWS مختلفاً تماماً', () => {
        const stateA = {
            strategic: {
                swot: {
                    strengths: ['موقع استراتيجي في حي الياسمين'],
                    weaknesses: ['علامة تجارية جديدة'],
                    opportunities: ['نمو الطلب على القهوة المختصة'],
                    threats: ['دخول سلسلة عالمية منافسة']
                }
            }
        };
        const stateB = {
            strategic: {
                swot: {
                    strengths: ['خبرة الفريق التقني العميقة'],
                    weaknesses: ['محدودية رأس المال العامل'],
                    opportunities: ['دعم صندوق التنمية للبرمجيات'],
                    threats: ['تسارع التغير التقني']
                }
            }
        };

        const towsA = generateTOWS(stateA);
        const towsB = generateTOWS(stateB);

        expect(towsA.so).not.toBe(towsB.so);
        expect(towsA.wo).not.toBe(towsB.wo);
        expect(towsA.st).not.toBe(towsB.st);
        expect(towsA.wt).not.toBe(towsB.wt);

        // النص الناتج يحتوي فعلياً على بنود SWOT الحقيقية (إثبات أنه ليس قالباً عاماً)
        expect(towsA.so).toContain('موقع استراتيجي في حي الياسمين');
        expect(towsA.so).toContain('نمو الطلب على القهوة المختصة');
        expect(towsA.wo).toContain('علامة تجارية جديدة');
        expect(towsA.st).toContain('دخول سلسلة عالمية منافسة');
        expect(towsA.wt).not.toContain('محدودية رأس المال العامل'); // من مشروع ب لا أ
    });

    it('يقرأ من strategic.swot لا من marketing.towsMatrix (لا يخلط بين القسمين)', () => {
        const state = {
            strategic: { swot: { strengths: ['قوة أ'], weaknesses: [], opportunities: ['فرصة أ'], threats: [] } },
            marketing: { towsMatrix: { so: 'نص قديم مكتوب يدوياً في المكان الخطأ' } }
        };
        const tows = generateTOWS(state);
        expect(tows.so).toContain('قوة أ');
        expect(tows.so).toContain('فرصة أ');
        expect(tows.so).not.toContain('نص قديم مكتوب يدوياً');
    });

    it('SWOT فارغة بالكامل: كل الأرباع فارغة بلا نص وهمي وبلا استثناء', () => {
        const tows = generateTOWS({ strategic: { swot: {} } });
        expect(tows).toEqual({ so: '', wo: '', st: '', wt: '' });
    });

    it('state بلا strategic إطلاقاً لا يرمي خطأ ويعيد أرباعاً فارغة', () => {
        expect(() => generateTOWS({})).not.toThrow();
        expect(generateTOWS({})).toEqual({ so: '', wo: '', st: '', wt: '' });
    });

    it('محور واحد بلا مقابل (قوة بلا أي فرصة) لا ينتج ربع SO', () => {
        const tows = generateTOWS({ strategic: { swot: { strengths: ['قوة وحيدة'], opportunities: [] } } });
        expect(tows.so).toBe('');
    });

    it('يزاوج حتى بندين من كل محور عند توفرهما', () => {
        const tows = generateTOWS({
            strategic: {
                swot: {
                    strengths: ['قوة أولى', 'قوة ثانية', 'قوة ثالثة'],
                    opportunities: ['فرصة أولى', 'فرصة ثانية']
                }
            }
        });
        expect(tows.so).toContain('قوة أولى');
        expect(tows.so).toContain('قوة ثانية');
        expect(tows.so).not.toContain('قوة ثالثة');
        expect(tows.so).toContain('فرصة أولى');
        expect(tows.so).toContain('فرصة ثانية');
    });
});
