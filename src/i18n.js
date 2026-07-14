// src/i18n.js (Simple i18n setup mockup)
export const dictionary = {
  ar: { dashboard: 'لوحة التحكم', roi: 'العائد على الاستثمار', costs: 'التكاليف' },
  en: { dashboard: 'Dashboard', roi: 'ROI', costs: 'Costs' }
};

export function t(key, lang = 'ar') {
  return dictionary[lang]?.[key] || key;
}
