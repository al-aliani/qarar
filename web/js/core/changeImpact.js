import { calculateStudy } from './engine.js';
import { getOfficialIndicators } from './resultContract.js';

function setPath(target, section, path, value) {
    if (!target[section] || typeof target[section] !== 'object') target[section] = {};
    const keys = String(path || '').split('.').filter(Boolean);
    let cursor = target[section];
    keys.slice(0, -1).forEach(key => {
        if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
        cursor = cursor[key];
    });
    if (keys.length) cursor[keys.at(-1)] = value;
}

const metric = (label, key, type = 'money') => ({ label, key, type });
const METRICS = [metric('صافي القيمة الحالية', 'npv'), metric('العائد الداخلي', 'irr', 'percent'), metric('العائد على الاستثمار', 'roi', 'percent'), metric('فترة الاسترداد', 'paybackPeriod', 'years')];

export function compareStudyChange(study, { section, path, value }) {
    const nextStudy = structuredClone(study || {});
    setPath(nextStudy, section, path, value);
    const beforeResults = calculateStudy(study || {});
    const afterResults = calculateStudy(nextStudy);
    const before = getOfficialIndicators(beforeResults);
    const after = getOfficialIndicators(afterResults);
    return {
        nextStudy,
        beforeDecision: beforeResults.decision,
        afterDecision: afterResults.decision,
        rows: METRICS.map(item => ({ ...item, before: Number(before[item.key]) || 0, after: Number(after[item.key]) || 0 }))
    };
}

export function formatImpactValue(value, type) {
    if (type === 'percent') return `${(Number(value) * 100).toFixed(1)}%`;
    if (type === 'years') return `${Number(value).toFixed(1)} سنة`;
    return `${Math.round(Number(value) || 0).toLocaleString('ar-SA')} ريال`;
}
