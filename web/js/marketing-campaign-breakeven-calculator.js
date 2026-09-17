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
    const formatCurrency = (value) => `${formatter.format(Math.round(value))} ريال`;
    const form = document.getElementById('mcCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('mcCalcResult');
    const mainElement = document.getElementById('mcResultMain');
    const detailElement = document.getElementById('mcResultDetail');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const budget = parseNum(form.budget.value);
        const profitPerCustomer = parseNum(form.profitPerCustomer.value);

        if (![budget, profitPerCustomer].every(Number.isFinite)) {
            showError('عبّئ الحقلين بأرقام صحيحة.');
            return;
        }
        if (budget <= 0 || profitPerCustomer <= 0) {
            showError('الميزانية والربح من العميل الواحد لازم يكونا أكبر من صفر.');
            return;
        }

        const customersNeeded = Math.ceil(budget / profitPerCustomer);
        mainElement.textContent = `${formatter.format(customersNeeded)} عميل`;
        detailElement.textContent = `لتتعادل ميزانية ${formatCurrency(budget)} — أي أقصى تكلفة اكتساب عميل تتحمّلها الحملة بلا خسارة هي ${formatCurrency(profitPerCustomer)}.`;

        resultElement.style.display = '';
    });
})();
