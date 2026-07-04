
export function FinancialTables(results) {
    const { projection } = results;

    const formatCurrency = (val) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const rows = [
        { label: "Revenue", key: "revenue", bold: true },
        { label: "Cost of Goods Sold (COGS)", key: "cogs", textRed: true },
        { label: "Gross Profit", key: "grossProfit", bold: true, bg: "bg-gray-100" },
        { label: "Operating Expenses (OPEX)", key: "opex", textRed: true },
        { label: "EBITDA", key: "ebitda", bold: true },
        { label: "Depreciation", key: "depreciation", textRed: true },
        { label: "EBIT", key: "ebit" },
        { label: "Zakat / Tax", key: "zakat", textRed: true },
        { label: "Net Profit", key: "netProfit", bold: true, bg: "bg-blue-50" },
        { label: "Net Cash Flow", key: "cashFlow", bold: true, borderTop: true }
    ];

    let incomeStatementHTML = `
        <div class="financial-tables bg-white rounded-lg shadow-md overflow-x-auto mb-8">
            <h2 class="text-xl font-bold text-gray-800 p-6 border-b">Income Statement (5 Years)</h2>
            <table class="min-w-full text-sm text-left text-gray-600">
                <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                        <th class="px-6 py-3">Item (SAR)</th>
                        ${projection.map(p => `<th class="px-6 py-3">Year ${p.year}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr class="border-b ${row.bg || ''} ${row.borderTop ? 'border-t-2 border-gray-300' : ''}">
                            <td class="px-6 py-4 ${row.bold ? 'font-bold text-gray-900' : ''}">${row.label}</td>
                            ${projection.map(p => `
                                <td class="px-6 py-4 ${row.bold ? 'font-bold' : ''} ${row.textRed ? 'text-red-500' : ''}">
                                    ${formatCurrency(p[row.key])}
                                </td>
                            `).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    return incomeStatementHTML;
}
