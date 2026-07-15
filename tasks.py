from celery_app import app
from optimizer import ProjectOptimizer


@app.task(bind=True)
def run_heavy_feasibility_analysis(self, study_id, data=None):
    """
    Runs the real heavy feasibility analysis for a study: a Monte Carlo
    risk simulation plus a sensitivity (impact) analysis, using the same
    ProjectOptimizer engine that backs the synchronous /api/simulate
    endpoint in ai_server_enhanced.py (handle_simulation).

    This task exists to move that heavy computation (thousands of Monte
    Carlo iterations) off the synchronous request path and onto a Celery
    worker.

    Args:
        study_id: identifier of the study being analyzed.
        data: the same payload shape /api/simulate accepts, e.g.
            {
                "inputs": {...},       # raw wizard inputs (hr, revenue, technical, ...)
                "financials": {...},   # computed financials (revenueProjection, opex, ...)
            }

    Returns:
        dict with the real computed simulation + sensitivity results.
    """
    data = data or {}

    def _report_progress(current, status):
        # self.request.id is only set when the task runs through a real
        # worker/broker (apply_async/delay). When called directly as a
        # plain function (e.g. task.run(...) in tests, with no broker
        # configured), there is no task id and no point persisting state
        # to the result backend, so we skip it rather than fail.
        if getattr(self, 'request', None) and self.request.id:
            self.update_state(state='PROGRESS', meta={'current': current, 'total': 100, 'status': status})

    print(f"Starting heavy analysis for study ID: {study_id}")
    _report_progress(10, 'Initializing Optimizer...')

    optimizer = ProjectOptimizer()

    _report_progress(40, 'Running Monte Carlo Simulation...')
    simulation = optimizer.run_simulation(data)

    _report_progress(80, 'Analyzing Sensitivity...')
    sensitivity = optimizer.analyze_sensitivity(data)

    _report_progress(100, 'Finalizing Report...')

    result = {
        "study_id": study_id,
        "simulation": simulation,
        "sensitivity": sensitivity,
        "risk_of_loss": simulation.get("risk_of_loss"),
        "p50_profit": simulation.get("p50_profit"),
        "p90_profit": simulation.get("p90_profit"),
        "p10_profit": simulation.get("p10_profit"),
        "top_impact_factor": sensitivity.get("top_factor"),
        "ai_summary": simulation.get("message", ""),
    }

    print(f"Completed analysis for study ID: {study_id}")
    return result
