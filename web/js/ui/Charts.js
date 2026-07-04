export class Charts {
    constructor(canvasId) {
        this.ctx = document.getElementById(canvasId)?.getContext('2d');
        this.chart = null;
    }

    render(pnlData) {
        if (!this.ctx) return;

        // Extract 5-Year Revenue vs NetIncome
        const labels = pnlData.map(y => `Year ${y.year}`);
        const revenue = pnlData.map(y => y.revenueTotal);
        const netIncome = pnlData.map(y => y.netIncome);

        if (this.chart) {
            this.chart.data.labels = labels;
            this.chart.data.datasets[0].data = revenue;
            this.chart.data.datasets[1].data = netIncome;
            this.chart.update();
            return;
        }

        this.chart = new Chart(this.ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'الإيرادات',
                        data: revenue,
                        backgroundColor: '#d4af37',
                    },
                    {
                        label: 'صافي الربح',
                        data: netIncome,
                        backgroundColor: '#238636',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#8b949e' } }
                },
                scales: {
                    y: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } },
                    x: { ticks: { color: '#8b949e' }, grid: { display: false } }
                }
            }
        });
    }
}
