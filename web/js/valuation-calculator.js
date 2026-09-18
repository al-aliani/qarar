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
    const form = document.getElementById('valCalcForm');
    if (!form) return;

    const errorElement = form.querySelector('[data-calc-error]');
    const resultElement = document.getElementById('valResult');
    const multipleResultElement = document.getElementById('valMultipleResult');
    const multipleStakeElement = document.getElementById('valMultipleStake');
    const multipleNoteElement = document.getElementById('valMultipleNote');
    const assetsResultElement = document.getElementById('valAssetsResult');
    const assetsStakeElement = document.getElementById('valAssetsStake');
    const assetsNoteElement = document.getElementById('valAssetsNote');

    const showError = (message) => {
        errorElement.textContent = message;
        errorElement.style.display = '';
        resultElement.style.display = 'none';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const netProfit = parseNum(form.netProfit.value);
        const multiplier = parseNum(form.multiplier.value);
        const totalAssets = parseNum(form.totalAssets.value);
        const totalLiabilities = parseNum(form.totalLiabilities.value);
        const stakeRaw = form.stakePct.value.trim();
        const stakePct = stakeRaw === '' ? null : parseNum(stakeRaw);

        if (![netProfit, multiplier, totalAssets, totalLiabilities].every(Number.isFinite)) {
            showError('عبّئ الحقول الأربعة الأولى بأرقام صحيحة.');
            return;
        }
        if (multiplier <= 0) {
            showError('المضاعف لازم يكون أكبر من صفر.');
            return;
        }
        if (totalAssets < 0 || totalLiabilities < 0) {
            showError('الأصول والالتزامات لازم تكون صفر أو أكبر.');
            return;
        }
        if (stakePct !== null && (!Number.isFinite(stakePct) || stakePct <= 0 || stakePct > 100)) {
            showError('نسبة الحصة لازم تكون رقمًا بين 1 و100 (أو تُترك فارغة).');
            return;
        }

        if (netProfit > 0) {
            const multipleValue = netProfit * multiplier;
            multipleResultElement.textContent = formatCurrency(multipleValue);
            multipleNoteElement.style.display = 'none';
            if (stakePct !== null) {
                multipleStakeElement.textContent = `قيمة حصة ${formatter.format(stakePct)}%: ${formatCurrency((multipleValue * stakePct) / 100)}`;
                multipleStakeElement.style.display = '';
            } else {
                multipleStakeElement.style.display = 'none';
            }
        } else {
            multipleResultElement.textContent = '—';
            multipleStakeElement.style.display = 'none';
            multipleNoteElement.textContent = 'غير قابلة للحساب بهذه الطريقة لأن الربح السنوي صفر أو أقل — اعتمد على طريقة صافي الأصول بالأسفل.';
            multipleNoteElement.style.display = '';
        }

        const assetsValue = totalAssets - totalLiabilities;
        assetsResultElement.textContent = formatCurrency(assetsValue);
        if (stakePct !== null) {
            assetsStakeElement.textContent = `قيمة حصة ${formatter.format(stakePct)}%: ${formatCurrency((assetsValue * stakePct) / 100)}`;
            assetsStakeElement.style.display = '';
        } else {
            assetsStakeElement.style.display = 'none';
        }
        if (assetsValue < 0) {
            assetsNoteElement.textContent = 'الالتزامات تفوق الأصول حاليًا (قيمة دفترية سالبة) — مؤشر يستحق مراجعة فورية قبل أي تفاوض.';
            assetsNoteElement.style.display = '';
        } else {
            assetsNoteElement.style.display = 'none';
        }

        resultElement.style.display = '';
    });
})();
