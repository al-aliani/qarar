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
    const form = document.getElementById('snCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('snCalcResult');
    const mainElement = document.getElementById('snResultMain');
    const detailElement = document.getElementById('snResultDetail');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const peakDemand = parseNum(form.peakDemand.value);
        const employeeCapacity = parseNum(form.employeeCapacity.value);

        if (![peakDemand, employeeCapacity].every(Number.isFinite)) {
            showError('عبّئ الحقلين بأرقام صحيحة.');
            return;
        }
        if (peakDemand <= 0 || employeeCapacity <= 0) {
            showError('العددين لازم يكونا أكبر من صفر.');
            return;
        }

        const staffNeeded = Math.ceil(peakDemand / employeeCapacity);
        mainElement.textContent = `${formatter.format(staffNeeded)} موظف`;
        detailElement.textContent = `بافتراض طاقة ${formatter.format(employeeCapacity)} عميل/طلب لكل موظف يوميًا، لتغطية ${formatter.format(peakDemand)} في أزحم يوم.`;

        resultElement.style.display = '';
    });
})();
