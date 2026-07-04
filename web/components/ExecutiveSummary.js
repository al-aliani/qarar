
export function ExecutiveSummary(study, results) {
    const { indicators, totalCapex } = results;
    const { project_info } = study;

    const isViable = indicators.npv > 0 && indicators.irr > 0.15; // Simple heuristic
    const currency = "SAR";

    return `
        <div class="executive-summary p-6 bg-white rounded-lg shadow-md mb-8">
            <h2 class="text-2xl font-bold text-gray-800 mb-4">Executive Summary</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <h3 class="text-lg font-semibold text-gray-700">Project: ${project_info.name || "New Restaurant"}</h3>
                    <p class="text-gray-600">${project_info.concept} in ${project_info.location.city}</p>
                </div>
                <div class="text-right">
                    <span class="inline-block px-4 py-2 rounded-full ${isViable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} font-bold">
                        ${isViable ? "FEASIBLE / مجدي" : "REVIEW REQUIRED / يحتاج مراجعة"}
                    </span>
                </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="stat-card bg-blue-50 p-4 rounded-lg text-center">
                    <div class="text-sm text-gray-500">Net Present Value (NPV)</div>
                    <div class="text-xl font-bold text-blue-700">${currency} ${indicators.npv.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div class="stat-card bg-blue-50 p-4 rounded-lg text-center">
                    <div class="text-sm text-gray-500">Internal Rate of Return (IRR)</div>
                    <div class="text-xl font-bold text-blue-700">${(indicators.irr * 100).toFixed(1)}%</div>
                </div>
                <div class="stat-card bg-blue-50 p-4 rounded-lg text-center">
                    <div class="text-sm text-gray-500">Payback Period</div>
                    <div class="text-xl font-bold text-blue-700">${indicators.payback.toFixed(1)} Years</div>
                </div>
                <div class="stat-card bg-blue-50 p-4 rounded-lg text-center">
                    <div class="text-sm text-gray-500">Initial Investment</div>
                    <div class="text-xl font-bold text-blue-700">${currency} ${totalCapex.toLocaleString()}</div>
                </div>
            </div>

            <div class="recommendation bg-gray-50 p-4 rounded border-l-4 ${isViable ? 'border-green-500' : 'border-yellow-500'}">
                <h4 class="font-bold mb-2">Recommendation</h4>
                <p class="text-gray-700">
                    ${isViable
            ? "The project demonstrates positive financial indicators with an NPV significantly above zero and a healthy IRR. The investment is recovered within a reasonable timeframe."
            : "The project currently shows marginal or negative returns. Consider optimizing Operational Costs (OPEX) or reviewing the Investment Cost (CAPEX) to improve feasibility."}
                </p>
            </div>
        </div>
    `;
}
