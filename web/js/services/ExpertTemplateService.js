/**
 * Local expert-template registry.
 *
 * MVP storage is local so the product can support adding trusted templates now.
 * The shape is intentionally metadata-first to make server/admin approval easy later.
 */
import { createEmptyStudy } from '../core/schema.js';
import { validateExpertTemplateCertification } from './ExpertTemplateGovernance.js';

const STORAGE_KEY = 'qarar_expert_templates_v1';

const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
const text = (value) => String(value ?? '').trim();
const numberOrZero = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
};
const urlOrBlank = (value) => {
    const url = text(value);
    return /^https?:\/\//i.test(url) ? url : '';
};

function readRawTemplates() {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.warn('[ExpertTemplateService] Failed to read templates:', err);
        return [];
    }
}

function writeRawTemplates(templates) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('qarar:expert-templates-updated'));
    }
}

function normalizeTemplate(template) {
    const now = new Date().toISOString();
    return {
        id: text(template.id) || crypto.randomUUID(),
        title: text(template.title),
        expertName: text(template.expertName),
        specialty: text(template.specialty),
        yearsExperience: numberOrZero(template.yearsExperience),
        scope: text(template.scope),
        priceLabel: text(template.priceLabel),
        consultationUrl: urlOrBlank(template.consultationUrl),
        reviewNotes: text(template.reviewNotes),
        certification: template.certification || null,
        status: template.status === 'draft' ? 'draft' : 'approved',
        createdAt: text(template.createdAt) || now,
        updatedAt: text(template.updatedAt) || now,
        data: clone(template.data) || {}
    };
}

function prepareTemplateData(studyData, meta) {
    const data = clone(studyData || createEmptyStudy());
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    data.projectInfo = {
        ...(data.projectInfo || {}),
        deleted: false,
        deletedAt: null,
        status: 'draft',
        members: [],
        name: data.projectInfo?.name || meta.title,
        clientName: '',
        preparedBy: meta.expertName || data.projectInfo?.preparedBy || ''
    };
    delete data.projectInfo.id;
    delete data.projectInfo.folderId;

    return data;
}

export function getExpertTemplates() {
    return readRawTemplates()
        .map(normalizeTemplate)
        .filter(t => t.title && t.expertName && t.data && typeof t.data === 'object')
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function saveExpertTemplate(meta, studyData) {
    const title = text(meta?.title);
    const expertName = text(meta?.expertName);
    const specialty = text(meta?.specialty);

    if (!title) throw new Error('اكتب اسم القالب.');
    if (!expertName) throw new Error('اكتب اسم المختص.');
    if (!specialty) throw new Error('اكتب تخصص القالب أو القطاع.');
    const certification = validateExpertTemplateCertification({ ...meta, title, expertName, specialty }, studyData);
    if (!certification.canPublish) {
        throw new Error(certification.blockers[0] || 'القالب لا يحقق شروط الاعتماد.');
    }

    const existing = readRawTemplates();
    const id = text(meta?.id) || crypto.randomUUID();
    const old = existing.find(t => t.id === id);
    const template = normalizeTemplate({
        ...old,
        ...meta,
        id,
        updatedAt: new Date().toISOString(),
        title,
        expertName,
        specialty,
        certification,
        data: prepareTemplateData(studyData, { title, expertName })
    });

    const next = [template, ...existing.filter(t => t.id !== id)];
    writeRawTemplates(next);
    return template;
}

export function deleteExpertTemplate(id) {
    const target = text(id);
    if (!target) return;
    writeRawTemplates(readRawTemplates().filter(t => t.id !== target));
}

export function applyExpertTemplate(store, template) {
    if (!store || !template?.data) return null;

    const now = new Date().toISOString();
    const base = createEmptyStudy();
    const data = clone(template.data);
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    const merged = store.mergeWithDefaults
        ? store.mergeWithDefaults(data)
        : { ...base, ...data };

    merged.id = crypto.randomUUID();
    merged.createdAt = now;
    merged.updatedAt = now;
    merged.projectInfo = {
        ...(merged.projectInfo || {}),
        folderId: null,
        deleted: false,
        deletedAt: null,
        status: 'draft',
        members: [],
        clientName: '',
        preparedBy: merged.projectInfo?.preparedBy || template.expertName || ''
    };
    delete merged.projectInfo.id;

    store.set(merged);
    return merged;
}
