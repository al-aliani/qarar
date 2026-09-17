(function () {
    const digitMap = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
    const parseNum = (raw) => {
        const normalized = String(raw || '')
            .replace(/[٠-٩۰-۹]/g, (character) => digitMap[character] || character)
            .replace(/٫/g, '.')
            .replace(/[,\s ]/g, '')
            .trim();
        return normalized === '' ? NaN : Number(normalized);
    };
    const formatter = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 });
    const pctFormatter = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 1 });
    const formatCurrency = (value) => `${formatter.format(Math.round(value))} ريال`;
    const form = document.getElementById('roiCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('roiCalcResult');
    const mainElement = document.getElementById('roiResultMain');
    const detailElement = document.getElementById('roiResultDetail');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const capital = parseNum(form.capital.value);
        const annualProfit = parseNum(form.annualProfit.value);

        if (![capital, annualProfit].every(Number.isFinite)) {
            showError('عبّئ الحقلين بأرقام صحيحة.');
            return;
        }
        if (capital <= 0) {
            showError('رأس المال المستثمر لازم يكون أكبر من صفر.');
            return;
        }

        const roiPct = (annualProfit / capital) * 100;
        mainElement.textContent = `${pctFormatter.format(roiPct)}%`;

        if (annualProfit > 0) {
            mainElement.style.color = 'var(--c-success,#0e5b44)';
            detailElement.textContent = `يعني رجوع ${formatCurrency(annualProfit)} خلال سنة على استثمار ${formatCurrency(capital)}.`;
        } else if (annualProfit === 0) {
            mainElement.style.color = 'var(--c-danger,#c0392b)';
            detailElement.textContent = 'لا ربح ولا خسارة متوقعة خلال السنة الأولى — العائد صفر.';
        } else {
            mainElement.style.color = 'var(--c-danger,#c0392b)';
            detailElement.textContent = `يعني خسارة متوقعة ${formatCurrency(Math.abs(annualProfit))} خلال السنة الأولى، لا عائد.`;
        }

        resultElement.style.display = '';
    });
})();
