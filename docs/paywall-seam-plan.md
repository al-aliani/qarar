# Paid-Gate "Seam" — Implementation Plan (read-only; no code edits made)

Goal: create the two enforcement chokepoints (results + export) the paywall will later hang
off, rewrite the entitlement model to the real `249 / 990 / 2900 SAR + pay-to-unlock-edit`
pricing, and do it in a phased way that never breaks the current free experience. Findings are
grounded in the actual tree as of 2026-07-06.

## 0. What the code actually looks like (verified)

- **No single results chokepoint.** `web/js/services/DataService.js` (lines 6–22) imports
  `calculateStudy as runFullModel` only for `compareStudies`; it has **no** `getResults()`. Every
  view re-runs the engine itself. Confirmed 27+ importers via grep of `core/engine.js`, e.g.
  `DecisionDashboard.js:5,39,49,50,415,617`, `InvestorDashboard.js:6,38`,
  `ExecutiveSummary.js:6,31,469`, plus `app.js:1015,1022`.
- **Engine signature is `calculateStudy(study, overrides)`** (`engine.js:28`). `overrides`
  (`revenueChange`, `priceChange`, `opexChange`, `capexChange`, `volumeChange`, `vcRateChange`,
  `fixedChange`) is used for scenario/stress runs (DecisionDashboard 49/50/415). The cache key
  MUST fold in `overrides`, or scenario runs will collide with the base run.
- **State source of truth is `store`** (`web/js/core/store.js`; `store.getState()`), mutated
  only through `store.set()` (440) and `store.update()` (470), with `store.subscribe()` (540).
  This gives a clean cache-invalidation hook.
- **Exports are already ~90% funnelled.** `web/export/index.js` exists as a barrel but does NOT
  gate anything. The real dispatch is `web/js/ui/ExportMenu.js` — one component whose click
  handler lazy-imports every generator (`ExportMenu.js:409–668`: PDF, PPTX, Word, Excel, CSV,
  Bank, Monshaat, ProfessionalReview, PitchDeck, InvestorAcceleratorOnePager, Crowdfunding,
  BusinessPlanFeasibility). **Leaks:** `DecisionDashboard.js:521` calls
  `PitchDeckExporter.generateHTML` directly, and `QuickFeasibilityWizard.js:8` uses
  `QuickPDFGenerator`. Those two bypass ExportMenu.
- **AuthGuard tiers are fictional & dead.** `AuthGuard.js:195–260` (`hasPermission`,
  `getSubscriptionTier`, `canCreateProject`) use `free/pro/enterprise` read from
  `currentUser.user_metadata.subscription_tier` — nothing writes it, nothing calls these. Must be
  replaced, not extended.

## 1. Memoized single results provider

Add to `DataService.js` a static memoized `getResults`:

```
static _cache = { key: null, value: null };
static getResults(study = store.getState(), overrides = null) {
    const key = DataService._resultsKey(study, overrides);
    if (DataService._cache.key === key) return DataService._cache.value;
    const value = runFullModel(study, overrides || undefined);
    DataService._cache = { key, value };
    return value;
}
static _resultsKey(study, overrides) {
    // stable, cheap-ish: study revision + serialized overrides
    return (study?.__rev ?? JSON.stringify(study)) + '::' + JSON.stringify(overrides || {});
}
static invalidateResults() { DataService._cache = { key: null, value: null }; }
```

Prefer a **monotonic revision counter** over `JSON.stringify(study)` for the base key: bump a
`store._rev` inside `store.set()` (440) and `store.update()` (470), expose `store.getRev()`, and
key on it. Wire `store.subscribe(() => DataService.invalidateResults())` once at boot in
`app.js`. This makes the cache O(1) and correct on every mutation. Keep the `JSON.stringify`
fallback for callers that pass an ad-hoc `study` not owned by the store (e.g. `compareStudies`,
which must call `runFullModel` directly / with a null cache to compare two arbitrary studies —
do NOT route those through the shared single-slot cache).

Because scenario callers pass `overrides`, the cache is a single slot keyed by
`rev+overrides`; the base render (overrides null) and the −20%/+20% runs won't thrash each other
within one paint if we later widen to a small LRU (Map of last ~4 keys). Start single-slot; note
LRU as a follow-up if profiling shows churn on DecisionDashboard (it does 3 runs per render).

### Migration of the 27 consumers

Codemod is a mechanical two-step per file:
1. Delete `import { calculateStudy as runFullModel } from '../core/engine.js';`
   add `import { DataService } from '<rel>/services/DataService.js';`
2. Replace call sites:
   - `runFullModel(state)` / `runFullModel(store.getState())` → `DataService.getResults(state)`
   - `runFullModel(state, overrides)` → `DataService.getResults(state, overrides)`

Find-replace anchor (regex): `runFullModel\(([^,]*?)\)` → `DataService.getResults($1)` and
`runFullModel\(([^,]+),\s*(\{[^)]*\})\)` → `DataService.getResults($1, $2)`. Review each hunk —
the relative import depth differs (`ui/` = `../services/`, `export/` = `../js/services/`).

Files to migrate (base render, no overrides unless noted): `app.js` (1015,1022);
`ui/DecisionDashboard.js` (overrides), `InvestorDashboard.js`, `ExecutiveSummary.js`,
`FinancialDashboard.js`, `FinancialStatements.js`, `FinancingStructure.js`, `InvestorAnalysis.js`,
`BreakEvenAnalysis.js`, `DashboardView.js`, `PostLaunchTracker.js`, `PresentationView.js`,
`ScenarioAnalysis.js`, `ScenarioSwitcher.js` (overrides), `SensitivityAnalysis.js` (overrides),
`StressTest.js` (overrides), `ServiceAnalysis.js`, `ValuationAnalysis.js`, `ZakatView.js`,
`LoanScheduleView.js`, `BenchmarkingView.js`, `ReportBuilderView.js`, `LivePanel.js`,
`AIChatModal.js`, `ShareStudyView.js`, `Sidebar.js`; services `ReportGenerator.js`,
`SmartAdvisor.js`; utils `dataQuality.js`, `sectionExporter.js`, `shareUtils.js`,
`studyCompleteness.js`; export `adaptRunFullModelForExcel.js`. `ExportMenu.js` (10,323) migrates
too. Leave `DataService.compareStudies` and the engine's own `__tests__` calling `calculateStudy`
directly. This migration is a pure refactor and must ship **before** any gating (Phase A) so the
chokepoint exists with identical behavior.

## 2. Single export chokepoint

Repurpose `web/export/index.js` into the real chokepoint: add a single
`export async function runExport(kind, ctx)` that owns the `switch` currently inlined in
`ExportMenu.js:409–668`. It (a) resolves the entitlement, (b) lazy-imports the one generator,
(c) calls `DataService.getResults()` once and passes results down (so generators stop importing
the engine), (d) returns `{ok, filename}` or `{ok:false, reason:'locked', requiredTier}`.
`ExportMenu.js` becomes a thin view that renders buttons and calls `runExport(kind, {store})`.
Fix the two leaks: `DecisionDashboard.js:521` and `QuickFeasibilityWizard.js` must call
`runExport('pitch'|'quickPdf', …)` instead of the generator directly. After migration, grep must
show **zero** `new *Exporter` / `*Generator.generateHTML` / `exportTo*` call sites outside
`export/`. That single grep becomes the CI guard that the chokepoint stays sealed.

## 3. Entitlement model (249 / 990 / 2900 + pay-to-unlock-edit)

Delete `hasPermission/getSubscriptionTier/canCreateProject` and the `free/pro/enterprise` map.
Replace with a real, named model in a new `web/js/services/Entitlements.js`:

- Tiers keyed to price: `basic` (249), `pro` (990), `premium` (2900), plus implicit `guest`.
- Capabilities are the axes the app actually has: `view`, `edit` (the pay-to-unlock lever),
  `export:{pdf,excel,word,csv,pptx}`, and **report tiers** `report:{bank, monshaat,
  professionalReview, pitch, onePager, crowdfunding, businessPlan}`.

Proposed matrix (owner to confirm — this is the seam, values are config):
- `guest`: `view` only; live numbers visible, editing blocked, all exports locked.
- `basic (249)`: `view`+`edit` for one study; `export:pdf`, `report:bank` (the single
  "get one study out" tier).
- `pro (990)`: everything in basic + `export:{excel,word,csv}`, `report:{monshaat, pitch,
  onePager, businessPlan}`, multiple studies.
- `premium (2900)`: all exports + all report tiers incl. `professionalReview`, `crowdfunding`,
  `pptx`, plus AI features.

Source of truth: a **`subscriptions` table in Supabase keyed by `user_id`** (`tier`,
`status`, `current_period_end`, `study_id` for per-study unlock), **not** `user_metadata`
(client-writable, unauditable). `Entitlements.load(userId)` reads it (with RLS: user can only
SELECT their own row; only the server/webhook can INSERT/UPDATE). Expose
`Entitlements.can(capability, {studyId})` and `Entitlements.requiredTierFor(capability)` for the
paywall UI to show "upgrade to X". Guest/offline falls back to a `guest` entitlement object.

## 4. The two enforcement points — what each checks

- **Results provider (`DataService.getResults`)**: enforces `view`. Since free users are allowed
  to *see* live numbers (quality-first funnel), the default is: always compute, but the caller
  decides masking. Practically, gate **`edit`** here-adjacent: the store's `set/update` path (or
  the wizard's save action) calls `Entitlements.can('edit', {studyId})` and, if false, keeps the
  edit local/ephemeral and shows the unlock prompt. `getResults` itself stays ungated (blocking it
  would blank the whole app and kill the funnel); it is the *edit-commit* and *export* that gate.
- **Export entry (`runExport`)**: enforces `export:*` and `report:*`. First line:
  `if (!Entitlements.can(capabilityFor(kind), {studyId})) return {ok:false, reason:'locked',
  requiredTier: Entitlements.requiredTierFor(...)}`. ExportMenu renders locked buttons with a lock
  badge + upgrade CTA instead of firing the download.

## 5. Server-side vs client-side (be honest about bypass)

The client is fully inspectable ES modules — **any** client-only gate is bypassable by a user who
opens devtools and calls `calculateStudy`/the generator directly, or edits the entitlement object
in memory. Therefore:
- **Client-side (UX only):** the `Entitlements.can` checks in `getResults`-edit path and
  `runExport`, the locked-button UI, the upgrade prompts. These stop honest users and shape the
  funnel; they are NOT security.
- **Must be server-side (real gate):** (a) the `subscriptions` row is written **only** by a
  payment webhook / server function, never the client; RLS makes the row read-only to the user.
  (b) The genuinely valuable, non-bypassable deliverables — the polished Bank/Monshaat/
  Professional PDFs and the persisted/cloud-saved study — must be **generated or signed
  server-side** behind an endpoint that re-checks entitlement from the DB. Until that endpoint
  exists, treat client export as "honor system": good enough to launch the funnel, explicitly not
  a hard paywall. Document this limit for the owner so quality-first launch isn't mistaken for
  revenue protection.

## 6. Phased rollout & ordered task list

**Phase A — build the seam, zero behavior change (safe to ship immediately):**
1. Add `store._rev` bump in `set()`/`update()` + `getRev()`.
2. Add `DataService.getResults/invalidateResults/_resultsKey`; subscribe-invalidate in `app.js`.
3. Codemod the 27+ consumers to `DataService.getResults` (Section 1 list). Run the engine unit
   tests + restaurant regression to confirm identical numbers.
4. Move the ExportMenu `switch` into `export/index.js#runExport`; make generators take injected
   `results`; fix the `DecisionDashboard.js:521` + `QuickFeasibilityWizard` leaks. Add the
   grep-guard. Still no gating — every `can()` returns true.

**Phase B — entitlement model, still open (flag-off):**
5. Create `subscriptions` table + RLS + `Entitlements.js`; delete dead AuthGuard tier methods.
6. Wire `Entitlements.can` into `runExport` and the edit-commit path behind a feature flag that
   defaults to "everything unlocked". Ship dark.

**Phase C — turn the gate on:**
7. Flip the flag per capability; add locked-button UI + upgrade CTAs.
8. Add the server-side webhook writer + a server export/verify endpoint for the paid PDFs
   (the only real enforcement). Only then is it a paywall rather than a funnel nudge.

Ship A fully before B; B before C. A is a pure refactor and is the prerequisite that makes B/C a
config change in two files instead of surgery across 27.
