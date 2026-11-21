# Task 00 - Architecture audit, decision record and mobile feasibility spike

## Goal

Prepare the implementation foundation without prematurely building the entire game. Resolve the critical technology questions in `docs/02_Technical_Systems.md` and preserve all confirmed product requirements.

## Work

1. Read all 3 specs in `docs/` plus `AGENTS.md` and `docs/DECISIONS.md`. Build a concise conflict/ambiguity report; separate clear defects from merely provisional balancing parameters.
2. Recommend a stack with trade-offs for smartphone-first touch UI, graphical 2D village, offline play, deterministic TypeScript simulation, initial web hosting, later Android/iOS packaging, and Codex-assisted development.
3. Prefer evaluating a pure TypeScript simulation core + React/Vite UI + Capacitor portability route; compare with Godot as an alternative. No full-fledged 3D engine is required by the current GDD.
4. Propose module boundaries and folder structure. Keep simulation free of React, browser globals and native APIs.
5. Build only the minimum executable scaffold necessary to demonstrate: automated tests running; web app loading at phone viewport; simulation package callable from tests without UI; draft save adapter boundaries; minimal CI recommendation.
6. If feasible in the current environment, build a small native portability spike (or document exactly what would be required to run it on Android and iOS). Do not claim native readiness without actual builds and device tests.
7. Update `docs/DECISIONS.md` with proposed sign-offs, and show the product owner the trade-offs before proceeding to Milestone 01.

## Acceptance

- Clean dependency installation and runnable project with exact commands in `README.md`.
- Automated smoke test passes and output is shown.
- No direct gameplay management controls or fake economy added.
- Written architecture diagram and explicit dependencies.
- Mobile layout at a narrow screen shown/verified where environment supports browser checks.
- Android/iOS portability route identified with constraints and unresolved device tests.
- Next task split into small, independently testable commits.

## Stop boundary

Do not implement the full village, rule editor, or humour engine in this task. Ask for review of the architecture recommendation and unresolved no-go decisions.
