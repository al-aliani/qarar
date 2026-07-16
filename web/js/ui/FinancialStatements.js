/**
 * Financial Statements Component
 * Displays Income Statement, Cash Flow, and Balance Sheet for 5 years
 */
import { calculateStudy as runFullModel } from '../core/engine.js';
import { investmentDataWarning, investmentDataWarningHtml } from '../utils/dataQuality.js';
import ApexCharts from 'apexcharts';
import { CountUp } from 'countup.js';
import html2pdf from 'html2pdf.js';
import { loadXLSX } from '../../export/utils.js';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

// الـshim (xlsxShim.js) لا يوفّر table_to_sheet — نبني AOA يدوياً من صفوف/خلايا الجدول.
function tableToAOA(table) {
    return Array.from(table.rows).map(row => Array.from(row.cells).map(cell => cell.textContent.trim()));
}

export class FinancialStatements {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        let results = null;
        let errorMessage = null;
        
        try {
            results = runFullModel(state);
            
            // Validate that we have minimum required data
            if (!results) {
                errorMessage = 'فشل في حساب النموذج المالي. يرجى التحقق من البيانات المدخلة.';
            } else if (!Array.isArray(results.incomeStatement) || results.incomeStatement.length === 0 || !(results.incomeStatement[0].revenue > 0)) {
                // المحرك الحالي يُخرج الإيراد عبر incomeStatement (لا revenueProjection) — الفحص القديم كان يطلق تحذيراً كاذباً دائماً
                errorMessage = 'لا توجد بيانات إيرادات. يرجى إضافة مصادر الإيرادات في خطوة "مصادر الإيرادات".';
            } else if (!results.capex || results.capex.total === 0) {
                errorMessage = 'لا توجد بيانات استثمارات. يرجى إضافة التكاليف الرأسمالية في خطوة "الدراسة الفنية".';
            }
        } catch (e) {
            console.error('Financial Model Error:', e);
            errorMessage = `خطأ في الحساب: ${e.message || 'خطأ غير معروف'}`;
        }
        
        // Show error message if any
        if (errorMessage) {
            this.container.innerHTML = `
                <div class="financial-statements">
                    <h2 class="section-title">القوائم المالية التقديرية</h2>
                    <div class="card analysis-card">
                        <div class="alert alert--warning">
                            <p><strong>${icon('i-warning')} ${errorMessage}</strong></p>
                            <p class="text-sm mt-2">تأكد من إكمال:</p>
                            <ul class="text-sm mt-2" style="list-style: disc; padding-right: 20px;">
                                <li>مصادر الإيرادات (خطوة "مصادر الإيرادات")</li>
                                <li>التكاليف الرأسمالية (خطوة "الدراسة الفنية")</li>
                                <li>التكاليف التشغيلية (خطوة "الموارد البشرية" و "الموارد اللوجستية" و "الموارد الإدارية")</li>
                            </ul>
                        </div>
                    </div>
                    <div class="wizard-nav margin-top-lg">
                        <button class="btn btn--secondary btn-prev-step">السابق</button>
                        <button class="btn btn--primary btn-next-step">التالي</button>
                    </div>
                </div>
            `;
            this.bindEvents();
            return;
        }

        // تحذير جودة البيانات: أصول غير مُدرجة أو تمويل لا يطابق الاستثمار — أعلى القوائم مباشرة
        const dataWarnHtml = investmentDataWarningHtml(investmentDataWarning(state, results));

        this.container.innerHTML = `
            <div class="financial-statements" id="financial-statements-content">
                <div class="flex-between mb-4">
                    <h2 class="section-title mb-0">القوائم المالية التقديرية</h2>
                    <div class="flex gap-2">
                        <button id="btnExportExcel" class="btn btn--sm btn--magic"><svg class="ic" aria-hidden="true"><use href="#i-table"/></svg> تصدير Excel</button>
                        <button id="btnExportPdf" class="btn btn--sm btn--secondary"><svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg> تحميل PDF</button>
                    </div>
                </div>
                
                <div class="card mb-6 bg-slate-900 text-white" style="border-radius: 12px; padding: 24px;">
                    <h3 class="text-slate-300 text-sm mb-2">إجمالي الأرباح المتوقعة (5 سنوات)</h3>
                    <div id="totalProfitCounter" class="text-4xl font-bold text-emerald-400">0</div>
                </div>

                ${dataWarnHtml}
                
                <div class="card analysis-card">
                    <h3 class="card-title">${icon('i-chart')} الأداء المالي المتوقع (إيرادات مقابل تكاليف)</h3>
                    <div id="financialPerformanceChart" style="min-height: 350px;"></div>
                </div>

                <div class="card analysis-card">
                    <h3 class="card-title">${icon('i-doc')} قائمة الدخل التقديرية (5 سنوات)</h3>
                    ${this.renderIncomeStatement(results)}
                </div>

                <div class="card analysis-card">
                    <h3 class="card-title">${icon('i-chart')} قائمة التدفقات النقدية</h3>
                    ${this.renderCashFlow(results)}
                </div>

                <div class="card analysis-card">
                    <h3 class="card-title">${icon('i-calendar')} قائمة التدفقات النقدية ربع سنوية (السنة الأولى)</h3>
                    <p class="text-muted text-sm mb-3">توزيع الإيرادات ربعياً مشتق من منحنى التصاعد المُدخل في الافتراضات (rampUp) — مجموع الأرباع = إيراد السنة الأولى بالضبط، دون خصم البداية البطيئة مرتين</p>
                    ${this.renderQuarterlyCashFlow(results)}
                </div>

                ${this.renderSeasonality(results, state)}

                <div class="card analysis-card">
                    <h3 class="card-title">${icon('i-scale')} الميزانية العمومية التقديرية (الافتتاحية — سنة الأساس)</h3>
                    ${this.renderBalanceSheet(results, state)}
                </div>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents();
        this.renderApexChart(results);
        this.initCountUp(results);
    }

    renderApexChart(results) {
        if (!results || !results.incomeStatement) return;
        const years = results.incomeStatement.map(y => `السنة ${y.year}`);
        const revenues = results.incomeStatement.map(y => y.revenue);
        const netProfits = results.incomeStatement.map(y => y.netIncome);

        const options = {
            series: [{
                name: 'الإيرادات',
                type: 'column',
                data: revenues
            }, {
                name: 'صافي الربح',
                type: 'line',
                data: netProfits
            }],
            chart: {
                height: 350,
                type: 'line',
                fontFamily: 'inherit',
                toolbar: { show: false }
            },
            stroke: { width: [0, 4] },
            colors: ['#0ea5e9', '#10b981'],
            dataLabels: { enabled: false },
            labels: years,
            yaxis: [{ title: { text: 'القيمة (ريال)' } }],
            theme: { mode: 'light' }
        };

        const chartElement = this.container.querySelector('#financialPerformanceChart');
        if (chartElement) {
            try {
                const chart = new ApexCharts(chartElement, options);
                chart.render().catch(err => console.error('ApexCharts render error:', err));
            } catch (err) {
                console.error('ApexCharts init error:', err);
            }
        }
    }

    initCountUp(results) {
        if (!results || !results.incomeStatement) return;
        const totalProfit = results.incomeStatement.reduce((sum, y) => sum + (y.netIncome || 0), 0);
        const counterEl = this.container.querySelector('#totalProfitCounter');
        if (counterEl) {
            const countUp = new CountUp(counterEl, totalProfit, {
                suffix: ' ر.س',
                duration: 2.5,
                separator: ','
            });
            if (countUp.error) return;
            // تحقّق حي 2026-07-16: التحريك يعتمد requestAnimationFrame — لا يُطلَق إطلاقاً
            // في تبويب مخفي (نفس علة rAF الموثَّقة في StudyCategoryView.render)، فيبقى
            // العداد عالقاً على "0" للأبد إن رُسمت الخطوة والتبويب في الخلفية (فتح رابط
            // بتبويب خلفي، أو عودة من سكون). نعرض القيمة النهائية مباشرة حينها بدل التحريك.
            if (document.hidden) countUp.printValue(totalProfit);
            else countUp.start();
        }
    }

    bindEvents() {
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });

        // PDF Export
        this.container.querySelector('#btnExportPdf')?.addEventListener('click', () => {
            const element = this.container.querySelector('#financial-statements-content');
            html2pdf().from(element).set({
                margin: 10,
                filename: 'القوائم_المالية.pdf',
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            }).save();
        });

        // Excel Export
        this.container.querySelector('#btnExportExcel')?.addEventListener('click', async () => {
            await loadXLSX();
            const tables = this.container.querySelectorAll('table');
            const wb = window.XLSX.utils.book_new();
            tables.forEach((table, i) => {
                const ws = window.XLSX.utils.aoa_to_sheet(tableToAOA(table));
                window.XLSX.utils.book_append_sheet(wb, ws, `جدول ${i + 1}`);
            });
            await window.XLSX.writeFile(wb, 'القوائم_المالية.xlsx');
        });
    }

    renderIncomeStatement(results) {
        if (!results || !results.incomeStatement || !Array.isArray(results.incomeStatement) || results.incomeStatement.length === 0) {
            return '<p class="text-muted">بيانات غير كافية. يرجى إكمال البيانات المالية الأساسية (الإيرادات، التكاليف، الاستثمارات).</p>';
        }

        const incomeStatement = results.incomeStatement;
        const getInterest = (y) => Number(y?.interestExpense ?? y?.interest ?? 0) || 0;
        const getProfitBeforeZakat = (y) => Number(y?.profitBeforeZakat ?? y?.ebt ?? y?.ebit ?? 0) || 0;

        return `
            <div class="table-container scrollable-x">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>البند</th>
                            ${incomeStatement.map((yearData) => `<th>السنة ${yearData.year}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>إجمالي الإيرادات</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(y.revenue)}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>(-) التكاليف المتغيرة</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-y.variableCosts)}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>(-) التكاليف الثابتة</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-y.fixedCosts)}</td>`).join('')}
                        </tr>
                        ${incomeStatement.some(y => (y.franchiseFees || 0) > 0) ? `
                        <tr>
                            <td>(-) رسوم الامتياز (إتاوات وتسويق)</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-(y.franchiseFees || 0))}</td>`).join('')}
                        </tr>` : ''}
                        <tr class="row-subtotal">
                            <td><strong>الربح التشغيلي (EBITDA)</strong></td>
                            ${incomeStatement.map(y => `<td class="text-mono"><strong>${this.formatCurrency(y.ebitda)}</strong></td>`).join('')}
                        </tr>
                        ${incomeStatement.some(y => (y.builderSuccessFee || 0) > 0) ? `
                        <tr>
                            <td>(-) رسوم نجاح الحاضنة</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-(y.builderSuccessFee || 0))}</td>`).join('')}
                        </tr>` : ''}
                        <tr>
                            <td>(-) الإهلاك</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-y.depreciation)}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>(-) مصروفات الفوائد</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-getInterest(y))}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>الأرباح قبل الزكاة والضريبة (EBT)</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(getProfitBeforeZakat(y))}</td>`).join('')}
                        </tr>
                        <tr>
                            <td title="الزكاة تُحسب على وعاء رأس المال (حقوق الملكية + مخصصات معيّنة)، لا على صافي الربح — لذا قد تظهر حتى في سنة خسارة تشغيلية. هذا صحيح شرعاً/نظاماً وليس خطأ حسابياً.">(-) الزكاة <span class="text-muted" style="cursor:help;" aria-hidden="true">ⓘ</span></td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-(y.zakat || 0))}</td>`).join('')}
                        </tr>
                        ${incomeStatement.some(y => (y.tax || 0) > 0) ? `
                        <tr>
                            <td>(-) ضريبة الدخل (حصة الملكية الأجنبية)</td>
                            ${incomeStatement.map(y => `<td class="text-mono">${this.formatCurrency(-(y.tax || 0))}</td>`).join('')}
                        </tr>` : ''}
                        <tr class="row-total">
                            <td><strong>صافي الربح</strong></td>
                            ${incomeStatement.map(y => `<td class="text-mono"><strong>${this.formatCurrency(y.netIncome)}</strong></td>`).join('')}
                        </tr>
                        <tr>
                            <td>هامش الربح الصافي</td>
                            ${incomeStatement.map(y => `<td>${(y.revenue > 0 ? (y.netIncome / y.revenue) * 100 : 0).toFixed(1)}%</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    renderQuarterlyCashFlow(results) {
        if (!results || !results.incomeStatement || results.incomeStatement.length === 0) {
            return '<p class="text-muted">بيانات غير كافية.</p>';
        }
        const y1 = results.incomeStatement[0];
        const annualRevenue = y1.revenue || 0;
        const annualOpex = (y1.fixedCosts || 0) + (y1.variableCosts || 0);
        // التوزيع الربعي يُشتق من منحنى التصاعد نفسه (rampUpMonths) بدل نسب ثابتة 10/30/30/30:
        // الإيراد السنوي مخفض بالتصاعد أصلاً، وكانت النسب الثابتة تخصم البداية البطيئة مرة ثانية.
        // مجموع الأرباع = السنوي بالضبط، والربع الأول منخفض بقدر التصاعد الفعلي لا أكثر.
        const ramp = Math.max(0, Math.min(12, Number(results.rampUpMonths || 0)));
        const monthFactor = (m) => (ramp > 0 && m <= ramp) ? m / ramp : 1;
        const factors = Array.from({ length: 12 }, (_, i) => monthFactor(i + 1));
        const factorsTotal = factors.reduce((a, b) => a + b, 0) || 12;
        const qShares = [0, 1, 2, 3].map(q =>
            (factors[q * 3] + factors[q * 3 + 1] + factors[q * 3 + 2]) / factorsTotal);
        const qRevenue = qShares.map(s => annualRevenue * s);
        const qOpex = qShares.map(() => annualOpex / 4);
        // نقطة البداية النقدية = حصة المالك المدفوعة (الاستثمار − القرض) — متسقة مع
        // القائمة السنوية؛ كان يبدأ بكامل الاستثمار متجاهلاً دخول القرض.
        const equityOutlay = results.financingCheck?.equityOutlay ?? (results.capex?.total ?? 0);
        let cashBalance = -equityOutlay;
        const rows = [];
        for (let i = 0; i < 4; i++) {
            const operatingCF = qRevenue[i] - qOpex[i]; // نقدي: إيرادات - نفقات
            cashBalance += operatingCF;
            rows.push({
                quarter: `الربع ${i + 1}`,
                revenue: qRevenue[i],
                opex: -qOpex[i],
                operatingCF,
                cashBalance
            });
        }
        return `
            <div class="table-container scrollable-x">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الفترة</th>
                            <th>الإيرادات</th>
                            <th>(-) النفقات التشغيلية</th>
                            <th>التدفق التشغيلي</th>
                            <th>الرصيد التراكمي</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>بداية السنة (حصة المالك بعد الاستثمار ودخول التمويل)</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                            <td class="text-mono text-danger">${this.formatCurrency(-equityOutlay)}</td>
                        </tr>
                        ${rows.map(r => `
                            <tr>
                                <td>${r.quarter}</td>
                                <td class="text-mono">${this.formatCurrency(r.revenue)}</td>
                                <td class="text-mono">${this.formatCurrency(r.opex)}</td>
                                <td class="text-mono ${r.operatingCF >= 0 ? 'text-success' : 'text-danger'}">${this.formatCurrency(r.operatingCF)}</td>
                                <td class="text-mono ${r.cashBalance < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(r.cashBalance)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderCashFlow(results) {
        if (!results || !results.cashFlow || !Array.isArray(results.cashFlow) || results.cashFlow.length === 0) {
            return '<p class="text-muted">بيانات غير كافية. يرجى إكمال البيانات المالية الأساسية (الإيرادات، التكاليف، الاستثمارات).</p>';
        }

        const cashFlow = results.cashFlow;
        const incomeStatement = results.incomeStatement || [];

        return `
            <div class="table-container scrollable-x">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الفترة</th>
                            ${cashFlow.map(cf => `<th>${cf.year === 0 ? 'التأسيس' : 'السنة ' + cf.year}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>صافي الربح</td>
                            ${cashFlow.map((cf, idx) => {
                                if (idx === 0) return '<td class="text-mono">-</td>';
                                const income = incomeStatement[idx - 1];
                                return `<td class="text-mono">${this.formatCurrency(income?.netIncome || 0)}</td>`;
                            }).join('')}
                        </tr>
                        <tr>
                            <td>(+) الإهلاك</td>
                            ${cashFlow.map((cf, idx) => {
                                if (idx === 0) return '<td class="text-mono">-</td>';
                                const income = incomeStatement[idx - 1];
                                return `<td class="text-mono">${this.formatCurrency(income?.depreciation || 0)}</td>`;
                            }).join('')}
                        </tr>
                        <tr>
                            <td>(-) الاستثمار الأولي</td>
                            ${cashFlow.map(cf => `<td class="text-mono ${cf.year === 0 ? 'text-danger' : ''}">${cf.year === 0 ? this.formatCurrency(cf.investment ?? cf.cashFlow) : '-'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>(+) دخول القرض البنكي</td>
                            ${cashFlow.map(cf => `<td class="text-mono ${cf.year === 0 && (cf.loanInflow || 0) > 0 ? 'text-success' : ''}">${cf.year === 0 ? this.formatCurrency(cf.loanInflow || 0) : '-'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>(-) سداد أصل القرض</td>
                            ${cashFlow.map(cf => `<td class="text-mono">${cf.year === 0 ? '-' : this.formatCurrency(-(cf.loanPrincipalPaid || 0))}</td>`).join('')}
                        </tr>
                        ${cashFlow.some(cf => (cf.replacementCost || 0) > 0) ? `
                        <tr>
                            <td>(-) إحلال أصول قصيرة العمر</td>
                            ${cashFlow.map(cf => `<td class="text-mono">${cf.year === 0 ? '-' : this.formatCurrency(-(cf.replacementCost || 0))}</td>`).join('')}
                        </tr>` : ''}
                        <tr class="row-total">
                            <td><strong>صافي التدفق النقدي</strong></td>
                            ${cashFlow.map(cf => `<td class="text-mono"><strong>${this.formatCurrency(cf.cashFlow)}</strong></td>`).join('')}
                        </tr>
                        <tr>
                            <td>الرصيد التراكمي</td>
                            ${cashFlow.map(cf => `<td class="text-mono ${(cf.cumulative || 0) < 0 ? 'text-danger' : 'text-success'}">${this.formatCurrency(cf.cumulative || 0)}</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    renderBalanceSheet(results, state) {
        if (!results) {
            return '<p class="text-muted">بيانات غير كافية. يرجى إكمال البيانات المالية الأساسية (الإيرادات، التكاليف، الاستثمارات).</p>';
        }

        // ميزانية افتتاحية حقيقية (سنة الصفر) تُبنى من فحص التمويل الموحّد في المحرك —
        // كانت تعرض ميزانية نهاية السنة الأولى بعنوان «الافتتاحية»، وبنودها تقرأ مفاتيح
        // غير موجودة فتسقط لقيم التمويل الخام بينما الإجمالي من ميزانية سنة 1 الحقيقية:
        // بنود لا تجمع إلى إجماليها المعلن (فجوة عرضية التقطها تدقيق ٢٠٢٦-٠٧-٠٦).
        const capex = results.capex || {};
        const fc = results.financingCheck || {};
        const totalInvestment = Number(fc.totalInvestment ?? capex.total ?? 0);
        const fixedGross = Number(capex.subtotal ?? 0);
        const openingInventory = Number(capex.openingInventory ?? state.technical?.openingInventory ?? 0);
        const workingCapital = Number(capex.workingCapital ?? Math.max(0, totalInvestment - fixedGross - openingInventory));
        const loanAmount = Number(fc.loanAmount ?? state.financing?.sources?.bankLoan?.amount ?? 0);
        const paidCapital = Number(fc.paidCapital ?? Math.max(0, totalInvestment - loanAmount));
        const fundingGap = Number(fc.fundingGap ?? (totalInvestment - paidCapital - loanAmount));
        const showGap = Math.abs(fundingGap) > 5;

        const assetsTotal = fixedGross + openingInventory + workingCapital;
        const leTotal = loanAmount + paidCapital + fundingGap;

        return `
            <div class="balance-sheet-grid">
                <div class="balance-section">
                    <h4>الأصول (عند التأسيس)</h4>
                    <div class="balance-item">
                        <span>نقد وما في حكمه (رأس المال العامل)</span>
                        <span class="text-mono">${this.formatCurrency(workingCapital)}</span>
                    </div>
                    ${openingInventory > 0 ? `
                    <div class="balance-item">
                        <span>المخزون الافتتاحي (بضاعة أول المدة)</span>
                        <span class="text-mono">${this.formatCurrency(openingInventory)}</span>
                    </div>
                    ` : ''}
                    <div class="balance-item">
                        <span>الأصول الثابتة والتأسيسية (إجمالي — قبل الإهلاك)</span>
                        <span class="text-mono">${this.formatCurrency(fixedGross)}</span>
                    </div>
                    <div class="balance-total">
                        <span><strong>إجمالي الأصول</strong></span>
                        <span class="text-mono text-gold"><strong>${this.formatCurrency(assetsTotal)}</strong></span>
                    </div>
                </div>
                <div class="balance-section">
                    <h4>الالتزامات وحقوق الملكية</h4>
                    <div class="balance-item">
                        <span>قروض بنكية</span>
                        <span class="text-mono">${this.formatCurrency(loanAmount)}</span>
                    </div>
                    <div class="balance-item">
                        <span>رأس المال المدفوع (مساهمة المالك المُدخلة)</span>
                        <span class="text-mono">${this.formatCurrency(paidCapital)}</span>
                    </div>
                    ${showGap ? `
                    <div class="balance-item">
                        <span class="text-danger">${fundingGap > 0 ? `${icon('i-warning')} فجوة تمويل غير مغطاة — أكمل مصادر التمويل` : 'فائض تمويل فوق الاستثمار المطلوب'}</span>
                        <span class="text-mono text-danger">${this.formatCurrency(fundingGap)}</span>
                    </div>
                    ` : ''}
                    <div class="balance-total">
                        <span><strong>إجمالي الخصوم وحقوق الملكية</strong></span>
                        <span class="text-mono text-gold"><strong>${this.formatCurrency(leTotal)}</strong></span>
                    </div>
                </div>
            </div>
        `;
    }

    /** معاملات موسمية شهرية (12 شهراً) منسّقة بحيث يكون متوسطها 1 (لا تغيّر الإجمالي السنوي). */
    seasonalMonthlyFactors(profile) {
        const raw = {
            flat:    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            // ذروة رمضان والعيد (تقريب — رمضان يتنقّل؛ هنا حول الربيع) + انخفاض طفيف باقي العام
            ramadan: [0.9, 0.9, 1.55, 1.35, 0.95, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.95],
            // ركود صيفي (يونيو–أغسطس) وذروة نهاية/بداية العام
            summer:  [1.1, 1.1, 1.1, 1.05, 0.95, 0.75, 0.7, 0.75, 1.0, 1.1, 1.15, 1.25],
            // ذروة شتوية (ديسمبر–فبراير)
            winter:  [1.25, 1.2, 1.05, 0.95, 0.85, 0.8, 0.8, 0.85, 0.95, 1.05, 1.15, 1.1]
        };
        const arr = raw[profile] || raw.flat;
        const sum = arr.reduce((a, b) => a + b, 0);
        return arr.map(f => f * 12 / sum); // متوسط = 1
    }

    /** توزيع إيراد السنة الأولى على 12 شهراً وفق نمط الموسمية — لتخطيط السيولة (لا يغيّر NPV). */
    renderSeasonality(results, state) {
        const y1 = results?.incomeStatement?.[0];
        if (!y1 || !(y1.revenue > 0)) return '';
        const profile = state.assumptions?.seasonalityProfile || 'flat';
        if (profile === 'flat') return ''; // بلا موسمية = لا فائدة من العرض
        const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const factors = this.seasonalMonthlyFactors(profile);
        const avgMonthlyRev = (y1.revenue || 0) / 12;
        const monthly = factors.map(f => avgMonthlyRev * f);
        const monthlyFixed = ((y1.fixedCosts || 0)) / 12; // تكاليف ثابتة شهرية تقريبية
        const peakI = monthly.indexOf(Math.max(...monthly));
        const lowI = monthly.indexOf(Math.min(...monthly));
        const maxRev = Math.max(...monthly);
        const profileLabel = { ramadan: 'ذروة رمضان والأعياد', summer: 'ركود صيفي', winter: 'ذروة شتوية' }[profile] || profile;
        // أشهر يقلّ فيها الإيراد عن التكاليف الثابتة الشهرية = ضغط سيولة
        const tightMonths = monthly.filter(m => m < monthlyFixed).length;

        return `
            <div class="card analysis-card">
                <h3 class="card-title">${icon('i-calendar')} التوزيع الشهري للإيراد (الموسمية: ${profileLabel})</h3>
                <p class="text-muted text-sm mb-3">إيراد السنة الأولى موزّعاً على الأشهر لتخطيط السيولة — لا يغيّر الربح السنوي، لكنه يكشف أشهر الضغط النقدي التي تحتاج احتياطياً.</p>
                <div class="seasonality-bars" style="display:flex;align-items:flex-end;gap:4px;height:120px;padding:8px 0;">
                    ${monthly.map((m, i) => {
                        const h = maxRev > 0 ? Math.round((m / maxRev) * 100) : 0;
                        const isPeak = i === peakI, isLow = i === lowI;
                        const bg = isPeak ? 'var(--c-success,#22c55e)' : isLow ? 'var(--c-danger,#ef4444)' : 'var(--c-p-500,#3b82f6)';
                        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;" title="${months[i]}: ${this.formatCurrency(m)}">
                            <div style="width:100%;height:${h}%;min-height:3px;background:${bg};border-radius:3px 3px 0 0;"></div>
                            <span style="font-size:0.6rem;color:var(--c-text-muted);margin-top:2px;">${months[i].slice(0, 3)}</span>
                        </div>`;
                    }).join('')}
                </div>
                <div class="text-sm mt-2">
                    <span class="text-success">▲ ذروة: ${months[peakI]} (${this.formatCurrency(monthly[peakI])})</span> ·
                    <span class="text-danger">▼ أدنى: ${months[lowI]} (${this.formatCurrency(monthly[lowI])})</span>
                </div>
                ${tightMonths > 0 ? `<div class="alert alert--warning mt-2"><strong>${icon('i-warning')} ${tightMonths} ${tightMonths === 1 ? 'شهر' : 'أشهر'}</strong> يقلّ فيها الإيراد عن التكاليف الثابتة الشهرية (${this.formatCurrency(monthlyFixed)}) — احرص على احتياطي نقدي يغطّي هذا الضغط الموسمي.</div>` : ''}
            </div>
        `;
    }

    formatCurrency(n) {
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
    }
}
