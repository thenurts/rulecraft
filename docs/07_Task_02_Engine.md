# Task 02 · Typed decree engine

[Issue #4](https://github.com/thenurts/rulecraft/issues/4) and the [approved legal principles](06_Task_02_Law_Semantics.md) define this milestone. The headless composer validates typed clauses and shows blocking errors or strategic warnings. The lawbook, the citizen's known version and the factual action event remain separate. The simulation package still uses ECMAScript APIs only. Node file persistence and the demo live under `tools/`.

| Increment | Evidence |
|---|---|
| 1 · Registry, composition and AST | `npm ci --cache /tmp/rulecraft-npm-cache` passed. `npm test` passed 63 tests in 6 files. `npm run build` passed type checking and bundling. Tests cover capability reset, unavailable actions and operands, typed thresholds, strategic warnings and shared Junior/Full interpretation. |
| 2 · Lifecycle, legal matrix and saves | `npm test` passed 89 tests in 8 files. `npm run build` passed. Named tests exercise the modality/priority rows, licence grants and prohibitions, authority and applicability, stale and unknown versions, terminal abolition, idempotence and interrupted confirmation before advancement. |
| 3 · Choice and regression | Clean install, `npm test` with 95 tests in 9 files, `npm run build` and `git diff --check` passed. Integration tests cover actual versus perceived pressure, two simultaneous duties, stock crossing a threshold between slots, paused-law replay, the Task 01 baseline and resource conservation. |

Checks used Linux, Node 24.22.3, npm 11.19.1 and Vitest 5.1.1. The v2 replay also ran via the Vite dev server in headless desktop Chromium 156. It produced the same hashes and resource audit as Node after a day-6 reload.

## Reproduce the evidence

```sh
npm run --silent simulate:law
npm run --silent simulate -- --seed 42
```

The first command compares day-one harvests on the same 64 seeds (0–63) and fixture. Explicit notices reach every farmer in each decree treatment. Totals are harvested units from ledger entries, not intent counts.

| Scenario | Harvested units | Change from baseline |
|---|---:|---:|
| No decree | 4,698 | — |
| Known MUST | 5,169 | +10.0% |
| Known MUST_NOT | 3,033 | −35.4% |
| Known MAY | 4,698 | 0.0% |

The demo also commits a duty at turn zero, reads it from disk before advancing, suspends it after day six and compares uninterrupted and restored runs byte for byte. On day seven, the suspended duty is officially optional while the farmer still perceives it as required. The day-12 v2 state digest is `6d3f0260b1cde92c` and the event digest is `a9114ded8e11a629`. The audit covers 888 transactions and 2,246 movements. Opening food 495 reconciles to 468 consumed and 27 remaining. All 120 timber units and 1,500 coins are accounted for.

The original v1 command retains state digest `713a9e709bf6e873` and event digest `72f67e9184e65e5f`. The v1 loader and CLI still support old saves. The v2 loader rejects v1 explicitly, and tests verify identical rule-free world state, event stream and transactions when v2 advances without decrees.

## Product review

- The precedence and licence matrix follows the proposed contract. A lower-ranked applicable `MAY` can still supply a separate licence for the winning duty. The synthetic export tests cover this edge and the winning prohibition case. Export remains unavailable to players.
- Same-turn versions share an effective turn, with the latest confirmation governing that turn. Amendments preserve suspension. The manual notice input refuses older versions after a citizen has learned a later one. These details are explicit in the [decision register](DECISIONS.md).
- The weight floors preserve an actor's positive baseline chance when a known prohibition deters a feasible action. These weights are provisional. The matched-seed example tests direction and conservation, with no claim of awareness or enforcement calibration.
- Authoring warnings conservatively flag potentially overlapping numeric clauses. The resolver checks precise applicability on the observed slot-opening values. Physical Android/iOS checks and the full mobile composer are pending. Existing follow-ups include fixed actor-order scarcity, timber affordability, price and wage audit extensions and full-history checkpoint scaling.
