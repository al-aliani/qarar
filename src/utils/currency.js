// src/utils/currency.js
// Mockup for Dinero.js behavior
export function formatCurrency(amount, currency = 'SAR', lang = 'ar-SA') {
  const exchangeRates = { SAR: 1, USD: 0.266 }; // 1 SAR = 0.266 USD
  
  const convertedAmount = amount * (exchangeRates[currency] || 1);
  
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: currency,
  }).format(convertedAmount);
}
