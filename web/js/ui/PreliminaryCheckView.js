/**
 * الدراسة المبدئية — بوابة فرز (screening gate) قبل التفاصيل.
 * أربعة أسئلة تأهيلية + بطاقة نتيجة فورية توصي: انطلق / راجع / قارن أفكاراً بديلة.
 * يمكن تخطيها للمستخدمين المتقدمين.
 */

import { stepIndexById } from '../core/wizardSteps.js';
import { fieldHelp } from './components/FieldHelp.js';
import { calculateIdeaScore } from '../core/calculateIdeaScore.js';
import { escapeHtml as esc } from '../utils/escape.js';

import Typed from 'typed.js';
import VanillaTilt from 'vanilla-tilt';
import confetti from 'canvas-confetti';
import Swiper from 'swiper';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

// jsdom (بيئة الاختبارات) لا يوفّر 2D context حقيقياً — confetti تكسر بلا هذا الحارس.
function canPlayConfetti() {
    try {
        return !!document.createElement('canvas').getContext('2d');
    } catch {
        return false;
    }
}

// خيارات الأزرار الثلاثة — value معياري إنجليزي، label عربي معروض ومخزّن
const TRI_CHOICES = [
    { value: 'yes', label: 'نعم' },
    { value: 'unsure', label: 'غير متأكد' },
    { value: 'no', label: 'لا' }
];

// أيقونات هيرو داخلية بنفس لغة النظام (24×24، stroke، currentColor) — بديل الإيموجي
const HERO_ICONS = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 1.8"/>',
    skip: '<path d="M6 5v14M18 5 9 12l9 7Z"/>',
    shield: '<path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6Z"/><path d="m9 12 2 2 4-4"/>'
};
const heroIcon = (name) =>
    `<svg class="pc-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HERO_ICONS[name] || ''}</svg>`;

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

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
                    ${chip('pc-res-money', res.money, `${icon('i-bank')} مبلغ للبدء`)}
                    ${chip('pc-res-exp', res.experience, `${icon('i-graduation')} خبرة في المجال`)}
                    ${chip('pc-res-net', res.network, `${icon('i-users')} معارف وموردون`)}
                </div>
            </div>`;
    }

    render() {
        const state = this.store.getState();
        const pc = state.preliminaryCheck || {};
        const res = pc.resources || { money: false, experience: false, network: false };

        this.container.innerHTML = `
            <div class="preliminary-check-view pc-premium">
                <header class="pc-hero" style="min-height: 300px; position: relative; overflow: hidden; border-radius: 12px; margin-bottom: 2rem;">
                    <div style="position: relative; z-index: 2; padding: 2rem;">
                        <span class="pc-hero__glow" aria-hidden="true"></span>
                        <span class="pc-hero__eyebrow"><span class="pc-hero__pulse" aria-hidden="true"></span> الخطوة الأولى — فرز سريع</span>
                        <h1 class="pc-hero__title typed-title" style="min-height: 48px;"></h1>
                        <p class="pc-hero__sub">أربعة أسئلة سريعة تمنحك قراراً مبكراً — <strong>أكمل</strong> أو <strong>راجع</strong> أو <strong>قارن بدائل</strong> — قبل أن تصرف وقتك في التفاصيل. إجابات تقريبية تكفي.
                            ${fieldHelp('الهدف: قرار مبكر «أكمل / راجع / قارن أفكاراً بديلة» قبل صرف وقت في دراسة تفصيلية. تُجمع الإجابات بشكل بسيط من الأهل والمعارف، أو من الغرف التجارية والوزارات ومجلات الاستثمار.', 'مثال: قبل دراسة مطعم، اسأل ٣ من أصحاب المطاعم عن أصعب ما واجههم.')}
                        </p>
                        <div class="pc-hero__meta">
                            <span class="pc-hero__chip">${heroIcon('clock')} أقل من دقيقة</span>
                            <span class="pc-hero__chip">${heroIcon('skip')} يمكنك تخطي الخطوة</span>
                            <span class="pc-hero__chip">${heroIcon('shield')} بدون التزام — إجابات تقريبية</span>
                        </div>
                    </div>
                </header>

                <div class="card analysis-card pc-card mb-4" data-tilt>
                    <h3 class="card-title pc-card__title">أسئلة تأهيلية</h3>
                    <div class="swiper-container" style="overflow: hidden; padding: 1rem 0;">
                        <div class="swiper-wrapper">
                            <div class="swiper-slide">
                                ${this._renderTriQuestion('pc-feasible',
                                    `1. هل المشروع ممكن تنفيذه؟ (بناءً على معلومات أولية) ${fieldHelp('هل يمكن فعلياً تنفيذ الفكرة بالإمكانات المتاحة في السوق؟ لا يلزم يقين — انطباع أولي يكفي.', 'مثال: مقهى صغير في حي سكني — نعم، المعدات والموردون متوفرون.')}`,
                                    pc.isProjectFeasible)}
                            </div>
                            <div class="swiper-slide">
                                ${this._renderTriQuestion('pc-environment',
                                    `2. هل المشروع مناسب للبيئة التي ستعمل فيها؟ ${fieldHelp('هل يناسب المشروع الموقع والمنطقة وطبيعة السكان وعاداتهم الشرائية؟', 'مثال: مطعم عائلي في حي عائلات — مناسب؛ مقهى ليلي بجوار مدارس — غير مناسب.')}`,
                                    pc.suitableForEnvironment)}
                            </div>
                            <div class="swiper-slide">
                                ${this._renderResources(res)}
                            </div>
                            <div class="swiper-slide">
                                ${this._renderTriQuestion('pc-ready',
                                    `4. هل أنت جاهز للدراسة التفصيلية؟ ${fieldHelp('الدراسة التفصيلية تحتاج وقتاً لجمع أرقام حقيقية: أسعار، إيجارات، رواتب، منافسين.', 'مثال: نعم — لدي أسبوعان لزيارة المنافسين وسؤال الموردين عن الأسعار.')}`,
                                    pc.readyForDetailedStudy)}
                            </div>
                        </div>
                        <div class="swiper-pagination"></div>
                        <div class="swiper-button-prev"></div>
                        <div class="swiper-button-next"></div>
                    </div>
                </div>

                <!-- بطاقة النتيجة الفورية -->
                <div id="pc-result" class="mb-4">${this._renderResultCard(pc)}</div>
            </div>
        `;

        this._bindEvents();
        
        // --- UX Libraries Initialization ---
        
        // 1. Typed.js
        const titleEl = this.container.querySelector('.typed-title');
        if (titleEl) {
            new Typed(titleEl, {
                strings: ['مرحباً بك في دراسة الجدوى..', 'قبل التفاصيل، لنتأكد أن فكرتك <span class="pc-hero__accent">تستحق الدراسة</span>'],
                typeSpeed: 40,
                backSpeed: 20,
                showCursor: false
            });
        }

        // 2. Swiper.js
        // تحقّق حي 2026-07-16: observer/observeParents (MutationObserver على كل
        // الأسلاف) كانا يسبّبان تجمّداً كاملاً للصفحة عند رسم هذه الخطوة داخل صفحة
        // التصنيف — الحلقة المتسلسلة في StudyCategoryView.render() تضيف 6 أقسام
        // إخوة أخرى لنفس السلف مباشرة بعد تهيئة Swiper هنا، فيُطلق observeParents
        // إعادة حساب height (autoHeight) عند كل إضافة، وإعادة الحساب نفسها تُحدث
        // الحاوية فتُطلق المراقب من جديد — لا حارس تكرار مثل ResizeObserver المدمج.
        // الإصلاح الأصلي (عرض شريحة ثابت 445px بعد تصغير النافذة لعرض 375px) لا
        // يحتاج المراقبة الواسعة أصلاً: resizeObserver وupdateOnWindowResize كلاهما
        // true افتراضياً في Swiper (راقبا حاوية Swiper نفسها فقط، لا كل الأسلاف)
        // ويغطيان تماماً تصغير النافذة/تدوير الجهاز/تغيّر تخطيط البطاقة الأب.
        new Swiper(this.container.querySelector('.swiper-container'), {
            modules: [Navigation, Pagination],
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            spaceBetween: 30,
            autoHeight: true
        });

        // 4. Vanilla-Tilt.js
        VanillaTilt.init(this.container.querySelectorAll("[data-tilt]"), {
            max: 5,
            speed: 400,
            glare: true,
            "max-glare": 0.1,
        });
        
        // Call result computation initially to check if we should trigger confetti
        const initialResult = this._computeResult(pc);
        this.lastLevel = initialResult.level;
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
        const dotClass = ['green', 'yellow', 'red'].includes(color) ? `pc-dot--${color}` : '';
        const completenessPct = Math.round((breakdown.completeness / 40) * 100);
        return `
            <div class="card mb-3" style="padding:.75rem 1rem;">
                <div class="flex-between" style="align-items:center;">
                    <strong style="font-size:.92rem;"><span class="pc-dot ${dotClass}"></span>نتيجة الفكرة الأولية: ${score}/100</strong>
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
            green: { title: 'مؤشرات أولية إيجابية' },
            yellow: { title: 'مؤشرات مقبولة مع نقاط تحتاج انتباهاً' },
            red: { title: 'إشارات تحذير — تأنَّ قبل الدراسة التفصيلية' }
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
            <div class="pc-result pc-result--${level}">
                <strong style="font-size:1rem;"><span class="pc-dot pc-dot--${level}"></span>${palette.title}</strong>
                <p class="mb-0 mt-2" style="font-size:.92rem;">${body}</p>
                ${list}
                ${cta}
            </div>`;
    }

    _updateResultCard() {
        const resultDiv = document.getElementById('pc-result');
        const pc = this._collect();
        if (resultDiv) {
            resultDiv.innerHTML = this._renderResultCard(pc);
            
            // 5. Confetti! (If the level turns to green and wasn't green before)
            const newLevel = this._computeResult(pc).level;
            if (newLevel === 'green' && this.lastLevel !== 'green' && canPlayConfetti()) {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
            this.lastLevel = newLevel;
        }
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

        return {
            isProjectFeasible: this._readTriState('pc-feasible'),
            suitableForEnvironment: this._readTriState('pc-environment'),
            hasInitialResources,
            readyForDetailedStudy: this._readTriState('pc-ready'),
            resources
        };
    }

    _goToAlternatives() {
        const idx = stepIndexById('projectAlternatives');
        if (idx >= 0) this.onNavigate(idx);
    }

    _bindEvents() {
        const save = () => this.store.updatePath('preliminaryCheck', null, this._collect());

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

        // زر «قارن أفكاراً بديلة» يُرسَم في الرسم الأولي إن كانت النتيجة المحفوظة حمراء
        // (تدقيق 2026-07-11): كان يُربَط فقط داخل _updateResultCard (بعد تغيير المستخدم لإجابة)
        // فيبقى ميتاً عند العودة للخطوة بنتيجة سلبية محفوظة. نربطه هنا أيضاً.
        this.container.querySelector('.btn-goto-alternatives')?.addEventListener('click', () => this._goToAlternatives());
    }
}
