# Task 03 - Autonomous citizens and adoption

Introduce awareness dissemination, trust- and resource-influenced compliance, stochastic utility decisions, feasible action filtering, enforcement constrained by guards' actual work capacity, and causal event provenance. Use reproducible per-actor/slot RNG. Compare multiple seeds, show confidence intervals/effect directions. Implement the simplified market and hunger/fatigue feedback loops required for the Hungry Village.

Do not define a single decree-adoption percentage that directly applies production bonuses. Decrees affect individual decisions; outcomes flow through actions and transfers.


## Detailed Task 03 contract

The implementation contract is [docs/08_Task_03_Autonomous_Society.md](../docs/08_Task_03_Autonomous_Society.md). Read it before coding, together with the prior approved law semantics in docs/06_Task_02_Law_Semantics.md and Task 01/02 reports.

Implement **four reviewed increments**, not a broad rewrites:
1. Versioned awareness diffusion, explicit information sources/contact graph and deterministic dawn notification events.
2. Explainable needs/trust/acceptance-driven decisions, correct compliance denominators, and deterministic fair scarcity allocation.
3. Physically capacity-limited guard detection with factual event linkage and warnings only.
4. 200+ matched-seed evaluation with confidence intervals, save/replay and legacy regression checks.

No player-facing full UI, fictional social simulation, unapproved timber buyer, taxes/fines, Gazette/advisers or game-scale expansion. Flag unresolved product choices. Stop after Task 03 PR for owner review before Task 04.
