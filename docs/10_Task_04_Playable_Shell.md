# Rulecraft — Task 04 Touch-First Playable Shell Contract

**Status:** Product-owner review proposal (documentation, not executable UI)
**Date:** 21 November 2026
**Prerequisites:** merged Task 03 PR #9 and a focused resolution of issue #10 (education versus warning evidence) before player-facing inquiry and statistics are released.
**Primary sources:** \`AGENTS.md\`; \`docs/01_Master_GDD.md\` §§2–5, 11–12; \`docs/02_Technical_Systems.md\` §§11–13; \`docs/03_Vertical_Slice.md\` §§1, 4, 8, 10–14; \`tasks/04_mobile_shell.md\`; existing v3 simulation and save codecs.

## 1. Task outcome and non-goals

**Minimum demonstration:** a person unfamiliar with the source code can open Rulecraft on a narrow phone, create a playable village, inspect a problem, compose a legal decree using only touch, understand warnings versus blockers, confirm it, advance one simulated day, see *real* results, investigate why something occurred, change/repeal the decree and resume after closing/reopening the page.

**Single source of simulation truth:** use \`startSociety\`, \`confirmLaw\`, \`advanceSociety\`, \`encodeSociety\`, \`loadSociety\`, typed registry APIs and the existing v3 event/ledger. UI derives all figures and incidents from committed state/events. No parallel “UI village”, no scripted results, no arbitrary stat-changing buttons, no direct citizen commands. Do not import React, browser APIs or visual modules into \`packages/simulation\`.

**Not a production art/content milestone:** no canonical The Nurts character assets, no bespoke illustrated village production pipeline, no fabricated adviser lines, no generative narrative, no publish/share flow, no native store release or monetisation. Use legible iconographic/diagrammatic placeholders with a clear “prototype visuals” label. The Gazette can be a **factual event digest**, not the personality-driven comic paper planned for Task 05.

**Campaign and Sandbox:** the original Task 04 brief asks for both start choices, while progression and campaign balance belong to Task 06. Build four **honestly labelled preview starts** (Junior/Full x Campaign preview/Sandbox trial) with a persisted selected profile/track. Campaign preview displays the 12-day “Hungry Village” *provisional* objective and its actual evolving metrics, but must not claim the mission is tuned, winnable or that a full campaign exists. Sandbox is a **12-day sandbox trial** using the same engine, not unlimited play past the fixture's 12-day cap. End-of-run shows a truthful comparison, with retry/new trial; Task 06 will implement finished mode/scenario content. All four combinations should start, save and resume.

## 2. Phone-first information architecture

Five essential destinations, with tap-accessible navigation and visible Back/return:
1. **Home / New game / Resume** — track and mode selection (clearly marked preview); single selected save, separate “New game will replace save” confirmation; device-storage status; ability to resume.
2. **Village** — current day/remaining days, food stored vs field reserves, access/unmet meals, timber, Treasury and general trust as separate clearly labelled quantities; occupation/individual detail list; simple labelled functional location diagram (farm, forest, market, guard route) may supplement but may *not* masquerade as physical routing or pathfinding. Key actions: open Decree Book, see recent factual events, Advance Day, investigate an actual metric/event.
3. **Decree Book** — active/suspended/abolished laws with version, exact rendered text, effective next turn/current status, known-vs-unaware aggregate, operation allowance remaining and immutable version history. Buttons for Create/Amend/Suspend/Reinstate/Abolish on eligible laws, each with proper confirmation and warnings.
4. **Decree Composer** — cascading selector → modality → executable action → optional WHEN/UNLESS predicate/operator/value as supported by the actual registry; profile-specific *exposure*, not semantics. Persistent generated sentence, stable typed \`BLOCKING\` errors vs \`WARNING\` advisory copy, source predicate units, impact/conflict evidence when available. A valid but strategically poor law stays enactable. No text-to-code, arbitrary free-text decree executor or unavailable actions (e.g. export-food) offered. Reset incompatible descendants as \`updateLawDraft\` prescribes. Explicit final confirmation before committing; show effective next day and allowance effect, then save durably before success message.
5. **Day Results / Factual Gazette / Royal Inquiry** — “Advance Day” resolves one whole day, no in-day intervention; show a compact delta summary, notable grounded events, awareness/knowledge/trust/food-access indicators with meaningful denominators, and tap-to-investigate records. Inquiry links citizen action → actual/perceived law refs and notice IDs → feasibility/choice evidence → allocation/patrol/detection events → ledger postings and relevant before/after balances. Use neutral factual templates only; no jokes implying causation absent from evidence. Education and warning must use actual \`disposition\`, not merely detection.

**Nonessential deferred:** completed Chronicle/share card, adviser personalities, elaborate village animations, campaign progression and scoring, deep population dashboards. Navigation must not expose nonfunctional controls styled as usable features.

## 3. Critical interaction and truth rules

- **Decree lifecycle:** Creating/amending/suspending/reinstating/abolishing is possible only between turns. Persist on confirmation, then take effect at next simulation turn. The composer draft is never live law. Do not silently overwrite or reactivate suspended laws. \`ABOLISH\` is terminal; require a distinct explicit irreversible confirmation (screen-reader friendly, no accidental tap).
- **Actual vs perceived:** Distinguish *operative legal status*, *learned version*, *acceptance*, *attempted behaviour*, *completed work*, *encounter and disposition*. Show “20/40 people learned” rather than “50% obeyed” if only awareness is known. Avoid a single adoption percentage.
- **Events and causes:** Any headline must point to real event IDs. Show factual “related events” if counterfactual causation is unproven. Never say “this decree caused X” solely because the events coexist; show the observed decision pressure and downstream movement.
- **Conflict warnings:** \`MUST\`/\`MUST_NOT\` and \`MAY\` precedence is unchanged; a legally effective lower-ranked grant contributing to a winning duty must not be portrayed as overridden. Show legal details only when they are applicable; use plain English and expandable detail.
- **Infeasibility and debt:** Empty fields produce no harvest; shortages, inability to pay and merchant throughput remain different; no UI option to fund citizens, spawn resources, fine them or transfer goods except through real simulation actions. A poor forester with timber but no customer remains poor; display this limitation rather than concealing it.
- **Enforcement:** use current valid law and completed patrol events; distinguish **education** of unaware citizens from **warnings** to informed citizens. Issue #10 is a prerequisite to correctly labelled risk/trust statistics and enquiry/summary copy.
- **Mode safety:** Junior and Full use one AST and one v3 simulation. Junior limits exposed clauses and reading density; Full exposes available predicates, not future unsupported mechanics. Both require a visible route to understand a rule; changing mode mid-save stays disabled until tested.
- **Playability:** Advance Day must not be enabled while a confirmation is saving or a turn is in progress. Debounce/double-action control is not enough: model idempotent commands, revision checks and durable writes. Resume must display the last fully committed world, not an in-memory result that failed to save.

## 4. Persisted world and draft architecture

Current \`apps/web/src/draft-store.ts\` is only Task 00 localStorage fixture proof, not an adequate save provider for ~2.5 MB society snapshots with growing history.

**Proposed browser design:** a \`GameSaveStore\` abstraction over **IndexedDB** using an atomic transaction for each committed save; keep a validated last-good previous checkpoint and a revision/generation number. A separate \`DraftStore\` stores uncommitted AST/selection/navigational state. All stored payloads include explicit schema/engine versions and \`encodeSociety\` checksums. Recovery calls \`loadSociety\` and only offers a valid generation; unsupported versions show a clear error instead of silently downgrading. For multi-tab use an optimistic expected-revision check in the same database transaction to prevent stale tabs overwriting newer commits. Native file/Capacitor adapter is a typed seam, not a claim that it has been implemented.

**Required failure handling and tests:**
- First load with no save; resume existing save after refresh/close.
- Confirm a law at day 0, close **before** advancing; law version persists, draft does not become an enacted law.
- A typed but unconfirmed draft restores separately or is explicitly discarded; it must never show as “enacted”.
- Simulate crash/failure during save promotion; reload previous complete generation (no half turn), with a clear recovery message.
- Simulate storage quota failure, unavailable IDB/private mode and incompatible save; UI must not claim save success. Show retry/export option only if actually implemented and safe.
- Two tabs with stale revisions must not silently overwrite each other; visible conflict and reload/choose behaviour.
- Save after the final day; “Advance” disabled at end-of-fixture.
- No raw personal data or telemetry. No cloud account/sync requirement. Backup/export can be deferred with plain disclosure.

**Performance:** benchmark actual payload size, save/write, reload/replay and turn resolution. If synchronous replay blocks UI, move expensive work behind a worker/adapter without introducing a second sim engine; record timings and confirm replay parity. Do not promise offline relaunch after browser eviction. Offline service worker/app-shell caching is an optional explicitly tested enhancement, not a prerequisite for truthful resume.

## 5. Visual and accessibility design system (proposal)

- **Style:** welcoming, expressive, playful civic-storybook feel with clear card hierarchy and modest colour accents; illustrations are generic placeholders. Avoid proprietary or unapproved canonical The Nurts assets. Minimal motion, not flat spreadsheet UI.
- **Mobile-first:** usable at 320×640 and 390×844 with safe-area padding, no horizontal scrolling of grammar or clipped confirmation controls. Adapt to 768px tablet/landscape and desktop without requiring orientation changes. Primary interactive targets ≥44 CSS px and visible focus states; never rely solely on colour, hover, gesture or drag.
- **Text:** UK English, short legible labels, meaningful error/warning differentiation, progressive disclosure of conditions and inquiry data. System text enlargement 200% should retain core workflows where practical; support prefers-reduced-motion, text resizing, screen reader labels, keyboard/focus order and back navigation.
- **Progress and interruptions:** show a blocking-but-cancellable-only-before-commit processing state when advancing; avoid arbitrary multi-second decorative animation. Respect safe areas and touch interactions. Avoid unverified “notifications sent”, “saved” or “guards warned” UI claims.
- **Legal nuance:** when the player sees a future-effective decree, label “Confirmed — effective day N”, not “already changing today's citizens”. Show a simple high-level rationale with optional evidence drill-down.

## 6. UI increments and test gates

### Increment 1 — Navigation, world read models and basic game start
- Replace Task 00 portability page with usable Home and Village screens.
- Profile/track selection for four **preview** starts, 40-citizen headless game, real data-driven summary and 12-day limit.
- Reusable formatting/adapters for world metrics, citizen cards and a simple location/category overview. No hard-coded fake results.
- Unit tests for typed read models, navigation/back handling, empty states and divergent real metrics.

### Increment 2 — Typed decree book/composer and durable confirmation
- All authoring operations through existing typed law APIs and availability warnings; legal conflict + notice visibility as applicable.
- Parent token reset, profile-specific clause exposure, warning versus blocking states, explicit destructive confirmation.
- IndexedDB \`GameSaveStore\` + independent draft store, safe revisioned save and resume. Test all critical failure/refresh/idempotence paths.
- A browser integration test must enact from the UI, close/reload, verify law persistence before Advance Day.

### Increment 3 — Day advancement, results, factual Gazette and Inquiry
- Exactly one \`advanceSociety\` per user confirmation, save checkpoint before success display.
- Results and activity derived from real event/ledger/journal records, typed enforcement dispositions and separate awareness/compliance metrics.
- Tap a recorded event to trace actual/perceived law, notice source, action choice, capacity, resource transfers, investigations, and evidence IDs. Missing information should be declared unavailable, not invented.
- Test day-1 through day-12 navigation, stale awareness after repeal, education versus warning labels, no patrol = no enforcement, no food purchase when cash is absent, factual Gazette linking and end-of-trial summary.
- Verify no automatic narrative output masquerades as Task 05 humour.

### Increment 4 — Phone-browser QA, reliability, CI and review demonstration
- Add automated browser end-to-end tests (e.g. Playwright) covering end-to-end start → enact → advance → inspect → amend/repeal → resume, invalid token reset, save failure and duplicate taps.
- Test responsive sizes 320×640, 390×844, 768+ and landscape, keyboard/screen-reader semantics where automation can cover them.
- **Physical Android Chrome and iOS Safari tests when actual devices are available**. Record device OS/browser/build, dimensions, input, visual overflow, pause/resume, save interruption, 200% zoom/large text and turn/load timings. If not available, explicitly mark *unverified*, never assume Chromium emulation establishes iOS behaviour.
- Retain GitHub Actions npm ci/test/typecheck/build checks; add browser smoke tests where CI infrastructure permits.
- Record build and reproduction commands, screenshots or short screen recording of actual app, issue/PR evidence and measured limitations; no mock data disguised as a feature.
- Baseline v1/v2 and post-issue-#10 v3 golden fixtures pass unless explicitly versioned and re-approved.

## 7. Acceptance bar

- [ ] A new user can genuinely enact, revise, suspend, reinstate and abolish a typed decree with touch-only interactions; invalid AST never commits.
- [ ] True 40-citizen v3 world updates through one and only one day per Advance action.
- [ ] All four **clearly labelled preview** combinations start and resume; Junior hides complexity without changing law meaning. Full game mode features remain Task 06.
- [ ] Confirmed operations and fully completed turns save durably with no phantom success; uncommitted drafts isolated, failures explicit and multi-tab stale overwrites guarded.
- [ ] Factual, navigable results/inquiry cite actual actor/action/decree/notice/patrol/transaction IDs; no fabricated causation or incorrect warning labels.
- [ ] Awareness, legal status, acceptance, compliance and enforcement are not conflated.
- [ ] Completed v1/v2/v3 replay, resource audit and law semantic tests remain valid; simulation stays platform-agnostic.
- [ ] No keyboard/hover/drag-only play; no 320/390 horizontal grammar overflow and tap targets ≥44px.
- [ ] Measured browser turn/save/reload latency, no misleading device/offline support claims.
- [ ] GitHub CI and browser test commands/results reported; physical mobile passes or explicitly **Not Yet Tested**.
- [ ] PR prepared for owner review. **Do not begin Task 05 automatically.**

## 8. Known technical debt and future scope

- **Task 03 follow-up issue #10 is unresolved on merged PR #9:** ensure education/warning semantics and the incorrectly labelled +45.75pp study are corrected in a small upstream PR before Task 04 exposes enforcement counters or “risk from warnings” claims. This may update v3 goldens. Do not block *design* work on it, but do not ship misinformation.
- Campaign tuning, full Sandbox duration, adviser personalities/Gazette comedy and Chronicle/share cards remain Tasks 05/06.
- Unfunded timber work and poor foresters need a separate economic-loop decision; no silent subsidy.
- Save size increases with full history; measure IDB quota/load in browser and plan a later bounded-history design.
- Provisional mobile runtime/Capacitor route, real-device QA, accessibility testing with children and release governance remain separate workstreams.
