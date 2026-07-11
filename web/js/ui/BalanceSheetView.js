import { stepIndexById } from '../core/wizardSteps.js';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

/**
 * Balance Sheet Display Component
 * Shows projected balance sheets with Assets, Liabilities, Equity
 */
export class BalanceSheetView {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.selectedYear = 1;
    }

    render(balanceSheets) {
        if (!balanceSheets || balanceSheets.length === 0) {
            this.container.innerHTML = `
                <div class="card glass-card">
                    <h2 class="card-title">الميزانية العمومية التقديرية</h2>
                    <div class="empty-state">
                        <p class="text-muted">لا تتوفر بيانات كافية لإنشاء الميزانية العمومية</p>
                    </div>
                </div>
            `;
            return;
        }

        const sheet = balanceSheets[this.selectedYear - 1] || balanceSheets[0];

        this.container.innerHTML = `
            <div class="card glass-card">
                <div class="card-header flex justify-between items-center">
                    <h2 class="card-title">الميزانية العمومية التقديرية</h2>
                    <div class="year-selector">
                        ${balanceSheets.map((s, idx) => `
                            <button class="btn-xs ${this.selectedYear === idx + 1 ? 'btn--primary' : 'btn--ghost'}" 
                                    data-year="${idx + 1}">
                                السنة ${idx + 1}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="balance-sheet-container">
                    <!-- ASSETS -->
                    <div class="bs-section assets">
                        <h4 class="bs-section-title">${icon('i-box')} الأصول</h4>
                        
                        <div class="bs-group">
                            <div class="bs-group-title">الأصول المتداولة</div>
                            <div class="bs-line">
                                <span>النقدية وما يعادلها</span>
                                <span>${this.formatCurrency(sheet.assets.current.cash)}</span>
                            </div>
                            <div class="bs-line">
                                <span>حسابات مدينة</span>
                                <span>${this.formatCurrency(sheet.assets.current.accountsReceivable)}</span>
                            </div>
                            <div class="bs-line">
                                <span>المخزون</span>
                                <span>${this.formatCurrency(sheet.assets.current.inventory)}</span>
                            </div>
                            <div class="bs-subtotal">
                                <span>إجمالي الأصول المتداولة</span>
                                <span>${this.formatCurrency(sheet.assets.current.total)}</span>
                            </div>
                        </div>

                        <div class="bs-group">
                            <div class="bs-group-title">الأصول الثابتة</div>
                            <div class="bs-line">
                                <span>الأصول الثابتة (الإجمالي)</span>
                                <span>${this.formatCurrency(sheet.assets.fixed.gross)}</span>
                            </div>
                            <div class="bs-line negative">
                                <span>(-) مجمع الاستهلاك</span>
                                <span>(${this.formatCurrency(sheet.assets.fixed.accumulatedDepreciation)})</span>
                            </div>
                            <div class="bs-subtotal">
                                <span>صافي الأصول الثابتة</span>
                                <span>${this.formatCurrency(sheet.assets.fixed.net)}</span>
                            </div>
                        </div>

                        <div class="bs-total assets-total">
                            <span>إجمالي الأصول</span>
                            <span>${this.formatCurrency(sheet.assets.total)}</span>
                        </div>
                    </div>

                    <!-- LIABILITIES & EQUITY -->
                    <div class="bs-section liabilities">
                        <h4 class="bs-section-title">${icon('i-bank')} الخصوم وحقوق الملكية</h4>
                        
                        <div class="bs-group">
                            <div class="bs-group-title">الخصوم المتداولة</div>
                            <div class="bs-line">
                                <span>حسابات دائنة</span>
                                <span>${this.formatCurrency(sheet.liabilities.current.accountsPayable)}</span>
                            </div>
                            <div class="bs-line">
                                <span>القسط الحالي من القرض</span>
                                <span>${this.formatCurrency(sheet.liabilities.current.currentPortionOfDebt)}</span>
                            </div>
                            ${(sheet.liabilities.current.cashShortfall || 0) > 0 ? `
                            <div class="bs-line negative">
                                <span>${icon('i-warning')} عجز سيولة تراكمي (تمويل قصير أجل ضمني مطلوب)</span>
                                <span>${this.formatCurrency(sheet.liabilities.current.cashShortfall)}</span>
                            </div>
                            ` : ''}
                            <div class="bs-subtotal">
                                <span>إجمالي الخصوم المتداولة</span>
                                <span>${this.formatCurrency(sheet.liabilities.current.total)}</span>
                            </div>
                        </div>

                        <div class="bs-group">
                            <div class="bs-group-title">الخصوم طويلة الأجل</div>
                            <div class="bs-line">
                                <span>القرض البنكي</span>
                                <span>${this.formatCurrency(sheet.liabilities.longTerm.bankLoan)}</span>
                            </div>
                            <div class="bs-subtotal">
                                <span>إجمالي الخصوم</span>
                                <span>${this.formatCurrency(sheet.liabilities.total)}</span>
                            </div>
                        </div>

                        <div class="bs-group">
                            <div class="bs-group-title">حقوق الملكية</div>
                            <div class="bs-line">
                                <span>رأس المال المدفوع</span>
                                <span>${this.formatCurrency(sheet.equity.paidInCapital)}</span>
                            </div>
                            <div class="bs-line ${sheet.equity.retainedEarnings >= 0 ? 'positive' : 'negative'}">
                                <span>الأرباح المحتجزة</span>
                                <span>${this.formatCurrency(sheet.equity.retainedEarnings)}</span>
                            </div>
                            <div class="bs-subtotal">
                                <span>إجمالي حقوق الملكية</span>
                                <span>${this.formatCurrency(sheet.equity.total)}</span>
                            </div>
                        </div>

                        ${Math.abs(sheet.fundingGap || 0) > 5 ? `
                        <div class="bs-group">
                            <div class="bs-line negative">
                                <span>${(sheet.fundingGap || 0) > 0 ? `${icon('i-warning')} فجوة تمويل غير مغطاة (مصادر التمويل أقل من الاستثمار)` : 'فائض تمويل فوق الاستثمار المطلوب'}</span>
                                <span>${this.formatCurrency(sheet.fundingGap)}</span>
                            </div>
                            ${(sheet.fundingGap || 0) > 0 ? `
                            <div class="bs-funding-gap-hint">
                                <span>عادة ما يظهر هذا بعد ضبط التمويل إذا عُدِّل بند تكلفة (فني/تشغيلي) لاحقاً — إجمالي الاستثمار يُعاد حسابه حياً بينما تبقى مصادر التمويل عند آخر مبلغ أدخلته. راجع خطوة التمويل وأعد الضغط على «سدّ الفجوة».</span>
                                <button type="button" class="btn-xs btn--secondary btn-go-financing">${icon('i-reset')} إعادة ضبط التمويل</button>
                            </div>
                            ` : ''}
                        </div>
                        ` : ''}
                        <div class="bs-total liabilities-total">
                            <span>الخصوم + حقوق الملكية${Math.abs(sheet.fundingGap || 0) > 5 ? ' (شاملة فجوة التمويل)' : ''}</span>
                            <span>${this.formatCurrency(sheet.totalLiabilitiesAndEquity)}</span>
                        </div>
                    </div>
                </div>

                <!-- Balance Check -->
                <div class="balance-check ${sheet.isBalanced ? 'balanced' : 'unbalanced'}">
                    ${sheet.isBalanced
                ? `${icon('i-check')} الميزانية متوازنة (الأصول = الخصوم + حقوق الملكية)`
                : `${icon('i-warning')} تنبيه: الميزانية غير متوازنة! الفرق: ` + this.formatCurrency(sheet.imbalance)
            }
                </div>
                ${!sheet.isBalanced ? `<div class="balance-check-reason">${this.getImbalanceReason(sheet)}</div>` : ''}
            </div>

            <style>
                .balance-sheet-container {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    margin: 16px 0;
                }
                @media (max-width: 768px) {
                    .balance-sheet-container {
                        grid-template-columns: 1fr;
                    }
                }
                .bs-section {
                    background: rgba(255,255,255,0.03);
                    border-radius: 8px;
                    padding: 16px;
                }
                .bs-section-title {
                    font-size: 1rem;
                    font-weight: 600;
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--c-border);
                }
                .bs-group {
                    margin-bottom: 16px;
                }
                .bs-group-title {
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--c-text-muted);
                    margin-bottom: 8px;
                }
                .bs-line {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 0;
                    font-size: 0.9rem;
                }
                .bs-line.negative { color: #f87171; }
                .bs-line.positive { color: #34d399; }
                .bs-subtotal {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    font-weight: 600;
                    border-top: 1px dashed var(--c-border);
                    margin-top: 4px;
                }
                .bs-total {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px;
                    font-weight: 700;
                    font-size: 1.1rem;
                    border-radius: 6px;
                    margin-top: 8px;
                }
                .assets-total { background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(52,211,153,0.1)); }
                .liabilities-total { background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1)); }
                .balance-check {
                    text-align: center;
                    padding: 12px;
                    border-radius: 8px;
                    font-weight: 500;
                }
                .balance-check.balanced { background: rgba(16,185,129,0.15); color: #34d399; }
                .balance-check.unbalanced { background: rgba(239,68,68,0.15); color: #f87171; }
                .balance-check-reason {
                    margin-top: 8px;
                    padding: 10px 12px;
                    font-size: 0.85rem;
                    color: var(--c-text-muted);
                    background: rgba(255,255,255,0.04);
                    border-radius: 6px;
                    border-right: 3px solid #f59e0b;
                    text-align: right;
                    line-height: 1.5;
                }
                .balance-check-reason strong { color: var(--c-text-main); }
                .year-selector {
                    display: flex;
                    gap: 4px;
                }
                .bs-funding-gap-hint {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 8px;
                    margin-top: 4px;
                    padding: 8px 10px;
                    font-size: 0.8rem;
                    color: var(--c-text-muted);
                    background: rgba(245,158,11,0.08);
                    border-radius: 6px;
                    border-right: 3px solid #f59e0b;
                }
            </style>
        `;

        // Bind year selector
        this.container.querySelectorAll('.year-selector button').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedYear = parseInt(btn.dataset.year);
                this.render(balanceSheets);
            });
        });

        // زر «إعادة ضبط التمويل»: يعيد المستخدم لخطوة التمويل ليعيد ضغط «سدّ الفجوة» بعد
        // أن تغيّر إجمالي الاستثمار (تدقيق ٢٠٢٦-٠٧-١٠) — الفجوة هنا مُعاد حسابها حياً من
        // نفس محرك التمويل الوحيد (engine.js)، وليست قيمة مخزَّنة وقت الموازنة السابقة؛
        // الانحراف حقيقي بسبب تعديل بند تكلفة لاحق، فالحل توجيه المستخدم لا "تصحيح" الحساب.
        this.container.querySelector('.btn-go-financing')?.addEventListener('click', () => {
            if (!this.onNavigate) return;
            const idx = stepIndexById('financing');
            if (idx >= 0) this.onNavigate(idx);
        });
    }

    /**
     * يشرح سبب عدم توازن الميزانية (الفرق = الأصول − (الخصوم + حقوق الملكية)).
     * فرق سالب يعني: الخصوم + حقوق الملكية أعلى من الأصول.
     */
    getImbalanceReason(sheet) {
        const im = sheet.imbalance || 0;
        const dir = im < 0 ? 'سالب' : 'موجب';
        const lines = [];

        lines.push(`<strong>الفرق ${dir}</strong> — أي أن ${im < 0 ? 'الخصوم + حقوق الملكية أكبر من الأصول' : 'الأصول أكبر من الخصوم + حقوق الملكية'}.`);

        if (im < 0) {
            lines.push('<strong>أسباب محتملة:</strong>');
            lines.push('• <strong>تكرار القسط الحالي من القرض:</strong> الرصيد المتبقي للقرض (طويل الأجل) يعكس المبلغ بعد خصم أصل السنة. إذا أُضيف «القسط الحالي» (أصل مُسدَّد خلال السنة نفسها) إلى الخصوم، يُحتسب مرتين فتُبالغ الخصوم.');
            lines.push('• <strong>تقدير النقدية:</strong> النموذج يقدّر النقدية = رأسمال عامل + أرباح محتجزة، دون خصم أقساط الأصل الفعلية، فلا يعكس الصرف الحقيقي على السداد.');
            lines.push('• <strong>تبسيطات:</strong> اعتماد حسابات مدينة، مخزون، ودائنة = 0 قد يزيد الاختلاف عن الواقع.');
        } else {
            lines.push('<strong>أسباب محتملة:</strong>');
            lines.push('• <strong>تقدير النقدية:</strong> إذا لم تُخصم أقساط الأصل من التدفق، قد تُبالغ في النقدية (الأصول).');
            lines.push('• <strong>تبسيطات</strong> في بند الخصوم أو حقوق الملكية.');
        }

        return lines.join('<br>');
    }

    formatCurrency(value) {
        if (!value && value !== 0) return '--';
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR',
            maximumFractionDigits: 0
        }).format(value);
    }
}
