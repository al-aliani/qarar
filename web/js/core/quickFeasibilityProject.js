/**
 * Start a full study from a quick-feasibility result without reusing the
 * currently active study's identity or detailed sections.
 */
export async function startFullStudyFromQuick(store, quickData = {}) {
    await store.reset();

    const projectInfo = store.getState().projectInfo || {};
    store.update('projectInfo', {
        ...projectInfo,
        name: quickData.projectName || projectInfo.name,
        concept: quickData.sectorLabel || quickData.sector || projectInfo.concept,
        city: quickData.city || projectInfo.city
    });

    const generated = quickData.generated || {};
    if (generated.execSummary) {
        const executiveSummary = store.getState().executiveSummary || {};
        store.update('executiveSummary', {
            ...executiveSummary,
            projectOverview: generated.execSummary
        });
    }
    if (generated.market) {
        const marketing = store.getState().marketing || {};
        const marketAnalysis = marketing.marketAnalysis || {};
        store.update('marketing', {
            ...marketing,
            marketAnalysis: { ...marketAnalysis, summary: generated.market }
        });
    }
    if (Array.isArray(generated.competitors) && generated.competitors.length) {
        store.update('marketing', {
            ...(store.getState().marketing || {}),
            competitors: generated.competitors
        });
    }
    if (Array.isArray(generated.risks) && generated.risks.length) {
        const riskAnalysis = store.getState().riskAnalysis || {};
        store.update('riskAnalysis', { ...riskAnalysis, risks: generated.risks });
    }

    return store.getState().projectInfo?.id || store.getState().id;
}
