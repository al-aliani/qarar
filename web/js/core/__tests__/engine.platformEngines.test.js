import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';
import { getFieldOptionSpec } from '../fieldOptions.js';
import { validateExpertTemplateCertification } from '../../services/ExpertTemplateGovernance.js';

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });
}

function makeSaasStudy() {
    return {
        [SECTIONS.PROJECT_INFO]: {
            name: 'منصة قرار',
            description: 'منصة SaaS لدراسات الجدوى',
            city: 'الرياض',
            concept: 'موقع دراسة جدوى / منصة SaaS',
            studyType: 'bank_financing',
            studyRecipientType: 'establishment',
            businessModel: 'Independent'
        },
        assumptions: { projectionYears: 5, discountRate: 0.14, inflationRate: 0.03, rampUpMonths: 6 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ name: 'أجهزة عمل', price: 50000, quantity: 1 }],
            buildings: [],
            furniture: [],
            establishmentCosts: [{ name: 'تأسيس', amount: 40000 }],
            capacityUtilization: []
        },
        [SECTIONS.TECH_RESOURCES]: { techResources: [{ name: 'تطوير MVP', price: 180000, quantity: 1 }] },
        [SECTIONS.HR]: { positions: [{ position: 'مطور', count: 2, salary: 15000, months: 12, nationality: 'saudi' }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'سحابة واستضافة وذكاء AI', monthly: 16000 }] },
        [SECTIONS.MARKETING]: { campaigns: [{ name: 'تسويق نمو', type: 'operating', monthly: 30000 }] },
        [SECTIONS.REVENUE]: {
            streams: [
                { service: 'اشتراك أساسي SaaS', type: 'operating', customersPerMonth: 900, avgPrice: 79, variableCostRate: 0.18, growthRate: 0.18 },
                { service: 'اشتراك احترافي SaaS', type: 'operating', customersPerMonth: 180, avgPrice: 249, variableCostRate: 0.20, growthRate: 0.20 }
            ]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: {
            targetDSCR: 1.5,
            sources: {
                equity: { amount: 300000 },
                bankLoan: { amount: 350000, interestRate: 0.085, termYears: 5, gracePeriodMonths: 6 }
            }
        },
        [SECTIONS.LEGAL]: { licenses: [] },
        [SECTIONS.MARKET_SIZING]: {
            tam: { value: 0, source: '' },
            sam: { value: 0 },
            som: { value: 0 }
        }
    };
}

describe('study profile fields', () => {
    it('adds controlled options for study type and recipient type', () => {
        expect(getFieldOptionSpec('studyType')?.options.map(o => o.value)).toContain('bank_financing');
        expect(getFieldOptionSpec('studyType')?.options.map(o => o.value)).toContain('expert_template');
        expect(getFieldOptionSpec('studyRecipientType')?.options.map(o => o.value)).toEqual(expect.arrayContaining(['freelancer', 'establishment', 'llc']));
    });
});

describe('platform engines', () => {
    it('returns SaaS, Saudi market, and decision explanation diagnostics from the canonical engine', () => {
        const result = calculateStudy(makeSaasStudy());

        expect(result.saasMetrics.applicable).toBe(true);
        expect(result.saasMetrics.mrr).toBeGreaterThan(0);
        expect(result.saudiMarket.tam).toBeGreaterThan(0);
        expect(result.decisionExplanation).toBeTruthy();
        expect(Array.isArray(result.decisionExplanation.issues)).toBe(true);
    });

    it('blocks publishing weak expert templates before certification', () => {
        const certification = validateExpertTemplateCertification(
            { title: 'قالب سريع', expertName: 'محمد', specialty: 'SaaS', yearsExperience: 0, scope: '', reviewNotes: '' },
            makeSaasStudy()
        );

        expect(certification.canPublish).toBe(false);
        expect(certification.blockers.length).toBeGreaterThan(0);
    });
});

describe('canonical engine imports', () => {
    it('keeps app code away from deprecated parallel financial engines', () => {
        const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
        const files = [
            ...walk(path.join(root, 'js')).filter(f => f.endsWith('.js')),
            ...walk(path.join(root, 'export')).filter(f => f.endsWith('.js'))
        ].filter(f => !f.includes(`${path.sep}__tests__${path.sep}`));
        const offenders = files.filter(file => {
            const content = fs.readFileSync(file, 'utf8');
            return /financialModel\.js|computeRestaurantBase|lib\/calc\/index\.js|lib\\calc\\index\.js/.test(content);
        });

        expect(offenders.map(f => path.relative(root, f))).toEqual([]);
    });
});
