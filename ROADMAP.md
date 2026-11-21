# Rulecraft - Codex Execution Roadmap

The task documents are **review checkpoints**. A milestone is not complete because code was generated; it is complete when its gates have been demonstrated and reviewed.

| Checkpoint | Focus | Exit evidence |
|---|---|---|
| 00 | Architecture and mobile feasibility | Decision record; runnable baseline; automated tests; narrow-screen proof; cross-platform plan |
| 01 | Headless simulation | A 12-day village fixture with seed-stable results, resource ledger audits and save/replay |
| 02 | Typed decrees | Registry, AST validation, conflicts, enact/amend/suspend/repeal and tests |
| 03 | Autonomous population | Awareness, adoption, utility decisions, enforcement capacity, emergent interactions and explanations |
| 04 | Touch-first playable shell | Village, composer, decree book, advance turn, inquiry; phone-browser checks |
| 05 | Adviser humour and incident sharing | Zoey/Liam/Mia/Noah, Gazette, Chronicle, cause-grounded share card |
| 06 | Modes, campaign and sandbox | Junior/Full profiles, first campaign scenario, sandbox, performance and playtest gates |

## Provisional stack direction

Keep the core TypeScript package separate from all UI packages. Evaluate React/Vite + Capacitor, and verify a working deployment path to web, Android and iOS with actual devices before committing to a final application shell. Deferred native builds must still have documented adapter seams.

## Control points

- Product owner approves all material choices listed in `docs/DECISIONS.md`.
- A single seeded replay and statistical seed-sweep are **different tests**; require both when relevant.
- No fake simulation data in player-facing narratives.
- Do not bypass specifications by implementing static per-decree bonuses or hand-scripted behaviour as if it were emergent.
- Run acceptance IDs from `docs/03_Vertical_Slice.md` and mark them Pass / Fail / Not Yet Tested with evidence.
