
/**
 * Simulator - Simulates a user journey through the application
 * Used for "Demo Mode" and automated testing/verification.
 */
export class Simulator {
    constructor(store, navigateToFn, templates) {
        this.store = store;
        this.navigateTo = navigateToFn;
        this.templates = templates;
        this.isRunning = false;
        this.delayMs = 1500; // Time to linger on each step
    }

    async runDemo(templateId = 'burger_joint') {
        if (this.isRunning) return;
        this.isRunning = true;

        try {
            console.log(`🚀 Starting Simulation: ${templateId}`);
            
            // 1. Reset Store
            await this.store.reset();
            
            // 2. Load Template Data
            const template = this.templates[templateId.toUpperCase()];
            if (!template) throw new Error(`Template ${templateId} not found`);

            // We inject data step by step to simulate "filling"
            // But for simplicity in this demo, we'll pre-fill the store
            // and just navigate to show the pages.
            
            // However, to make it look like "filling", we can inject partial data before each step.
            // For now, let's load all data first, then walk through.
            
            // Mapping template data to store structure
            // Note: Store structure might differ slightly from template structure.
            // Based on templates.js, it seems to match.
            
            const fullData = {
                projectInfo: template.data.projectInfo,
                technical: template.data.technical,
                hr: template.data.hr,
                opex: template.data.opex,
                revenue: template.data.revenue,
                // Add default assumptions if missing
                assumptions: {
                    discountRate: 10,
                    taxRate: 15, // KSA
                    investmentPeriod: 5
                }
            };

            await this.store.dispatch('UPDATE_FULL_STUDY', fullData);

            // 3. Start Navigation Sequence
            const steps = [
                0, // Templates (We start here)
                1, // Project Info
                2, // Technical
                3, // HR
                4, // OPEX
                5, // Revenue
                6, // Financial Dashboard (Result)
            ];

            // Helper for delay
            const wait = (ms) => new Promise(r => setTimeout(r, ms));

            // Show Toast
            this.showToast('بدء محاكاة رحلة المستخدم... 🚀', 'info');

            for (const stepIndex of steps) {
                console.log(`➡️ Navigating to step ${stepIndex}`);
                this.navigateTo(stepIndex);
                
                // Simulate "reading/filling" time
                await wait(this.delayMs);
                
                // You could add "typing" animation logic here if you had access to DOM inputs
            }

            this.showToast('تم اكتمال المحاكاة! ✅', 'success');

        } catch (err) {
            console.error('Simulation Failed:', err);
            this.showToast('فشلت المحاكاة: ' + err.message, 'error');
        } finally {
            this.isRunning = false;
        }
    }

    showToast(message, type = 'info') {
        // Fallback if toast not available globally
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[Toast] ${message}`);
            alert(message);
        }
    }
}
