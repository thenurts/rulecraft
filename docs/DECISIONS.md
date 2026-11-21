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
