# Rulecraft - Codex Development Starter

Rulecraft is a mobile-first, standalone game in which the player governs an autonomous, whimsical society only by creating, modifying, suspending, reinstating and abolishing decrees. The game should be funny, fair, systemic, and explainable.

This repository currently contains **design/specification and Codex operating files only**. It is **not a playable game**. Ask Codex to perform `tasks/00_architecture_spike.md` first, then move through `ROADMAP.md` one checkpoint at a time.

## Sources of truth

- `docs/01_Master_GDD.md` - player experience, scope, modes, character roles, humour.
- `docs/02_Technical_Systems.md` - typed rule language, simulation, behavioural models, deterministic replays, persistence.
- `docs/03_Vertical_Slice.md` - first village fixtures, scope, acceptance cases and implementation gates.
- `AGENTS.md` - instructions Codex should follow whenever working in this repository.
- `docs/DECISIONS.md` - signed-off technical decisions and unresolved items.
- `ROADMAP.md` - phased implementation strategy.

## First use

1. Create a **private** GitHub repository, for example `rulecraft`.
2. Unzip this package and commit its **contents** at the repository root (not the zip file).
3. Connect the repository to Codex Cloud, or open it with Codex locally.
4. Start with `START_HERE_PROMPT.md`, asking for a design/spec audit and platform spike; do not author the entire game yet.
5. Review and approve the recommended stack and architecture decisions; then implement one milestone at a time.

## Possible technology direction (not yet signed off)

TypeScript + a renderer-independent headless simulation core, React/Vite for the mobile-first UI, Vitest for tests, and an evaluated Capacitor path to Android/iOS. This is a hypothesis to be validated via a mobile/web spike, not an immutable dependency choice. Consider Godot if the actual gameplay/visual needs make a game-engine route superior.

## Boundaries

No direct player management, no AI-interpreted arbitrary laws, no multiplayer, no permanent backend dependency, no unapproved canonical art, and no implementation of world/galactic expansion in the first slice.
