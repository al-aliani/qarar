import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Capture Screenshots for Figma', () => {
    test.setTimeout(120000); // 2 minutes just in case

    test('Capture all pages', async ({ page }) => {
        // Set a standard viewport for Figma designs
        await page.setViewportSize({ width: 1440, height: 1024 });

        const outDir = path.join(process.cwd(), 'figma_screenshots');
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        const pagesToCapture = [
            { name: '01_Landing_Page', url: '/landing.html' },
            { name: '02_Simulator_Wizard_Step_1', url: '/index.html' },
            { name: '03_Investor_Page', url: '/investor.html' },
            { name: '04_Partners_Page', url: '/partners.html' },
            { name: '05_Terms_Page', url: '/terms.html' },
            { name: '06_Privacy_Page', url: '/privacy.html' }
        ];

        for (const p of pagesToCapture) {
            console.log(`Capturing ${p.name}...`);
            await page.goto(p.url);
            
            // Wait for network to be idle so images/fonts are loaded
            await page.waitForLoadState('networkidle');
            
            // Hide potential floating elements that might overlap incorrectly or wait for animations
            await page.waitForTimeout(1500); 

            await page.screenshot({
                path: path.join(outDir, `${p.name}.png`),
                fullPage: true,
            });
        }

        // Try to click through wizard steps if possible
        console.log('Capturing further wizard steps...');
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle');
        
        let stepCount = 2;
        while (stepCount <= 5) {
            // Find "التالي" or "استمرار" buttons that are visible
            const nextBtn = page.locator('button', { hasText: /(التالي|استمرار)/ }).first();
            
            try {
                if (await nextBtn.isVisible({ timeout: 2000 })) {
                    await nextBtn.click();
                    await page.waitForTimeout(1500); // wait for step transition
                    await page.screenshot({
                        path: path.join(outDir, `02_Simulator_Wizard_Step_${stepCount}.png`),
                        fullPage: true,
                    });
                    stepCount++;
                } else {
                    break;
                }
            } catch (e) {
                break; // If no button found or timed out, just break
            }
        }
        
        console.log(`Screenshots saved to ${outDir}`);
    });
});
