from typing import List, Dict, Any

from .financial_engine import npv, irr, payback_period


def laundry_feasibility_summary(
    discount_rate: float,
    investment_initial: float,
    monthly_rent: float,
    monthly_salaries: float,
    monthly_other_fixed: float,
    avg_ticket: float,
    customers_per_day: int,
    days_per_month: int,
    cost_ratio: float,
    months: int = 60,
    monthly_growth_rate: float = 0.0,
    tax_rate: float = 0.0,
    loan_amount: float = 0.0,
    loan_annual_rate: float = 0.0,
    loan_years: int = 0,
) -> Dict[str, Any]:
    """
    نموذج دراسة جدوى مغسلة ملابس (مبني على نفس منطق الكوفي شوب).
    """
    from .coffee_shop_model import build_monthly_cash_flows

    cash_flows = build_monthly_cash_flows(
        investment_initial=investment_initial,
        monthly_rent=monthly_rent,
        monthly_salaries=monthly_salaries,
        monthly_other_fixed=monthly_other_fixed,
        avg_ticket=avg_ticket,
        customers_per_day=customers_per_day,
        days_per_month=days_per_month,
        cost_ratio=cost_ratio,
        months=months,
        monthly_growth_rate=monthly_growth_rate,
        tax_rate=tax_rate,
        loan_amount=loan_amount,
        loan_annual_rate=loan_annual_rate,
        loan_years=loan_years,
    )

    project_npv = npv(discount_rate, cash_flows)
    project_irr = irr(cash_flows)
    project_payback = payback_period(cash_flows)

    base_monthly_revenue = avg_ticket * customers_per_day * days_per_month
    monthly_profit = cash_flows[1] if len(cash_flows) > 1 else None

    return {
        "cash_flows": cash_flows,
        "npv": project_npv,
        "irr": project_irr,
        "payback_period": project_payback,
        "monthly_revenue": base_monthly_revenue,
        "monthly_profit": monthly_profit,
    }
