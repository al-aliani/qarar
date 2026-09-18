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
    const ratioFormatter = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 });
    const formatCurrency = (value) => `${formatter.format(Math.round(value))} ريال`;
    const form = document.getElementById('deCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('deCalcResult');
    const ratioElement = document.getElementById('deResultRatio');
    const detailElement = document.getElementById('deResultDetail');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const debt = parseNum(form.debt.value);
        const equity = parseNum(form.equity.value);

        if (![debt, equity].every(Number.isFinite)) {
            showError('عبّئ الحقلين بأرقام صحيحة.');
            return;
        }
        if (debt < 0) {
            showError('مبلغ التمويل لازم يكون صفر أو أكبر.');
            return;
        }
        if (equity <= 0) {
            showError('رأس مالك الخاص لازم يكون أكبر من صفر لحساب النسبة.');
            return;
        }

        const ratio = debt / equity;
        const total = debt + equity;
        const debtSharePct = (debt / total) * 100;

        ratioElement.textContent = `${ratioFormatter.format(ratio)} : 1`;
        detailElement.textContent = `يعني لكل ريال من رأس مالك الخاص (${formatCurrency(equity)})، فيه ${ratioFormatter.format(ratio)} ريال دين — الدين يمثّل ${ratioFormatter.format(debtSharePct)}% من إجمالي تمويل مشروعك (${formatCurrency(total)}).`;

        resultElement.style.display = '';
    });
})();
