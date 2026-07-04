
export function Dashboard(study, results) {
    const { projection, indicators } = results;

    // Prepare data for charts (to be injected as JSON for script to pick up)
    const chartData = {
        years: projection.map(p => `Year ${p.year}`),
        revenue: projection.map(p => p.revenue),
        netProfit: projection.map(p => p.netProfit),
        cashFlow: projection.map(p => p.cashFlow)
    };

    return `
        <div class="dashboard grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <!-- Financial Performance Chart Container -->
            <div class="chart-container bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-lg font-bold text-gray-800 mb-4">Financial Performance (5 Years)</h3>
                <div class="relative h-64 w-full">
                    <canvas id="financialChart"></canvas>
                </div>
            </div>

            <!-- Break-Even Analysis -->
            <div class="break-even-container bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-lg font-bold text-gray-800 mb-4">Break-Even Analysis (Year 1)</h3>
                <div class="flex flex-col h-full justify-center space-y-6">
                    <div class="flex justify-between items-center border-b pb-2">
                        <span class="text-gray-600">Break-Even Sales (Annual)</span>
                        <span class="font-bold text-lg text-gray-900">${results.annualRevenueYear1 > indicators.breakEvenPointValue ? '✅' : '⚠️'} SAR ${indicators.breakEvenPointValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div class="flex justify-between items-center border-b pb-2">
                        <span class="text-gray-600">Actual Forecast Sales</span>
                        <span class="font-bold text-lg text-gray-900">SAR ${results.annualRevenueYear1.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div class="relative pt-1">
                        <div class="flex mb-2 items-center justify-between">
                            <span class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                                Safety Margin
                            </span>
                            <span class="text-xs font-semibold inline-block text-blue-600">
                                ${((results.annualRevenueYear1 - indicators.breakEvenPointValue) / results.annualRevenueYear1 * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                            <div style="width:${Math.min(100, (indicators.breakEvenPointValue / results.annualRevenueYear1) * 100)}%" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-red-500"></div>
                            <div class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500 w-full"></div>
                        </div>
                        <div class="flex justify-between text-xs text-gray-500">
                            <span>0</span>
                            <span>Break-Even</span>
                            <span>Forecast</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Script to Initialize Charts (Needs Chart.js included in index.html) -->
        <script>
            setTimeout(() => {
                const ctx = document.getElementById('financialChart').getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(chartData.years)},
                        datasets: [
                            {
                                label: 'Revenue',
                                data: ${JSON.stringify(chartData.revenue)},
                                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                                borderColor: 'rgba(54, 162, 235, 1)',
                                borderWidth: 1
                            },
                            {
                                label: 'Net Profit',
                                type: 'line',
                                data: ${JSON.stringify(chartData.netProfit)},
                                borderColor: 'rgba(75, 192, 192, 1)',
                                borderWidth: 2,
                                fill: false
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });
            }, 500);
        </script>
    `;
}
