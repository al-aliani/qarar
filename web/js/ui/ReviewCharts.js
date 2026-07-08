/**
 * Review Charts
 * Adds visual insights to standard data tables in the review steps.
 */

export class ReviewCharts {
    static renderMarketingMix(containerId, data) {
        const ctx = this.createCanvas(containerId);
        if (!ctx) return;

        // Example: Market Share vs Competitors
        const competitors = data.marketing?.competitors || [];
        const labels = competitors.map(c => c.name);
        const shares = competitors.map(c => c.marketShare || 0);

        // Add "My Project" target share if available (e.g. SOM)
        // labels.push("مشروعي");
        // shares.push(data.marketSizing?.som?.value || 5); -- simplified

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: shares,
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#aaa' } },
                    title: { display: true, text: 'الحصص السوقية للمنافسين', color: '#8a5f1c' }
                }
            }
        });
    }

    static renderStaffingCost(containerId, data) {
        const ctx = this.createCanvas(containerId);
        if (!ctx) return;

        const staff = data.staffing || [];
        const labels = staff.map(s => s.position);
        const costs = staff.map(s => (s.salary || 0) * (s.count || 1) * 12);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'التكلفة السنوية',
                    data: costs,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'توزيع رواتب الموظفين (سنوياً)', color: '#8a5f1c' }
                },
                scales: {
                    x: { ticks: { color: '#888' } },
                    y: { ticks: { color: '#eee' } }
                }
            }
        });
    }

    static createCanvas(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        // Clear previous
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.style.maxHeight = '250px';
        container.appendChild(canvas);
        return canvas.getContext('2d');
    }
}
