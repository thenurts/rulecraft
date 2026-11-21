# Task 06 - Junior/Full, Campaign/Sandbox and first-playable gate

Implement a single engine with data-driven mode profiles, both campaign and sandbox in each, configured initial decree vocabulary, first Hungry Village scenario, end-state detection, tutorial/hints and difficulty tuning. Same decree semantics under identical shared settings; reject unsupported mode conversion. Run acceptance table from `docs/03_Vertical_Slice.md` and collect measured mobile performance and user-playtest findings where actually available. Deliver a gap list instead of asserting readiness from automated tests alone.


## Task 06 detailed design and implementation gate

See [Task 06 contract](../docs/14_Task_06_Modes_Campaign_Sandbox.md). This is a product-owner design proposal, not authorisation to silently rebalance the economy or claim final readiness.

**Four proposed increments:** 1) versioned validated Junior/Full and Campaign/Sandbox profiles, session metadata and historical-save parity; 2) a genuine Hungry Village tutorial, outcome/retry flow, **measured strategy and win-rate calibration**; 3) seeded Sandbox/presets with no victory objective and an honestly stated longer-duration limit; 4) full simulation/browser/regression acceptance matrix and **physical phone + human playtest evidence or explicitly Not Yet Tested**.

**Critical caution:** neither Junior difficulty nor campaign solvability follows from merely changing dropdown visibility or the currently provisional 90%-fed/40-food targets. Existing six foresters have no funded timber buyer; food affordability gaps exist even when stock remains. Measure multiple player strategies across seeds before locking goals; any new economic mechanics require explicit product approval and versioned save/replay evaluation. Preserve current v1–v4 historical golden hashes and Task 05 truth-grounded narratives. Issue #16 covers staging/device access, issue #17 covers enlarged-text composer legibility.
