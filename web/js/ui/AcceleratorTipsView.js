/**
 * نصائح للتقديم للمسرّعات — قائمة بنود: وضوح الفكرة، الأرقام، المخاطر، الفريق، متطلبات كل مسرّعة
 * قائمة تحقق "متطلبات التقديم" (ملخص، مالي، مخاطر، الطلب) — حاضنات ومسرّعات عربية (القسم 18)
 */
export class AcceleratorTipsView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onBack = options.onBack || (() => {});
        this.store = options.store || null;
    }

    render() {
        if (!this.container) return;

        const tips = [
            { title: 'وضوح الفكرة', text: 'قدّم المشكلة والحل في جملتين. المستثمر يريد أن يفهم ماذا تفعل ولماذا يهمّ — ابدأ من هناك.' },
            { title: 'إبراز الأرقام والمؤشرات', text: 'اعرض أهم ثلاثة: صافي القيمة الحالية، فترة الاسترداد، نقطة التعادل. استخدم تصدير "عرض للمستثمر/المسرّعة" من المنصة.' },
            { title: 'ذكر المخاطر وخطط التخفيف', text: 'لا تخفِ المخاطر. اذكر أبرز مخاطرين وكيف ستخفّفها — يبني الثقة ويُظهر نضجاً.' },
            { title: 'تعريف الفريق', text: 'من هم؟ ما خبراتهم؟ لماذا هم الأنسب لتنفيذ هذا المشروع؟ الفريق القوي يزيد فرص القبول.' },
            { title: 'التحقق من متطلبات كل مسرّعة', text: 'كل مسرّعة أو برنامج تمويل له شروط ومواعيد. راجع موقعها الرسمي وقدم بما يطلبونه بالضبط.' }
        ];

        const checklistItems = [
            { id: 'exec_summary', label: 'ملخص تنفيذي (المشكلة، الحل، الرؤية)' },
            { id: 'financial', label: 'جداول مالية ومؤشرات (NPV، استرداد، تعادل)' },
            { id: 'risks', label: 'تحليل المخاطر وخطط التخفيف' },
            { id: 'request', label: 'الطلب (مبلغ التمويل واستخدامات الأموال)' },
            { id: 'contact', label: 'جهة اتصال (اسم، بريد)' }
        ];

        this.container.innerHTML = `
            <div class="accelerator-tips-view animate-entry p-6 max-w-2xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="acceleratorTipsBack">← العودة</button>
                <h1 class="text-2xl font-bold mb-2">نصائح للتقديم للمسرّعات</h1>
                <p class="text-muted mb-6">بنود عامة تساعدك عند التقديم لمسرّعة أو مستثمر — لغة مختصرة وتحفيزية.</p>

                <ol class="space-y-5 list-decimal list-inside">
                    ${tips.map((t) => `
                        <li class="card card-hover p-4">
                            <h3 class="font-bold text-gold mb-2">${t.title}</h3>
                            <p class="text-sm text-muted">${t.text}</p>
                        </li>
                    `).join('')}
                </ol>

                <section class="mt-8 card p-5" aria-labelledby="checklist-title">
                    <h2 id="checklist-title" class="text-lg font-bold mb-4">قائمة تحقق: متطلبات التقديم للمسرّعة/الحاضنة</h2>
                    <p class="text-sm text-muted mb-4">تأكد من إكمال هذه البنود في دراستك قبل تصدير العرض.</p>
                    <ul class="space-y-3" id="acceleratorChecklist">
                        ${checklistItems.map((item) => `
                            <li>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" class="accelerator-check" data-id="${item.id}" />
                                    <span>${item.label}</span>
                                </label>
                            </li>
                        `).join('')}
                    </ul>
                    <p id="acceleratorChecklistDone" class="mt-4 text-sm font-medium text-success hidden" role="status">جميع البنود مكتملة — يمكنك تصدير العرض للمسرّعة/الحاضنة من قائمة التصدير.</p>
                </section>

                <p class="text-sm text-muted mt-8 text-center">بعد إعداد دراستك، استخدم تصدير <strong>عرض للمستثمر/المسرّعة</strong> أو <strong>عرض للمسرّعة</strong> أو <strong>عرض للحاضنة</strong> من قائمة التصدير للحصول على صفحة واحدة جاهزة للطباعة.</p>
            </div>
        `;

        this.container.querySelector('#acceleratorTipsBack')?.addEventListener('click', () => this.onBack());

        const checkboxes = this.container.querySelectorAll('.accelerator-check');
        const doneEl = this.container.querySelector('#acceleratorChecklistDone');
        const updateDone = () => {
            const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
            if (doneEl) doneEl.classList.toggle('hidden', !allChecked);
        };
        checkboxes.forEach((cb) => {
            cb.addEventListener('change', updateDone);
        });

        if (this.store) {
            try {
                const state = this.store.getState ? this.store.getState() : this.store.get();
                const info = state.projectInfo || {};
                const exec = state.executiveSummary || {};
                const financing = state.financing || {};
                const risks = (state.riskAnalysis?.risks || []).filter((r) => r.name || r.description);
                const keyPeople = (state.keyPeople?.keyPeople || []).slice(0, 1);
                const hasExec = !!(exec.problemStatement || exec.solutionStatement || info.startupHypothesis?.problem || info.concept);
                const hasFinancial = !!(financing.totalInvestment || financing.sources?.equity?.amount || financing.sources?.bankLoan?.amount);
                const hasRisks = risks.length >= 1;
                const hasRequest = !!(financing.totalInvestment || financing.useOfFunds);
                const hasContact = keyPeople.length > 0 && (keyPeople[0].name || keyPeople[0].email);
                const precheck = { exec_summary: hasExec, financial: hasFinancial, risks: hasRisks, request: hasRequest, contact: hasContact };
                checkboxes.forEach((cb) => {
                    const id = cb.getAttribute('data-id');
                    if (precheck[id]) cb.checked = true;
                });
                updateDone();
            } catch (_) { /* ignore */ }
        }
    }
}
