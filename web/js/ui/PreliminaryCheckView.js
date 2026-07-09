/**
 * الدراسة المبدئية — بوابة فرز (screening gate) قبل التفاصيل.
 * أربعة أسئلة تأهيلية + بطاقة نتيجة فورية توصي: انطلق / راجع / قارن أفكاراً بديلة.
 * يمكن تخطيها للمستخدمين المتقدمين.
 */

import { stepIndexById } from '../core/wizardSteps.js';
import { fieldHelp } from './components/FieldHelp.js';
import { calculateIdeaScore } from '../core/calculateIdeaScore.js';

// خيارات الأزرار الثلاثة — value معياري إنجليزي، label عربي معروض ومخزّن
const TRI_CHOICES = [
    { value: 'yes', label: 'نعم' },
    { value: 'unsure', label: 'غير متأكد' },
    { value: 'no', label: 'لا' }
];

// عوامل مبدأ الملاءمة (د. الروضي) — أربعة أسئلة نعم/لا خفيفة
const FITNESS_FACTORS = [
    { id: 'age', label: 'يناسب سنك ومرحلة حياتك' },
    { id: 'env', label: 'يناسب البيئة/الدولة التي تعمل فيها' },
    { id: 'sector', label: 'القطاع ملائم لخبرتك' },
    { id: 'income', label: 'الدخل المتوقع يناسب أهدافك' }
];

const esc = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * توافق خلفي: البيانات القديمة نصوص حرة. نقبل بادئة معيارية (yes/no/unsure)
 * أو عربية (نعم/لا/غير متأكد) متبوعة بفاصل؛ وإلا يُعرض النص كله في حقل التوضيح.
 */
function parseTriState(raw) {
    const text = (raw ?? '').toString().trim();
    if (!text) return { choice: '', note: '' };
    for (const c of TRI_CHOICES) {
        for (const prefix of [c.value, c.label]) {
            if (text.toLowerCase().startsWith(prefix.toLowerCase())) {
                const rest = text.slice(prefix.length);
                // البادئة تصلح فقط إن انتهى النص أو تبعها فاصل (وإلا «لايوجد» تُحسب «لا»)
                if (rest === '' || /^[\s،,.:—-]/.test(rest)) {
                    return { choice: c.value, note: rest.replace(/^[\s،,.:—-]+/, '').trim() };
                }
            }
        }
    }
    return { choice: '', note: text };
}

// التخزين نص بادئته التسمية العربية (نعم/لا/غير متأكد) — التقارير والتصدير يطبعان القيمة خاماً
function composeTriState(choice, note) {
    const found = TRI_CHOICES.find(c => c.value === choice);
    if (!found) return (note || '').trim();
    return note?.trim() ? `${found.label} — ${note.trim()}` : found.label;
}

export class PreliminaryCheckView {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
    }

    // مجموعة أزرار نعم/غير متأكد/لا + حقل توضيح اختياري يظهر بعد الاختيار
    _renderTriQuestion(id, labelHtml, rawValue) {
        const { choice, note } = parseTriState(rawValue);
        const buttons = TRI_CHOICES.map(c => `
            <label class="yesno-btn flex-1 ${choice === c.value ? 'active' : ''}">
                <input type="radio" name="${id}" value="${c.value}" class="hidden-radio" ${choice === c.value ? 'checked' : ''}>
                ${c.label}
            </label>
        `).join('');
        const showNote = choice || note;
        return `
            <div class="form-group">
                <label id="${id}-label">${labelHtml}</label>
                <div class="yesno-group d-flex gap-2 mt-2" data-tri="${id}" role="radiogroup" aria-labelledby="${id}-label">${buttons}</div>
                <input type="text" id="${id}-note" class="input mt-2" placeholder="السبب باختصار — اختياري"
                    value="${esc(note)}" ${showNote ? '' : 'style="display: none;"'}>
            </div>
        `;
    }

    // سؤال الموارد مفكَّك إلى ثلاثة اختيارات (بدل «مال، خبرة، شبكة» في إجابة واحدة)
    _renderResources(res) {
        const chip = (id, checked, txt) => `
            <label class="res-chip ${checked ? 'active' : ''}">
                <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}> ${txt}
            </label>`;
        return `
            <div class="form-group">
                <label id="pc-resources-label">3. ما الموارد الأولية المتوفرة لديك؟ ${fieldHelp('اختر ما ينطبق. لا يلزم توفّرها كلها — لكن نقصها يوجّهك لخطوات الدعم والتمويل لاحقاً.', 'مثال: 100 ألف ريال مدّخرة + معارف موردين، بلا خبرة سابقة.')}</label>
                <div class="d-flex gap-2 mt-2 flex-wrap" data-res-group role="group" aria-labelledby="pc-resources-label">
                    ${chip('pc-res-money', res.money, '💰 مبلغ للبدء')}
                    ${chip('pc-res-exp', res.experience, '🎓 خبرة في المجال')}
                    ${chip('pc-res-net', res.network, '🤝 معارف وموردون')}
                </div>
            </div>`;
    }

    render() {
        const state = this.store.getState();
        const pc = state.preliminaryCheck || {};
        const res = pc.resources || { money: false, experience: false, network: false };
        const suit = pc.suitability || {};

        this.container.innerHTML = `
            <div class="preliminary-check-view">
                <h2 class="section-title">🔍 الدراسة المبدئية</h2>
                <p class="text-muted mb-3">فرز سريع قبل التفاصيل — إجابات تقريبية تكفي.
                    <strong>يمكنك تخطي هذه الخطوة</strong> إذا كانت لديك خبرة سابقة.
                    ${fieldHelp('الهدف: قرار مبكر «أكمل / راجع / قارن أفكاراً بديلة» قبل صرف وقت في دراسة تفصيلية. تُجمع الإجابات بشكل بسيط من الأهل والمعارف، أو من الغرف التجارية والوزارات ومجلات الاستثمار.', 'مثال: قبل دراسة مطعم، اسأل ٣ من أصحاب المطاعم عن أصعب ما واجههم.')}
                </p>

                <div class="card analysis-card mb-4">
                    <h3 class="card-title">أسئلة تأهيلية</h3>
                    ${this._renderTriQuestion('pc-feasible',
                        `1. هل المشروع ممكن تنفيذه؟ (بناءً على معلومات أولية) ${fieldHelp('هل يمكن فعلياً تنفيذ الفكرة بالإمكانات المتاحة في السوق؟ لا يلزم يقين — انطباع أولي يكفي.', 'مثال: مقهى صغير في حي سكني — نعم، المعدات والموردون متوفرون.')}`,
                        pc.isProjectFeasible)}
                    ${this._renderTriQuestion('pc-environment',
                        `2. هل المشروع مناسب للبيئة التي ستعمل فيها؟ ${fieldHelp('هل يناسب المشروع الموقع والمنطقة وطبيعة السكان وعاداتهم الشرائية؟', 'مثال: مطعم عائلي في حي عائلات — مناسب؛ مقهى ليلي بجوار مدارس — غير مناسب.')}`,
                        pc.suitableForEnvironment)}
                    ${this._renderResources(res)}
                    ${this._renderTriQuestion('pc-ready',
                        `4. هل أنت جاهز للدراسة التفصيلية؟ ${fieldHelp('الدراسة التفصيلية تحتاج وقتاً لجمع أرقام حقيقية: أسعار، إيجارات، رواتب، منافسين.', 'مثال: نعم — لدي أسبوعان لزيارة المنافسين وسؤال الموردين عن الأسعار.')}`,
                        pc.readyForDetailedStudy)}
                </div>

                <!-- بطاقة النتيجة الفورية -->
                <div id="pc-result" class="mb-4">${this._renderResultCard(pc)}</div>

                <!-- مبدأ الملاءمة (د. الروضي) — تفاعلي واختياري -->
                <details class="card analysis-card mb-4">
                    <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem 0;">✅ مبدأ الملاءمة — هل المشروع يناسبك؟ <span id="pc-fitness-count" class="text-muted" style="font-weight:400;font-size:.85rem;">${this._fitnessCountLabel(suit)}</span></summary>
                    <div class="mt-3" style="font-size: 0.9rem;">
                        <p class="text-muted mb-2">اختر «نعم» لكل عامل ينطبق — كلما زادت الملاءمة زادت فرص النجاح:</p>
                        <div class="d-flex flex-column gap-2" data-fitness-group>
                            ${FITNESS_FACTORS.map(f => `
                                <label class="res-chip ${suit[f.id] === 'yes' ? 'active' : ''}" style="justify-content:space-between;">
                                    <span>${f.label}</span>
                                    <input type="checkbox" data-fitness="${f.id}" ${suit[f.id] === 'yes' ? 'checked' : ''}>
                                </label>`).join('')}
                        </div>
                    </div>
                </details>

                <div class="flex-between gap-3">
                    <button type="button" class="btn btn--ghost btn-skip-preliminary">تخطي — عندي خبرة سابقة</button>
                    <button type="button" class="btn btn--primary btn-continue-preliminary">حفظ والمتابعة ←</button>
                </div>
            </div>
        `;

        this._bindEvents();
    }

    // ── حساب نتيجة الفرز ──
    _readResourcesFromDom() {
        return {
            money: !!document.getElementById('pc-res-money')?.checked,
            experience: !!document.getElementById('pc-res-exp')?.checked,
            network: !!document.getElementById('pc-res-net')?.checked
        };
    }

    _computeResult(pc) {
        const f = parseTriState(pc.isProjectFeasible).choice;
        const e = parseTriState(pc.suitableForEnvironment).choice;
        const ready = parseTriState(pc.readyForDetailedStudy).choice;
        const res = pc.resources || {};
        const resCount = [res.money, res.experience, res.network].filter(Boolean).length;

        const answered = [f, e, ready].filter(Boolean).length + (resCount > 0 || pc._resourcesTouched ? 1 : 0);
        if (answered < 2) return { level: 'none' };

        const advices = [];
        if (f && f !== 'yes') advices.push({ q: 'الجدوى', txt: 'راجع جدوى الفكرة الأساسية: هل تحل مشكلة حقيقية بطريقة ممكنة؟ قبل الدخول في التفاصيل.' });
        if (e && e !== 'yes') advices.push({ q: 'البيئة', txt: 'قارن موقعاً أو فكرة بديلة أنسب للبيئة — تفعل ذلك في الخطوة التالية «مقارنة الأفكار».' });
        if (resCount === 0) advices.push({ q: 'الموارد', txt: 'لا موارد أولية بعد — اطّلع على خيارات الدعم والتمويل الحكومي (منشآت، بنك التنمية، كفالة) في خطوة التمويل.' });
        else if (resCount === 1) advices.push({ q: 'الموارد', txt: 'موردك محدود — عزّز الناقص (تمويل، شريك خبرة، أو موردين) قبل التوسع.' });
        if (ready && ready !== 'yes') advices.push({ q: 'الجاهزية', txt: 'خصص وقتاً لجمع أرقام حقيقية: أسعار، إيجارات، رواتب، أرقام المنافسين — الدراسة تقوى بها.' });

        // تدقيق 2026-07-08 (ملاحظة عالية #41): هذه عتبة تقدير ذاتي سريع (فحص أولي
        // خلال دقيقة، لا نموذج ترجيح دقيق) — «سالبة واحدة على الأقل من 4» صعبة
        // (جدوى/بيئة) توقف فوراً، و«3 من 4 سالبة» تعني غالبية أسئلة الفحص سلبية.
        // ليست معادلة إحصائية مُشتقة، بل قاعدة بسيطة مقصودة لتقرير سريع "أكمل/راجع/قارن".
        const hardNo = f === 'no' || e === 'no';
        const negatives = [f === 'no', e === 'no', resCount === 0, ready === 'no'].filter(Boolean).length;
        const allStrong = f === 'yes' && e === 'yes' && resCount >= 2 && ready === 'yes';

        if (hardNo || negatives >= 3) return { level: 'red', advices };
        if (allStrong) return { level: 'green', advices: [] };
        return { level: 'yellow', advices };
    }

    /**
     * تدقيق 2026-07-08 (ملاحظة حرجة، خبير الذكاء): calculateIdeaScore.js كان كود ميت
     * 100% — الشريط الجانبي (Sidebar.js) هو المستهلك الوحيد له وهو مخفي بالكامل بقاعدة
     * CSS شاملة. الآن يظهر هنا فعلياً — أول خطوة في الرحلة، حيث المنطق (فحص أولي سريع)
     * منطقي فعلاً. نعرض الفرعية الثلاث منفصلة (لا رقماً واحداً مدموجاً) كي لا يُفهم
     * «اكتمال التعبئة» على أنه «جودة الفكرة» (ملاحظة متوسطة منفصلة في نفس التدقيق).
     *
     * تدقيق 2026-07-09 (علة #1): score الآن = هامش + TAM حصراً (سقف كل منهما 50،
     * انظر تعليق الفصل أعلى calculateIdeaScore.js) — اكتمال التعبئة معلوماتية بحتة
     * ولا تدخل في المجموع، فتُعرض كسطر % منفصل موسوم صراحة بأنها لا تُحتسب.
     */
    _renderIdeaScoreChip() {
        const state = this.store.getState();
        const { score, color, breakdown } = calculateIdeaScore(state);
        if (!score) return '';
        const dot = { green: '🟢', yellow: '🟡', red: '🔴' }[color] || '⚪';
        const completenessPct = Math.round((breakdown.completeness / 40) * 100);
        return `
            <div class="card mb-3" style="padding:.75rem 1rem;">
                <div class="flex-between" style="align-items:center;">
                    <strong style="font-size:.92rem;">${dot} نتيجة الفكرة الأولية: ${score}/100</strong>
                    ${fieldHelp('تقدير سريع من جزأين ماليين فقط: الهامش الربحي المتوقع (إن حُسب) وحجم السوق TAM المُدخل — ليست حكماً نهائياً على جودة المشروع. اكتمال تعبئة البيانات معروض للعلم فقط ولا يدخل في هذا الرقم.', '')}
                </div>
                <div class="d-flex gap-3 mt-2 text-xs text-muted">
                    <span>الهامش الربحي: ${breakdown.margin}/50</span>
                    <span>حجم السوق (TAM): ${breakdown.tam}/50</span>
                </div>
                <div class="text-xs text-muted mt-1">اكتمال تعبئة البيانات: ${completenessPct}% (معلوماتي — لا يُحتسب ضمن نتيجة الفكرة)</div>
            </div>`;
    }

    _renderResultCard(pc) {
        const { level, advices } = this._computeResult(pc);
        if (level === 'none') return this._renderIdeaScoreChip();

        const palette = {
            green: { bg: '#ecfdf5', border: '#10b981', icon: '🟢', title: 'مؤشرات أولية إيجابية' },
            yellow: { bg: '#fffbeb', border: '#f59e0b', icon: '🟡', title: 'مؤشرات مقبولة مع نقاط تحتاج انتباهاً' },
            red: { bg: '#fef2f2', border: '#ef4444', icon: '🔴', title: 'إشارات تحذير — تأنَّ قبل الدراسة التفصيلية' }
        }[level];

        const body = {
            green: 'الفكرة تستحق دراسة تفصيلية. تابع بثقة — والأرقام لاحقاً ستؤكد أو تعدّل انطباعك.',
            yellow: 'يمكنك المتابعة، لكن عالِج النقاط التالية كي لا تفاجئك الأرقام لاحقاً:',
            red: 'الانطباع الأولي ضعيف، والأرقام لن تجاملك لاحقاً. ننصح بمقارنة أفكار بديلة قبل صرف وقت في دراسة تفصيلية.'
        }[level];

        const list = advices.length ? `<ul style="margin:.5rem 0 0;padding-inline-start:1.25rem;">${advices.map(a => `<li><strong>${a.q}:</strong> ${a.txt}</li>`).join('')}</ul>` : '';
        const cta = level === 'red'
            ? `<button type="button" class="btn btn--primary mt-3 btn-goto-alternatives">قارن أفكاراً بديلة الآن ←</button>`
            : '';

        return `
            ${this._renderIdeaScoreChip()}
            <div class="card" style="background:${palette.bg};border-inline-start:4px solid ${palette.border};">
                <strong style="font-size:1rem;">${palette.icon} ${palette.title}</strong>
                <p class="mb-0 mt-2" style="font-size:.92rem;">${body}</p>
                ${list}
                ${cta}
            </div>`;
    }

    _fitnessCountLabel(suit) {
        const n = FITNESS_FACTORS.filter(f => (suit || {})[f.id] === 'yes').length;
        return n > 0 ? `(${n} من ${FITNESS_FACTORS.length} عوامل ملائمة)` : '';
    }

    _updateResultCard() {
        const el = document.getElementById('pc-result');
        if (el) el.innerHTML = this._renderResultCard(this._collect());
        // زر بطاقة الأحمر يظهر ديناميكياً — أعِد ربطه
        this.container.querySelector('.btn-goto-alternatives')?.addEventListener('click', () => this._goToAlternatives());
    }

    _readTriState(id) {
        const checked = this.container.querySelector(`input[name="${id}"]:checked`);
        const note = document.getElementById(`${id}-note`)?.value?.trim() || '';
        return composeTriState(checked?.value || '', note);
    }

    // يجمع حالة الشاشة كاملة في كائن preliminaryCheck (نصوص مركّبة للتقرير + حقول منظّمة للمنطق)
    _collect() {
        const resources = this._readResourcesFromDom();
        const parts = [];
        if (resources.money) parts.push('مبلغ للبدء');
        if (resources.experience) parts.push('خبرة');
        if (resources.network) parts.push('معارف وموردون');
        const hasInitialResources = parts.length ? `متوفر: ${parts.join('، ')}` : '';

        const suitability = {};
        FITNESS_FACTORS.forEach(f => {
            const box = this.container.querySelector(`input[data-fitness="${f.id}"]`);
            suitability[f.id] = box ? (box.checked ? 'yes' : 'no') : '';
        });

        return {
            isProjectFeasible: this._readTriState('pc-feasible'),
            suitableForEnvironment: this._readTriState('pc-environment'),
            hasInitialResources,
            readyForDetailedStudy: this._readTriState('pc-ready'),
            resources,
            suitability
        };
    }

    _goToAlternatives() {
        const idx = stepIndexById('projectAlternatives');
        if (idx >= 0) this.onNavigate(idx);
    }

    _bindEvents() {
        const save = () => this.store.updatePath('preliminaryCheck', null, this._collect());

        // متابعة: الخطوة التالية مباشرة هي «مقارنة الأفكار» (كانت تقفز فوقها إلى القوالب)
        this.container.querySelector('.btn-continue-preliminary')?.addEventListener('click', () => {
            save();
            this._goToAlternatives();
        });

        // تخطٍ: نحفظ أيضاً (الحفظ رخيص — لا نُضيّع ما أدخله المستخدم بلا تحذير)
        this.container.querySelector('.btn-skip-preliminary')?.addEventListener('click', () => {
            save();
            this._goToAlternatives();
        });

        this.container.querySelector('.btn-goto-alternatives')?.addEventListener('click', () => this._goToAlternatives());

        // أزرار نعم/غير متأكد/لا
        ['pc-feasible', 'pc-environment', 'pc-ready'].forEach(id => {
            this.container.querySelectorAll(`input[name="${id}"]`).forEach(radio => {
                radio.addEventListener('change', () => {
                    const group = this.container.querySelector(`[data-tri="${id}"]`);
                    group?.querySelectorAll('.yesno-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.querySelector('input')?.checked);
                    });
                    const noteEl = document.getElementById(`${id}-note`);
                    if (noteEl) noteEl.style.display = '';
                    save();
                    this._updateResultCard();
                });
            });
            document.getElementById(`${id}-note`)?.addEventListener('blur', save);
        });

        // اختيارات الموارد (checkboxes)
        this.container.querySelectorAll('[data-res-group] input[type="checkbox"]').forEach(box => {
            box.addEventListener('change', () => {
                box.closest('.res-chip')?.classList.toggle('active', box.checked);
                save();
                this._updateResultCard();
            });
        });

        // مبدأ الملاءمة (checkboxes)
        this.container.querySelectorAll('[data-fitness-group] input[type="checkbox"]').forEach(box => {
            box.addEventListener('change', () => {
                box.closest('.res-chip')?.classList.toggle('active', box.checked);
                save();
                const countEl = document.getElementById('pc-fitness-count');
                if (countEl) countEl.textContent = this._fitnessCountLabel(this._collect().suitability);
            });
        });
    }
}
