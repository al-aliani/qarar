/**
 * Audit Log أساسي — تسجيل العمليات الحساسة (معيار حرج)
 * يخزن محلياً في localStorage ويمكن توسيعه لإرسال للسيرفر
 */

const AUDIT_KEY = 'feas_audit_log';
const MAX_ENTRIES = 500;

const ACTIONS = {
  LOGIN: 'login',
  SIGNUP: 'signup',
  LOGOUT: 'logout',
  SAVE: 'save',
  LOAD: 'load',
  EXPORT: 'export',
  RESET: 'reset',
  OAUTH: 'oauth',
  MFA_ENROLL: 'mfa_enroll',
  MFA_VERIFY: 'mfa_verify'
};

function getEntries() {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function append(entry) {
  const entries = getEntries();
  entries.push({
    ...entry,
    ts: new Date().toISOString(),
    ua: typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 100) : ''
  });
  const trimmed = entries.slice(-MAX_ENTRIES);
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('AuditLog: storage full', e);
  }
}

export function log(action, meta = {}) {
  const valid = typeof action === 'string' && Object.values(ACTIONS).includes(action);
  if (!valid) return;
  append({ action, ...meta });
}

export function getAuditLog(limit = 50) {
  const entries = getEntries();
  return entries.slice(-limit).reverse();
}

export function clearAuditLog() {
  localStorage.removeItem(AUDIT_KEY);
}

export { ACTIONS };
