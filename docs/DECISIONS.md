# Rulecraft - Decision Register

## Confirmed product constraints

- Rulecraft is a standalone, mobile-first project separate from The Nurts Adventures.
- One shared simulation engine, with configurable Junior (7-12) and Full modes.
- Player influences the world only via decrees; citizens and institutions act autonomously.
- Typed dropdown decree grammar rather than unrestricted free-text execution.
- Legal enactment between turns; progressive awareness, acceptance, feasibility, enforcement and consequences.
- Probabilistic decisions with reproducible seeded simulation.
- Campaign and sandbox experiences.
- Four advisers: Zoey (economy/science), Liam (security), Mia (culture/creativity), Noah (welfare/diplomacy).
- Substantial simulation-grounded cheeky humour, Gazette and shareable incidents.
- Eventual Android/iOS distribution with web deployment as an option.

## Outstanding engineering sign-offs

| ID | Decision | Status | Proposed option / evidence needed |
|---|---|---|---|
| ARCH-001 | Primary runtime, renderer and native packaging route | Open | Compare TypeScript + React/Vite + Capacitor against game-engine alternative; mobile spike |
| SIM-001 | Seeded RNG and numeric representation | Open | Pick explicit algorithm and numeric contract; verify cross-runtime golden fixtures |
| LAW-001 | Typed grammar and precedent ordering | Open | Formal registry plus conflict test cases |
| WORLD-001 | Ownership and transaction conservation schema | Open | Define balanced transfers and audited sources/sinks |
| AGT-001 | Citizen utility and adoption coefficients | Provisional | Start simple, test with seeded runs and seed-sweep distributions |
| UX-001 | Portrait/landscape behaviour and phone width baseline | Open | Real Android/iOS checks |
| PERF-001 | Performance budget and target devices | Provisional | Benchmark on actual mid-range device |
| PROD-001 | Accessibility of Junior Mode for ages 7-12 | Open | Supervised playtesting |

For each new sign-off, record the date, reviewer, selected option, rejected alternatives, reasoning and affected tests.

## Task 00 proposals · 21 November 2026

Owner review is pending. See the [architecture report](04_Task_00_Architecture.md) for conflicts, alternatives, and the verification plan.

| Decision | Proposal and approval gate | Affected checks |
|---|---|---|
| ARCH-001 | Approve a TypeScript core with a React/Vite web shell and Vitest for the next milestone. Keep Capacitor provisional until Android/iOS device and WebView evidence. Godot remains a 2D alternative if rendering needs warrant it. | RNG-01, MOB-01, MOB-02, MOB-04 |
| SIM-001 | Approve versioned keyed draws, bounded integer/fixed-point arithmetic, stable IDs and canonical snapshot/event bytes. Choose and lock the algorithm, encoding, numeric scale and overflow rules before implementing Task 01 behaviour. | RNG-01, RNG-02, BUILD-12, BUILD-24 |
| WORLD-001 | Approve rule-free fixture accounts, action eligibility, slot and settlement order, blocked-attempt semantics and debits/credits before Task 01. The opening stocks and prices remain candidates. | AGT-03, ECO-01, BUILD-07, BUILD-08, BUILD-10, BUILD-17 |
| LAW-001 | Before Task 02, approve actual versus perceived decree versions, durable between-turn enactment, clause exposure, a full precedence/licence table and the rule-free Task 01 scope. Resolve the passive detection policy before enforcement. | LAW-02 through LAW-06, BUILD-05, BUILD-06, BUILD-09 |
| SAVE-001 | Approve whole-turn snapshot commits with a prior checkpoint and separate editable drafts. Define schema compatibility and failure handling before Task 01 persistence. Browser and native store implementations follow platform testing. | SAVE-01, MOB-03, BUILD-18, BUILD-22 |
| UX-001, PERF-001, PROD-001 | Keep portrait-first as a candidate. Agree the device matrix, orientation and release thresholds after physical-device checks. Validate Junior's disclosure and reading demands through supervised playtesting. | BUILD-20, BUILD-21, MOB-01 |
