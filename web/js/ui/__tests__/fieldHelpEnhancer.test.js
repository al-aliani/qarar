// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enhanceFieldHelp, observeFieldHelp } from '../components/FieldHelpEnhancer.js';
import { BusinessModelView } from '../BusinessModelView.js';
import { getFieldHelp } from '../../core/fieldHelpTexts.js';

describe('FieldHelpEnhancer', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="wizardContainer"></main>';
    });

    it('يضيف شرحاً متخصصاً للخانة التي لا تملك علامة مساعدة', () => {
        const root = document.getElementById('wizardContainer');
        root.innerHTML = `
            <div class="form-group">
                <label for="field-discountRate">معدل الخصم</label>
                <input id="field-discountRate" data-key="discountRate" type="number">
            </div>`;

        const result = enhanceFieldHelp(root);
        expect(result).toEqual({ total: 1, covered: 1, added: 1 });
        expect(root.querySelectorAll('.field-help-btn')).toHaveLength(1);
        expect(root.querySelector('.field-help-pop').textContent).toContain('تحويل أرباح المستقبل');
        expect(root.querySelector('input').getAttribute('aria-describedby')).toMatch(/^field-help-/);
    });

    it('لا يكرر العلامة الموجودة عند إعادة الرسم أو الاستدعاء', () => {
        const root = document.getElementById('wizardContainer');
        root.innerHTML = '<label for="projectName">اسم المشروع</label><input id="projectName">';

        enhanceFieldHelp(root);
        enhanceFieldHelp(root);
        expect(root.querySelectorAll('.field-help')).toHaveLength(1);
    });

    it('يضع شرح الجدول في رأس العمود مرة واحدة لكل الصفوف', () => {
        const root = document.getElementById('wizardContainer');
        root.innerHTML = `
            <table>
                <thead><tr><th>السعر</th><th>ملاحظات</th></tr></thead>
                <tbody>
                    <tr><td><input type="number"></td><td><textarea></textarea></td></tr>
                    <tr><td><input type="number"></td><td><textarea></textarea></td></tr>
                </tbody>
            </table>`;

        const result = enhanceFieldHelp(root);
        expect(result.total).toBe(4);
        expect(result.covered).toBe(4);
        expect(root.querySelectorAll('th .field-help')).toHaveLength(2);
    });

    it('يوفر شرحاً عاماً واضحاً للخانات غير المسجلة', () => {
        const root = document.getElementById('wizardContainer');
        root.innerHTML = '<label for="custom">تفصيل خاص بالمشروع</label><input id="custom" placeholder="اكتب التفصيل">';

        enhanceFieldHelp(root);
        expect(root.querySelector('.field-help-pop').textContent).toContain('تفصيل خاص بالمشروع');
        expect(root.querySelector('.fh-example').textContent).toContain('اكتب التفصيل');
    });

    it('يراقب الخانات المضافة لاحقاً ويشرحها تلقائياً', async () => {
        const root = document.getElementById('wizardContainer');
        const stop = observeFieldHelp(root);
        root.innerHTML = '<label for="price">السعر</label><input id="price" type="number">';
        await vi.waitFor(() => expect(root.querySelector('.field-help')).not.toBeNull());
        stop();
    });
});

/**
 * تدقيق 2026-08-26: ثمانٍ من خانات «نموذج العمل» التسع كانت بلا شرح مسجَّل في
 * fieldHelpTexts، فتسقط على قواعد CONTEXT_RULES السياقية أو على الحشو العام —
 * وأسوأ نتيجة: «قنوات الوصول» و«علاقات العملاء» كانتا تعرضان شرح «شرائح العملاء»
 * حرفياً. هذه المجموعة تشغّل مسار الرسم الحقيقي (BusinessModelView ثم
 * enhanceFieldHelp كما يستدعيه StudyCategoryView) وتحرس تمايز الشروح التسعة.
 */
describe('FieldHelpEnhancer — خانات نموذج العمل (Business Model Canvas)', () => {
    // نص قاعدة «شرائح العملاء» السياقية والحشو العام في FieldHelpEnhancer — إن ظهر
    // أيٌّ منهما في خانة من اللوحة فمعناه أن الشرح المسجَّل غائب وعاد العيب.
    const SEGMENT_RULE_HELP = 'حدد العميل أو العدد المتوقع';
    const GENERIC_FALLBACK_HELP = 'ستظهر المعلومة في التحليل أو التقرير المرتبط بهذه الخطوة';

    /** يرسم اللوحة الحقيقية ثم يضيف المساعدة، ويُرجع {key: helpText} لكل خانة. */
    function renderCanvasHelp() {
        document.body.innerHTML = '<main id="wizardContainer"></main>';
        const root = document.getElementById('wizardContainer');
        const state = { businessModel: {} };
        const store = { getState: () => state, get: () => state };
        new BusinessModelView('wizardContainer', store, () => {}).render(0);
        enhanceFieldHelp(root);

        const texts = {};
        for (const textarea of root.querySelectorAll('.bm-textarea')) {
            const key = textarea.dataset.field;
            const pop = root.querySelector(`#bm-block-${key} .field-help-pop`);
            expect(pop, `الخانة ${key} بلا أيقونة شرح`).toBeTruthy();
            const clone = pop.cloneNode(true);
            clone.querySelector('.fh-example')?.remove();
            texts[key] = clone.textContent.trim();
        }
        return texts;
    }

    it('الخانات التسع كلها تعرض شرحاً متمايزاً — لا نصّان متطابقان ولا حشو عام', () => {
        const texts = renderCanvasHelp();
        const keys = Object.keys(texts);
        expect(keys).toHaveLength(9);

        // الحارس الحقيقي: أي خانتين تتشاركان النص نفسه = عودة العيب بأي شكل.
        const duplicates = keys.filter(key => keys.some(other => other !== key && texts[other] === texts[key]));
        expect(duplicates, `خانات تتشارك شرحاً واحداً: ${duplicates.join('، ')}`).toEqual([]);
        expect(new Set(Object.values(texts)).size).toBe(9);

        for (const key of keys) {
            expect(texts[key], `الخانة ${key} بلا شرح`).toBeTruthy();
            expect(texts[key], `الخانة ${key} تعرض الحشو العام بدل شرح خاص`)
                .not.toContain(GENERIC_FALLBACK_HELP);
        }
    });

    it('قنوات الوصول وعلاقات العملاء لا ترثان شرح شرائح العملاء', () => {
        const texts = renderCanvasHelp();

        expect(texts.channels).not.toBe(texts.customerSegments);
        expect(texts.customerRelationships).not.toBe(texts.customerSegments);
        expect(texts.channels).not.toContain(SEGMENT_RULE_HELP);
        expect(texts.customerRelationships).not.toContain(SEGMENT_RULE_HELP);
        expect(texts.customerSegments).not.toContain(SEGMENT_RULE_HELP);
    });

    it('مصادر الإيرادات وهيكل التكاليف لا تطلبان أرقاماً في خانة سرد نصّي', () => {
        const texts = renderCanvasHelp();

        // نصوص قاعدتَي «الإيراد» و«التكلفة» السياقيتين اللتين كانتا تُلتقطان بالخطأ
        expect(texts.revenueStreams).not.toContain('أدخل الإيراد المتوقع أو الفعلي');
        expect(texts.costStructure).not.toContain('أدخل التكلفة الواقعية للفترة الموضحة');
    });

    it('المفاتيح التسعة كلها مسجَّلة في fieldHelpTexts (تقصير الدائرة قبل القواعد السياقية)', () => {
        const texts = renderCanvasHelp();
        for (const key of Object.keys(texts)) {
            const entry = getFieldHelp(key);
            expect(entry, `المفتاح ${key} غير مسجَّل في FIELD_HELP_TEXTS`).toBeTruthy();
            expect(entry.example, `المفتاح ${key} بلا مثال`).toBeTruthy();
            expect(texts[key]).toBe(entry.help);
        }
    });
});

