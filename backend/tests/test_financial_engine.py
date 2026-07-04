"""
Golden tests for the financial engine (Single Source of Truth).
Ensures NPV, IRR, Payback remain stable for GO/NO-GO decision consistency.
Run: pytest backend/tests/test_financial_engine.py -v
"""
import sys
from pathlib import Path

# Allow importing app from backend
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.financial_engine import npv, irr, payback_period, breakeven_quantity, gross_margin


# Golden scenario: استثمار أولي -100، تدفقات سنوية 30 لمدة 5 سنوات، معدل خصم 10%
GOLDEN_CASH_FLOWS = [-100.0, 30.0, 30.0, 30.0, 30.0, 30.0]
GOLDEN_DISCOUNT_RATE = 0.10


def test_npv_golden():
    """NPV لسيناريو ذهبي معروف: يجب أن يكون موجباً (مشروع مجدٍ)."""
    result = npv(GOLDEN_DISCOUNT_RATE, GOLDEN_CASH_FLOWS)
    # NPV ≈ 13.72 لـ -100 + 30/1.1 + 30/1.1^2 + ... + 30/1.1^5
    assert result > 0
    assert 13.0 < result < 15.0


def test_irr_golden():
    """IRR لسيناريو ذهبي: يجب أن يكون بين 15% و 20%."""
    result = irr(GOLDEN_CASH_FLOWS)
    assert result is not None
    assert 0.15 <= result <= 0.20


def test_payback_golden():
    """فترة الاسترداد: استرداد بين السنة 3 و 4."""
    result = payback_period(GOLDEN_CASH_FLOWS)
    assert result is not None
    assert 3.0 <= result <= 4.0


def test_breakeven_quantity():
    """نقطة التعادل: تكلفة ثابتة 1000، سعر 50، تكلفة متغيرة 30."""
    q = breakeven_quantity(1000.0, 50.0, 30.0)
    assert q is not None
    assert abs(q - 50.0) < 0.01  # 1000 / (50-30) = 50


def test_gross_margin():
    """هامش الربح الإجمالي: إيراد 100، تكلفة 60 → 40%."""
    m = gross_margin(100.0, 60.0)
    assert m is not None
    assert abs(m - 0.4) < 0.001


def test_npv_consistency():
    """NPV عند معدل = IRR يجب أن يكون قريباً من الصفر."""
    rate = irr(GOLDEN_CASH_FLOWS)
    assert rate is not None
    val = npv(rate, GOLDEN_CASH_FLOWS)
    assert abs(val) < 0.01
