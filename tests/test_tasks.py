"""
Tests for the Celery heavy-analysis task (tasks.py).

Verifies that run_heavy_feasibility_analysis is wired to the REAL
ProjectOptimizer (Monte Carlo simulation + sensitivity analysis) instead
of the old hardcoded stub (roi=34.5, canned ai_summary).

Celery tasks can be called directly as plain Python functions for testing
(no broker/worker needed) via `.run(...)` on the task object, which
bypasses the message queue entirely and just executes the task body.

Run: pytest tests/test_tasks.py -v
"""
import sys
from pathlib import Path

# Allow importing tasks/optimizer from the repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tasks import run_heavy_feasibility_analysis


# Realistic sample payload shaped like what /api/simulate accepts
# (see ai_server_enhanced.py:handle_simulation -> optimizer.run_simulation/analyze_sensitivity)
SAMPLE_DATA = {
    "inputs": {
        "hr": {
            "positions": [
                {"title": "مدير", "count": 1, "salary": 8000},
                {"title": "موظف مبيعات", "count": 3, "salary": 4000},
            ]
        },
        "technical": {
            "equipment": [{"price": 50000, "quantity": 2}],
            "furniture": [{"price": 10000, "quantity": 1}],
            "buildings": [],
        },
        "marketing": {"monthlyAdBudget": 3000, "openingBudget": 5000},
        "revenue": {
            "revenueStreams": [
                {"avgPrice": 100, "customersPerMonth": 500},
            ]
        },
        "logistics": {"logistics": [{"monthly": 2000}]},
        "administrative": {"administrative": [{"monthly": 1500}]},
    },
    "financials": {
        "revenueProjection": [{"total": 600000}],
        "opex": {"total": 400000},
        "incomeStatement": [{"revenue": 600000}],
    },
}


def test_run_heavy_feasibility_analysis_returns_real_result():
    """Direct plain-function call (no broker) — task must run the real optimizer."""
    result = run_heavy_feasibility_analysis.run("study-123", SAMPLE_DATA)

    assert result["study_id"] == "study-123"

    # The old stub returned a hardcoded roi=34.5 and no simulation/sensitivity data at all.
    assert "roi" not in result
    assert "break_even_months" not in result
    assert result["ai_summary"] != (
        "The project exhibits high potential due to low competition in the "
        "specified geographical area."
    )

    # Real Monte Carlo simulation output (5000 iterations, see optimizer.run_simulation)
    sim = result["simulation"]
    assert sim["mode"] == "simulation"
    assert sim["iterations"] == 5000
    assert 0.0 <= sim["risk_of_loss"] <= 100.0
    assert sim["p90_profit"] <= sim["p50_profit"] <= sim["p10_profit"]

    # Real sensitivity analysis output (see optimizer.analyze_sensitivity)
    sens = result["sensitivity"]
    assert sens["mode"] == "sensitivity"
    assert len(sens["ranking"]) == 3
    assert sens["top_factor"] in sens["ranking"]

    # Top-level convenience fields mirror the simulation stats
    assert result["risk_of_loss"] == sim["risk_of_loss"]
    assert result["p50_profit"] == sim["p50_profit"]
    assert result["top_impact_factor"] == sens["top_factor"]
    assert result["ai_summary"] == sim["message"]


def test_run_heavy_feasibility_analysis_handles_missing_data():
    """Called with no data payload, the task should not crash (defaults to {})."""
    result = run_heavy_feasibility_analysis.run("study-empty")

    assert result["study_id"] == "study-empty"
    assert result["simulation"]["mode"] == "simulation"
    assert result["sensitivity"]["mode"] == "sensitivity"
