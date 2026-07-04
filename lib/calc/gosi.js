/**
 * Saudi GOSI (التأمينات الاجتماعية) Calculator
 * Automatically calculates employer contributions based on employee data
 * 
 * 2024 Rates:
 * - Saudi employees: 22% total (11.75% employer + 9.75% employee + 0.5% SANED)
 * - Non-Saudi employees: 2% (employer only)
 */

export const GOSI_RATES = {
    saudi: {
        employerBase: 0.1175,    // 11.75% retirement
        employeePortion: 0.0975, // 9.75% (not our cost)
        saned: 0.005,            // 0.5% unemployment
        get total() { return this.employerBase + this.saned; } // 12.25% employer cost
    },
    nonSaudi: {
        employerBase: 0.02,      // 2% occupational hazards only
        employeePortion: 0,
        saned: 0,
        get total() { return this.employerBase; }
    },
    maxSalary: 45000 // Maximum salary subject to GOSI
};

/**
 * Calculate GOSI for a single employee
 */
export function calculateEmployeeGOSI(salary, isSaudi = true) {
    const cappedSalary = Math.min(salary, GOSI_RATES.maxSalary);
    const rates = isSaudi ? GOSI_RATES.saudi : GOSI_RATES.nonSaudi;

    return {
        baseSalary: salary,
        cappedSalary,
        employerContribution: Math.round(cappedSalary * rates.total),
        employeeContribution: Math.round(cappedSalary * rates.employeePortion),
        isCapped: salary > GOSI_RATES.maxSalary,
        breakdown: {
            retirement: Math.round(cappedSalary * rates.employerBase),
            saned: Math.round(cappedSalary * rates.saned)
        }
    };
}

/**
 * Calculate total GOSI for all employees
 */
export function calculateTotalGOSI(positions, saudizationRate = 0.3) {
    let totalMonthly = 0;
    let totalSaudi = 0;
    let totalNonSaudi = 0;
    const breakdown = [];

    positions.forEach(pos => {
        const count = pos.count || 1;
        const salary = pos.salary || 0;

        let saudiCount = 0;
        let nonSaudiCount = 0;

        // Check if nationality is explicitly set per position row
        if (pos.nationality) {
            if (pos.nationality === 'saudi') {
                saudiCount = count;
            } else {
                nonSaudiCount = count;
            }
        } else {
            // Fallback to global saudization rate split
            saudiCount = Math.ceil(count * saudizationRate);
            nonSaudiCount = count - saudiCount;
        }

        // Saudi employees
        if (saudiCount > 0) {
            const gosiPerSaudi = calculateEmployeeGOSI(salary, true);
            totalSaudi += gosiPerSaudi.employerContribution * saudiCount;
            breakdown.push({
                position: pos.position,
                nationality: 'سعودي',
                count: saudiCount,
                salary,
                monthlyGOSI: gosiPerSaudi.employerContribution,
                totalMonthly: gosiPerSaudi.employerContribution * saudiCount
            });
        }

        // Non-Saudi employees
        if (nonSaudiCount > 0) {
            const gosiPerNonSaudi = calculateEmployeeGOSI(salary, false);
            totalNonSaudi += gosiPerNonSaudi.employerContribution * nonSaudiCount;
            breakdown.push({
                position: pos.position,
                nationality: 'غير سعودي',
                count: nonSaudiCount,
                salary,
                monthlyGOSI: gosiPerNonSaudi.employerContribution,
                totalMonthly: gosiPerNonSaudi.employerContribution * nonSaudiCount
            });
        }

        totalMonthly += (totalSaudi + totalNonSaudi) / positions.length;
    });

    totalMonthly = totalSaudi + totalNonSaudi;

    return {
        monthlyTotal: totalMonthly,
        annualTotal: totalMonthly * 12,
        saudiContribution: totalSaudi,
        nonSaudiContribution: totalNonSaudi,
        breakdown,
        saudizationRate: saudizationRate * 100
    };
}

/**
 * Add GOSI to OPEX automatically
 */
export function getGOSIAsOpexItem(positions, saudizationRate = 0.3) {
    const gosi = calculateTotalGOSI(positions, saudizationRate);

    return {
        source: 'التأمينات الاجتماعية (GOSI)',
        name: 'اشتراكات التأمينات الاجتماعية',
        monthly: gosi.monthlyTotal,
        annual: gosi.annualTotal,
        variablePercent: 0, // Fixed cost
        autoCalculated: true
    };
}
