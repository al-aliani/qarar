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
    const form = document.getElementById('pmCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('pmCalcResult');
    const grossPctElement = document.getElementById('pmGrossPct');
    const grossAmountElement = document.getElementById('pmGrossAmount');
    const netPctElement = document.getElementById('pmNetPct');
    const netAmountElement = document.getElementById('pmNetAmount');
    const netNoteElement = document.getElementById('pmNetNote');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const revenue = parseNum(form.revenue.value);
        const cogs = parseNum(form.cogs.value);
        const otherExpenses = parseNum(form.otherExpenses.value);

        if (![revenue, cogs, otherExpenses].every(Number.isFinite)) {
            showError('عبّئ الحقول الثلاثة بأرقام صحيحة.');
            return;
        }
        if (revenue <= 0 || cogs < 0 || otherExpenses < 0) {
            showError('الإيرادات لازم تكون أكبر من صفر، والتكاليف صفر أو أكبر.');
            return;
        }

        const grossProfit = revenue - cogs;
        const grossPct = (grossProfit / revenue) * 100;
        grossPctElement.textContent = `${pctFormatter.format(grossPct)}%`;
        grossPctElement.style.color = grossProfit >= 0 ? 'var(--c-success,#0e5b44)' : 'var(--c-danger,#c0392b)';
        grossAmountElement.textContent = `${formatCurrency(grossProfit)} شهريًا قبل باقي المصاريف.`;

        const netProfit = revenue - cogs - otherExpenses;
        const netPct = (netProfit / revenue) * 100;
        netPctElement.textContent = `${pctFormatter.format(netPct)}%`;
        netAmountElement.textContent = `${formatCurrency(netProfit)} صافي ربح شهري بعد كل المصاريف.`;

        if (netProfit < 0) {
            netPctElement.style.color = 'var(--c-danger,#c0392b)';
            netNoteElement.textContent = 'هامشك الصافي سالب — تكاليفك الإجمالية تفوق إيراداتك حاليًا، هذا مؤشر يستحق مراجعة فورية للأسعار أو المصاريف.';
            netNoteElement.style.display = '';
        } else {
            netPctElement.style.color = 'var(--c-success,#0e5b44)';
            netNoteElement.style.display = 'none';
        }

        resultElement.style.display = '';
    });
})();
