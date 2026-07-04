/**
 * IdeaScoreGauge.js
 * A visual speedometer/gauge component to display "Startup Readiness Score"
 * Inspiration: IdeaBuddy's Idea Score.
 */

export class IdeaScoreGauge {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.score = options.score || 0;
        this.size = options.size || 120;
        this.strokeWidth = options.strokeWidth || 8;
        this.label = options.label || 'جاهزية الفكرة';
    }

    render(score) {
        if (score !== undefined) this.score = score;
        if (!this.container) return;

        const radius = (this.size - this.strokeWidth) / 2;
        const circumference = radius * 2 * Math.PI;
        // We want a semi-circle (arc 180 degrees) or 2/3 circle. Let's do a 240 degree arc for a modern look.
        // 240 degrees = (2/3) * 360?? No, 240/360 = 0.666
        const offset = circumference - ((this.score / 100) * (circumference * 0.75)); // 75% of circle used

        // Colors based on score
        let color = '#ef4444'; // Red
        if (this.score >= 50) color = '#eab308'; // Yellow
        if (this.score >= 80) color = '#22c55e'; // Green

        this.container.innerHTML = `
            <div class="idea-gauge-wrapper" style="width:${this.size}px; height:${this.size}px; position:relative; margin:0 auto;">
                <svg width="${this.size}" height="${this.size}" viewBox="0 0 ${this.size} ${this.size}" style="transform: rotate(135deg);">
                    <circle cx="${this.size / 2}" cy="${this.size / 2}" r="${radius}" 
                        fill="none" stroke="#e5e7eb" stroke-width="${this.strokeWidth}" 
                        stroke-dasharray="${circumference * 0.75} ${circumference}" 
                        stroke-linecap="round"></circle>
                    <circle cx="${this.size / 2}" cy="${this.size / 2}" r="${radius}" 
                        fill="none" stroke="${color}" stroke-width="${this.strokeWidth}" 
                        stroke-dasharray="${circumference * 0.75} ${circumference}" 
                        stroke-dashoffset="${circumference * 0.75 - ((this.score / 100) * (circumference * 0.75))}" 
                        stroke-linecap="round" class="gauge-progress"></circle>
                </svg>
                <div class="gauge-content" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center;">
                    <span class="gauge-score" style="display:block; font-size:${this.size * 0.25}px; font-weight:bold; color:${color};">${Math.round(this.score)}%</span>
                    <span class="gauge-label" style="display:block; font-size:${this.size * 0.1}px; color:#6b7280;">${this.label}</span>
                </div>
            </div>
            <style>
                .gauge-progress { transition: stroke-dashoffset 1s ease-out; }
            </style>
        `;
    }
}
