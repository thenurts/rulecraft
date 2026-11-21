# Rulecraft — Task 02 Decree Engine Semantic Contract

**Version:** 1.0 candidate implementation baseline  
**Date:** 21 November 2026  
**Authority:** Product-owner confirmation of the six governing principles; precise edge-case policies below are **PROPOSED v1 implementations**, to be assessed through the Task 02 pull request.  
**Related:** `docs/01_Master_GDD.md`, `docs/02_Technical_Systems.md`, `docs/03_Vertical_Slice.md`, `tasks/02_rule_engine.md`, Task 01 kernel.

## 1. Scope and mandatory separation

Task 02 adds a typed law authoring/evaluation subsystem and enough integration for laws to influence **autonomous action choice**. It does not deliver a complete decree UI, stochastic awareness diffusion, acceptance/peer networks, working guard sanctions, diplomacy, new economic markets or full campaign balancing. Those belong to later milestones.

There must be three separate views of a decree:
- **Authoritative law:** what is legally operative for this subject, action, place and slot now; used for official legal determinations.
- **Perceived law:** the citizen's most recently learned version, including potentially outdated or repealed provisions; used for their legal expectations/action scoring.
- **Recorded outcome:** what the citizen attempted and actually accomplished under available stock, time, money and capacity, with a factual provenance chain.

Do not make the current authoritative rule identical to a citizen's beliefs. Do not convert legal text directly into state-wide happiness, production, trust or coin changes.

## 2. Typed AST, vocabulary and capability registry

An immutable law version should include stable `lawId`, `version`, `issuerId`, `jurisdictionId`, `targetSelector`, `modality` (`MUST`/`MUST_NOT`/`MAY`), `actionId`, typed optional `when` and `unless` clauses, `priority`, `confirmedAtTurn`, `effectiveFromTurn`, status and authoring/history metadata. Distinguish a status-changing legal version from the original immutable wording. The AST is authoritative; rendered sentences are projections.

**Registry entries** specify stable action IDs, eligible actors, required world capabilities, target/quantity types, licence requirements, default legal availability, registered predicate operands/units, and a deterministic evaluator. The editor's available-next-token API derives from this registry. Changing a parent token clears incompatible descendants; server/kernel validation rechecks the completed AST. A dynamically valid but harmful law must remain enactable; a syntactically or semantically unimplementable law must be blocked with a stable error code.

**Available kernel actions for Task 02:** harvest food (farmers), cut timber (foresters), market delivery (merchants), patrol (guards), rest (all citizens). The engine may expose a future export-food registry definition internally for evaluating permission/licence semantics, but **must not expose it as an enactable player decree** until an actual bounded export action and accounting contract exist. Never pretend exports happened. `All citizens must rest` is valid; `All citizens must harvest` is invalid without a capability-aware subset selector.

**Available predicate families:** slot/time (morning/afternoon), a well-defined accessible `marketFood` stock, finite `fieldFood` and `forestTimber` stock, citizen fatigue, and Treasury coin balance. Predicate targets, operators and units must be explicit; don't expose `village food` without defining what stock it aggregates. Evaluate `WHEN` and `UNLESS` against the immutable **slot-opening snapshot**; `UNLESS` cancels applicability if true. Between slots a changed world can change applicability, but no rule can retroactively alter a completed action. Unsupported predicates are unavailable, not a vague promise.

**Difficulty:** one engine and identical semantics in both Junior/Full. A small explicit vocabulary/profile API can exist here; visual onboarding/unlocking and the full mode UX remain later. Priority defaults to 0 and is not presented as a new player-facing control until explicitly unlocked.

## 3. Enactment and immutable lifecycle — CONFIRMED direction

A player confirms an operation **between** fully resolved turns. Confirmation durably records an idempotent legal command and immutable version in the committed save. It is `effectiveFromTurn = committedWorld.turn + 1` and is legally operative from the first slot of that following turn. A draft never changes the legal record, and a confirmed operation must survive a crash before the player advances.

Permitted commands: `CREATE`, `AMEND`, `SUSPEND`, `REINSTATE`, `ABOLISH`; each increments the law version (or creates version 1). A repeat with the same command ID is idempotent; conflicting reuse must be rejected. Maintain complete historical versions, command events and relevant older citizen beliefs. `SUSPEND` temporarily ceases current legal application; `REINSTATE` creates a new effective version; `ABOLISH` is terminal for that law ID (a similar new law requires a new ID). No silent mutation of an old version.

Legal scope is effective **on and after** the recorded turn for all eligible subjects/slots unless a later applicable status/version supersedes it. The lawbook may label a confirmed between-turn change `enacted — effective next turn` rather than misleadingly describing it as already affecting completed slots. The **two changes/turn** allowance remains a configurable proposed balance number, not an irreversible hard-coded law cap.

Use the Task 01 snapshot checkpoint pattern, with a separate durable write for a confirmed between-turn law operation and a committed fully resolved turn. Never partially commit law versions, resource accounts, events or a turn. Preserve an independent local draft adapter. Version saves for law-aware schemas; old Task 01 snapshots must either remain supported or be rejected/migrated explicitly with tests. No silent change to old saves or reuse of version identifiers for changed semantics.

## 4. Actual vs perceived law — CONFIRMED direction

- Current authoritative legality uses the latest legally effective, jurisdictionally relevant, applicable law **regardless of awareness**.
- Each citizen records `knownLawVersion[lawId]` (or an explicit notice of repeal/abolition). Their perceived state can remain older than authoritative state after an amendment, suspension or repeal.
- A citizen unaware of an enacted law cannot have its perceived legal pressure magically applied. A citizen following stale law may act differently, even though current enforcement must ignore the obsolete provision.
- At this milestone, use **deterministic notice injection/test fixtures or a narrow notification interface** to test knowledge changes. Rich awareness dissemination, acceptance, peer influence and probabilistic spread belong to Task 03. Do not introduce an omniscient automatic sync to every citizen merely to make tests pass.
- Historical versions and notices must be saved, replayed and causally referenced. Current law and perceived knowledge have separate tests.

## 5. Conflict, permission and licence truth table — PROPOSED precise v1

**Applicability filtering:** issuer authority and valid jurisdiction; actor selector and capability; effective turn and current status; `WHEN` true and `UNLESS` false on the same immutable slot snapshot. Distinct conditions can change which laws compete. In this village slice only one council authority is operational, but keep jurisdiction/authority interfaces without pretending that multi-level government exists.

**Same-action precedence:** among applicable rules addressing one actor/action/slot, compare (1) valid superior authority, (2) explicit numerical priority, (3) modality at an otherwise exact tie: `MUST_NOT` > `MUST` > `MAY`, then (4) stable law ID/version for attribution only. The chosen rule and overridden IDs must be available for explanation. Two `MUST` duties addressing different actions are **not** eliminated against one another; citizens can face genuine time conflicts and attempts must still obey action-slot/physical constraints.

| Competing rules for the same actor/action/slot | PROPOSED result |
|---|---|
| No applicable decree, default-open action | Lawful and optional |
| One `MUST` | Required normative duty; does not execute itself |
| One `MUST_NOT` | Prohibited; not a magical physical barrier |
| One `MAY` | Permitted but optional; does not automatically raise work utility |
| Equal-authority/priority `MUST` + `MUST_NOT` | `MUST_NOT` wins; visible warning and causal resolution |
| Equal-authority/priority `MAY` + `MUST_NOT` | `MUST_NOT` wins |
| Equal-authority/priority `MAY` + `MUST` | `MUST` wins |
| Higher-priority `MAY` + lower-priority `MUST_NOT` | `MAY` wins: optional permission |
| Higher-priority `MUST` + lower-priority `MUST_NOT` | `MUST` wins: required duty |
| Higher-priority `MAY` + lower-priority `MUST` | `MAY` wins: duty no longer imposed by that contest |
| One citizen has two applicable `MUST` actions | Both duties remain; scheduling, feasibility and choice determine what happens; no automatic success |
| Current law repealed, citizen remembers old `MUST_NOT` | Officially lawful unless another actual prohibition; citizen may still avoid it |
| Citizen unaware of current `MUST_NOT` | Actual legal prohibition applies; no fictional perceived deterrence; enforcement is deferred |
| `MAY` on an ordinary already permitted action | Legally optional, generally no new behavioural change; preview should warn of redundancy |

**Licence-gated actions:** an action registered as `licenceRequired` (future export) is legally unlicensed unless an applicable, effective `MAY` provides the required licence/permission; an applicable winning `MUST_NOT` can still prohibit it. A `MUST` **does not create its own missing licence**: this produces a visible infeasible/contradictory duty, not a hidden free licence. Actual legal status and physical ability are distinct: `MUST_NOT` and lack of licence deter lawful action selection but do not annihilate real-world physical possibility. Enforcement of illegal attempts requires future institutional resources.

This precedence and licence matrix is a transparent *candidate implementation* of the user's confirmed principles. If Codex finds a logical counterexample, add a failing table-driven test, propose an explicit design amendment, and flag it for product-owner review rather than quietly alter the rules.

## 6. Behavioural integration and explanatory evidence

- Laws influence the citizen action-selection process through typed pressure/permission/constraint evidence. For a known `MUST`, increase the relative utility of that feasible action; for a known `MUST_NOT`, impose deterrence without forcing impossible physical compliance; `MAY` does not positively compel the action.
- Keep weights configurable and provisional. Test effects over **matched seeds** with controlled knowledge rather than demanding one fixed response from one citizen.
- The executor still rechecks stock/capacity/money. A known duty can be unfulfilled because it was impossible, blocked by contention or not chosen; report these separately. Never label being unable to act as intentional disobedience.
- Extend the event schema with structured legal-decision evidence: actual law refs/versions, perceived law refs/versions, applicability predicates, conflict winner/overrides and choice-pressure provenance as appropriate. Attribution reports must not invent causal certainty.
- **No passive sanctions in this slice.** Do not allow a prohibition or a licence condition to mint fines, spawn guards, magically block resources or impose blanket trust penalties.

## 7. Milestone increments and gates

1. **Typed grammar and registry:** AST parser/validator, capability and predicate registry, valid-next-token/clear-child API, deterministic English rendering. Table-driven positive and negative tests, no unavailable selectable actions.
2. **Lifecycle and legal resolution:** committed between-turn enactment and idempotent commands; immutable version/status history; actual/perceived law data; applicability, conditions/exceptions, authority/priority/licence tables; save/replay tests.
3. **Citizen-choice integration and audit:** controlled notification fixtures, typed law pressure into the existing action-choice system, factual provenance, matched-seed law/no-law comparison, refactor regression and full build/tests.

**Acceptance checklist**
- [ ] Baseline rule-free economy and accounting remain correct; no unexplained resource or coin creation.
- [ ] Current-authority and stale-knowledge outcomes diverge correctly.
- [ ] Repeal/suspend stops actual legal effect at the scheduled turn, but stale beliefs can persist; no enforcement of repealed law.
- [ ] All modality/conflict/licence table rows have tests; warnings do not block legal-but-poor laws.
- [ ] Cross-slot frozen condition semantics tested, including changing threshold between morning and afternoon.
- [ ] Amend, suspend, reinstate, abolish, idempotent resubmission and crash-before-advance persistence tested.
- [ ] Incompatible selector/action dropdown descendants reset; unsupported action/condition is a blocking validation error.
- [ ] One engine and identical rule meanings for Junior/Full.
- [ ] No current-law effects applied to citizens that lack knowledge in their choice model.
- [ ] Known obligations/prohibitions shift the distribution of chosen actions in the expected direction on matched seed sets; effect sizes documented.
- [ ] New and old versioned snapshots have explicit compatibility behaviour; Node/browser golden replay as feasible.
- [ ] `npm ci`, `npm test`, `npm run build` executed and reported; PR documents all changes/deviations.
- [ ] Does **not** introduce a full visual composer, fictional Gazette incidents, taxation, export economy or guard sanction system.
- [ ] Task 02 PR stops for owner review; **do not start Task 03 automatically**.

## 8. Follow-ups explicitly not blocking Task 02

- Replace fixed actor-order scarcity allocation with a deterministic fair policy **before welfare playtests**; track as an engineering follow-up. Keep existing resource audit contract intact.
- Define actual timber buyer/income and food accessibility changes before Hungry Village balancing; do not pass off the 12-day fixture as a calibrated mission.
- Move price/wage validation into extended registered ledger invariants before taxes, dynamic prices or new market actions are enacted.
- Profile full-history checkpoints and migrate to scalable storage before longer campaigns.
- Native Android/iOS browser, persistence and performance testing stays open.
