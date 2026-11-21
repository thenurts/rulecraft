# Rulecraft - Repository Instructions for Codex

## Product contract

Rulecraft is a standalone, mobile-first, humorous systemic-governance game, distinct from The Nurts Adventures. Treat `docs/01_Master_GDD.md`, `docs/02_Technical_Systems.md`, and `docs/03_Vertical_Slice.md` as the baseline. The documents mark decisions CONFIRMED, PROPOSED, and FUTURE. Do not silently promote PROPOSED numbers or FUTURE scope to requirements. Record decisions and deviations in `docs/DECISIONS.md`.

The player's only gameplay control over the simulated society is through legislation: create, amend, suspend, reinstate, abolish and, when unlocked, prioritise decrees. Observation, investigation, navigation, saving, scenario selection and turn advancement are permitted UI actions. No direct management commands or hidden gameplay shortcuts.

## Non-negotiable engineering rules

1. Keep the simulation kernel independent of React, visual renderer, network APIs and native/mobile packaging.
2. One engine must support Junior and Full configurations with consistent shared law semantics.
3. The source of truth for a decree is a typed AST, not rendered sentence text and not free-form LLM interpretation. Validate registry capabilities and clear incompatible dropdown descendants.
4. Enactment is immediate for the next simulation turn, but awareness, acceptance, action and enforcement evolve with state. Laws change incentives, obligations, opportunities and constraints; they do not directly inject arbitrary happiness/production bonuses.
5. Use seeded, reproducible pseudorandom draws; specify RNG, numeric representation, stable iteration ordering and save schema versioning.
6. Resource transfers, consumption and production must be auditable and conserved according to explicit source/sink rules. No unexplained inventory or currency creation.
7. Keep a factual, referential event ledger. Adviser jokes, Gazette items and inquiry explanations must be grounded in recorded events; no fabricated causal claims.
8. Implement scalable entity identifiers, jurisdiction scopes, content registries and module interfaces. Do not build planetary/galactic features in the vertical slice.
9. Write automated tests with each change, including negative cases and deterministic fixtures. Never claim a test passed unless executed.
10. Preserve mobile-first touch interactions, readable narrow-screen layouts, accessible controls, interruption-safe saves and platform adapters for future Android/iOS delivery.

## Work discipline

- Start each milestone by reading the relevant task file and cited specification sections.
- Provide a short plan, exact changed files and assumptions before substantial implementation.
- Implement the smallest testable increment; do not build the entire game in one task.
- Report test commands and actual results; include manual-device tests as not-yet-run until performed.
- Do not invent approved The Nurts art. Use labelled placeholders; canonical character assets enter only after provided and approved.
- Use UK English for prose and player-facing copy.
- Update `docs/DECISIONS.md` for every material architectural, balancing or rules-semantics choice.
- If specifications conflict, identify the conflict and request a product decision rather than silently guessing.
- Use one feature branch/PR or small reviewable commit per milestone; do not automatically deploy or publish.

## Priority order

Correct, reproducible simulation > clear and auditable rules > testability > mobile usability > visual polish. Keep humour important but never permit narrative output to contradict simulation facts.
