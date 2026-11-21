# RULECRAFT
## Technical Systems Specification

**Version:** 0.6 | **Status:** Candidate implementation specification | **Date:** 21 November 2026  
**Related:** Master Game Design Document v0.6; Vertical Slice Build & Acceptance Specification v0.6

> **Interpretation:** The architecture and semantic invariants are intended as implementation contracts. All numerical coefficients, balance parameters, content quantities and stack preferences marked **PROPOSED** require automated calibration and playtesting. A final engineering owner must select the runtime/stack before coding starts.

# 1. Architecture and boundaries

A headless deterministic simulation kernel accepts a world state, validated decree operations and a turn-advance command; it returns a new world state plus an append-only structured event batch. UI and narrative code cannot mutate simulation state directly.

**Subsystems**
1. **Content Registry:** resources, actor types, traits, action definitions, predicates, legal modalities, jurisdictions, event types and modes.
2. **Law Compiler & Validator:** dynamic token availability, typed AST, syntactic and semantic validation, versioning and conflict warnings.
3. **Law Evaluator:** effective laws by target, jurisdiction, awareness and conditions; permission/restriction resolution.
4. **Agent/Institution Decision Engine:** feasible actions, estimated utility, probabilistic choice, actual compliance and practical barriers.
5. **Turn Scheduler:** fixed phases, action slots, capacity contention, deterministic event ordering.
6. **Economy/Environment Modules:** inventories, production, transfers, consumption, fatigue, health, trust, resource regeneration.
7. **Event & Causality Ledger:** factual event records with actor, input state, effects, decree references, source events.
8. **Narrative Renderer:** fact-bound Royal Gazette, four advisers, reactions, Royal Inquiry, share card.
9. **Persistence & Versioning:** snapshots, law versions, RNG seed and engine/content schema versions.

**Design constraint:** A module may expose typed commands and return typed effects; it must not secretly write to other modules' state. Effect resolution is central and ledgered.

## Mobile-first and native-port architecture contract

**Confirmed product requirement:** smartphone-first gameplay with planned future distribution as Android and iOS applications; a web-hosted build may be the first playable delivery. Do not treat desktop layout, mouse/hover interaction or browser-specific storage as foundational dependencies.

- **Platform-independent core:** rule AST, law evaluation, turn scheduler, agent logic, economy, event ledger, save encoding and seed/RNG semantics must run behind stable interfaces without DOM or device-service dependencies.
- **Presentation adapters:** touch/navigation, viewport and safe-area handling, asset loading, font scaling, animation and accessibility are UI-platform concerns; preserve a single mobile-oriented interaction design and offer adaptive desktop layout only as a secondary presentation.
- **Device-service adapters:** define interfaces for persistent saves, local export/share, application lifecycle (foreground/background/interruption), optional notifications and offline asset cache. Native adapters can be implemented later without changing the simulation contract.
- **State continuity:** commit turn resolution atomically. On app suspension/crash or browser tab closure, restore either the previous committed turn or the new committed turn; never partially update resources or decree histories. Persist in-progress decree drafts separately from enacted legislation.
- **Cross-platform replay:** pin integer/fixed-point numerical rules where practical, version the pseudorandom algorithm, avoid unordered iteration and record compatibility versions so web and mobile builds yield equivalent simulation results. Validate with cross-runtime golden fixtures.
- **Runtime decision — OPEN:** compare portable game engine, web-first hybrid packaging and other viable solutions against mobile touch fidelity, browser delivery, native app-store feasibility, package size, offline saves, renderer performance, tooling maturity and team skills. Commit after a device spike, not solely because a browser proof of concept is convenient.

# 2. Canonical model and identifiers

Use stable IDs, never presentation names, as references. A top-level save includes `schemaVersion`, `engineVersion`, `contentVersion`, `modeProfileId`, `worldSeed`, `turn`, `worldGraph`, `agents`, `institutions`, `accounts`, `lawVersions`, `activeLawPointers`, `eventLog`, `rngStateOrKey`, `scenarioState`.

**Core entities**

| Entity | Minimal fields | Extensibility |
|---|---|---|
| Actor | id, type, location, capabilities, group tags | Citizen, cohort, institution, future species or vessel |
| Citizen | occupation, fatigue, hunger, trust, wealth account, traits, knowledge, known law versions | Household, faction, relationships, culture later |
| Cohort | count, distributions, location, capabilities, accounts | Population aggregation later; not used in first playable |
| Location | id, type, parent/spatial edges, production capacity | Districts, planets and trade routes later |
| Polity/Jurisdiction | authority, scope, precedence, legal powers | City councils, provinces, federation later |
| Resource account | owner, location, resource type, integer quantity | Any new resource through registry |
| Decree version | immutable AST + metadata/status | Version chain, enforcement, historical provenance |
| Institution | staff assignment, resources, capabilities, policy preferences | Treasury, Guard, trade office, future foreign ministries |
| Event | type, time, source(s), actor(s), decree ref(s), deltas, confidence/visibility | Royal Inquiry and narrative hooks |

**Quantities:** Integer quantities for stocks/currency, or fixed-point integer subunits when fractional production is required. No floating-point coin balances. Preserve conservation through explicit `produce`, `consume`, `transfer`, `tax`, `wage` and `loss` transactions; creation and destruction must identify the source/sink mechanism.

**Namespaces:** `core.actor.citizen`, `resource.food`, `action.harvest_food`, `predicate.stock_below`, etc. No scenario-specific string matching in the interpreter.

# 3. Registry-driven action and predicate contracts

Every registered action must declare its capabilities, required inputs, affected accounts, duration, preconditions, costs, production outputs, possible legal targets, narrative hooks and effect provenance.

Example action contract (**PROPOSED**):

```json
{
  "id": "action.harvest_food",
  "performers": ["occupation.farmer"],
  "locationTypes": ["location.field"],
  "durationSlots": 1,
  "inputs": [],
  "outputs": [{"resource": "resource.food", "source": "field.yield"}],
  "requires": ["field.harvestable_stock > 0"],
  "effectTags": ["labour", "food_production", "fatigue"]
}
```

**Design rule:** UI dropdown options are populated from the registry and constrained by the previously selected tokens. They must not duplicate business logic. If an expansion adds an action, it must register a schema, evaluator and tests before appearing in the composer.

**Predicates** are pure typed functions against an explicit state snapshot: `stock(resource, location) < quantity`, `citizen.fatigue >= threshold`, `season == winter`, `jurisdiction.includes(location)` etc. Predicate configuration must state allowed subject and object types and unit scales.

# 4. Typed decree AST, compilation and lifecycle

**Example canonical law:**

```json
{
  "lawId": "law_17",
  "version": 2,
  "issuer": "polity.village_council",
  "scope": {"jurisdictionId": "jurisdiction.village"},
  "target": {"occupation": "occupation.farmer"},
  "modality": "MUST",
  "action": {"id": "action.harvest_food"},
  "condition": {"op": "LT", "lhs": "village.food_store", "rhs": 80},
  "exception": {"op": "GTE", "lhs": "citizen.fatigue", "rhs": 80},
  "priority": 3,
  "effectiveFromTurn": 4,
  "status": "ACTIVE"
}
```

**Static validation:** recognized tokens, subject-action capability, compatible resource/location, valid comparison types and units, allowed nesting depth, permission-gated action rules, juristic authority and licence scope. Never accept generic free text as executable code.

**Dynamic validation:** warnings about collisions, infeasibility given current world state, duplicate rules and predicted resource constraints. Such warnings must not ban valid but bad policy. Report `BLOCKING` vs `WARNING` with stable codes.

**Lifecycle:** Create/Amend/Suspend/Reinstate/Abolish between turns only; emit immutable version and history event. A changed law is legally effective at the next simulation step; awareness is tracked per citizen *per law version*. Repeal stops official enforcement immediately but outdated citizen beliefs can persist until they learn of the repeal. Enforcement never punishes an action on the sole basis of a repealed law.

**Operations allowance — PROPOSED:** two per turn, shared across create/amend/suspend/reinstate/abolish. No authored gameplay ceiling on active laws. Runtime safeguards should detect performance degradation and report it rather than silently ignore applicable laws.

# 5. Law semantics and conflict resolution

**MUST:** adds normative pressure toward a feasible action; may impose legal violation risk when opportunity exists and the agent chooses not to comply. Does not directly execute the action. **MUST_NOT:** adds legal deterrence and potential penalties for a prohibited action; does not physically prevent it unless a specific institution/gate can prevent it. **MAY:** grants/clarifies legal permission, including overriding a conflicting restriction if precedence permits; not a positive instruction. Default permissions and licensed actions are explicit in the action registry.

**Applicability stages:** (1) authority and jurisdiction; (2) target match; (3) status/effective time; (4) condition and exception against slot snapshot; (5) actor awareness for *perceived* legal influence; (6) actual current legal status for enforcement. Do not confuse perceived law with enforceable law.

**Conflict rules — PROPOSED v0:**
- Known opposite modalities concerning the same action, subject, period and jurisdiction generate a composer warning.
- When effective rules conflict, stronger jurisdictional authority prevails where legally empowered; otherwise higher explicit numeric `priority` prevails.
- At equal authority and priority, `MUST_NOT` outranks `MUST` for the *same action*; a qualifying `MAY` does not override an equal-priority prohibition, but a higher-priority `MAY` can. Log the decision.
- Distinct simultaneous MUST actions remain competing duties (not logical contradictions). Citizens have limited action slots; the choice model ranks feasible options and logs unmet obligations. A lawful agent may be unable to satisfy both.
- Exact ties resolve by stable law ID, never run-order. Formal laws and enforcement outcomes use actual current law versions; citizen behaviour may reflect stale awareness.

**Avoid policy exploits created by implementation order:** conditions evaluate against immutable snapshots at the start of each action slot. A stock threshold crossed in the morning can change afternoon applicability, but cannot retroactively alter decisions already made.

# 6. Daily simulation ordering

**Time model — PROPOSED:** one day per turn with two daytime action slots (morning, afternoon) and a dusk maintenance/recovery phase. “When awake” means both daytime slots. Single-slot actions can be chosen by citizens; some future activities can span multiple slots.

**Turn algorithm:**
1. Commit the player's pending legislative operations; validate versions and budgets; write `law.enacted` events.
2. Advance day; apply external conditions, seasonal modifiers and scheduled changes.
3. Spread news of law versions using awareness probabilities; update known-law memory and attitude where applicable.
4. For each action slot: freeze read snapshot; resolve applicable actual/perceived rules; generate feasible actions and utility scores; draw action choices from keyed seeded RNG; allocate constrained jobs/locations/routes; execute actions; resolve voluntary trade and enforcement; apply logged deltas.
5. At dusk: settle wages, tax and consumption; apply sleep recovery, unmet-needs penalties, trust updates and environmental regeneration; record state metrics.
6. Evaluate scenario objectives and incident candidates; generate factual Gazette/Inquiry evidence; persist snapshot and checksum.

**Keyed randomness:** Draws based on `(worldSeed, turn, slot, actorId, subsystem, drawIndex)` rather than one global mutable sequence. Sorting and deterministic tie-breaks make replays robust to processing order changes. Implement and test one specified PRNG; random outcomes are consistent within a versioned engine and content set.

**Implementation note:** an integer/fixed-point scoring model with a documented weighted-choice distribution is recommended over unqualified floating-point softmax if cross-runtime identical replay is required.

# 7. Awareness, acceptance, compliance and enforcement

**Separate metrics:** legal status; known version; acceptance (`-100..100`); attempted compliance; successful compliance; willful violation; feasibility failure; detection; enforcement disposition; realised consequences.

**Awareness model — PROPOSED prototype calibration:** Each unknown citizen-law version gets at most one notification draw/day:

`P(learn) = clamp(0.05 + 0.30*communicationReach + 0.20*awarePeerShare + 0.20*institutionalReach, 0, 0.90)`

Inputs are normalised `[0,1]`; different location, networks and institutions yield different reach. Values are starting coefficients, not empirical estimates. A citizen becomes aware of a revision rather than automatically inheriting awareness of all subsequent versions.

**Acceptance:** a bounded attitude towards a specific law. Initialise from trust, expected personal costs/benefits and disposition; update gradually from experienced outcomes, peers and enforcement fairness. Do not equate acceptance with actual compliance.

**Action scoring — PROPOSED prototype model:** For each feasible action, construct utility components on a fixed integer scale: immediate needs, expected income/benefit, preferences, fatigue/time cost, social influence and perceived law influence. Weights are configurable per mode/scenario but *meaning* of an action is shared. A higher score increases selection probability; it does not guarantee an action.

`score(a) = need(a) + benefit(a) + disposition(a) - cost(a) + social(a) + legalPressure(a)`

Example perceived MUST pressure: `6 + round(0.12*trust) + round(0.08*max(acceptance, 0)) + round(16*expectedDetection)`; perceived MUST_NOT applies a corresponding negative pressure plus expected penalties. These coefficients are placeholders requiring empirical tuning.

**Stochastic choice:** sort feasible actions by stable ID; compute non-negative integer weights from bounded score differences and temperature (e.g. lookup-based exponential approximation); select once per citizen/slot with keyed random draw. Record selected action, candidate scores, law pressure and random stream metadata in debug mode. Behaviour must respect physical feasibility and action capacity *after* intended-choice generation.

**Compliance classification:** Only mark non-compliance when a relevant obligation was known and feasible within available opportunities yet the citizen chose a conflicting action. Classify ignorance, impossible execution and institutional blocking separately. Compliance reports must use clear denominators (e.g. opportunities where action was feasible, rather than all citizens in target occupation).

**Guard capacity — PROPOSED:** A guard who chooses patrol contributes enforcement capacity during that slot. Actual enforcement attempts are constrained by number of active guards, location, available time, encounter/detection probability and competing orders. A prohibition is not automatically enforced against every violator. Enforcement can produce warnings or small fines initially; avoid harsh sanctions for Junior Mode.

**Trust:** shared general trust in government `[0,100]`, updated by experienced services, coercion, unmet expectations and perceived fairness. Trust is not changed just because a decree label is “strict”; changes need underlying events. Future model may add trust by institution/faction.

# 8. Economy, needs, physical constraints

**Resource invariants:** `post = pre + production + imports + incoming transfers - consumption - exports - outgoing transfers - losses`, by resource and account; no negative stocks; money transferred, not created, except explicitly registered money-creation mechanics (not vertical slice). All transactions use stable IDs and reference source events.

**Proposed slice resources:** food, timber, coin. Farmers produce food from field capacity and their labour; foresters produce timber from limited/regenerating forest stock; merchants perform bounded collection/trade/distribution; guards patrol and may be paid from treasury; citizens consume food and recover fatigue.

**Needs:** hunger increases if sufficient food cannot be bought/accessed; fatigue increases with work/guard duties and decreases with rest and overnight recovery. Individual ability modifies labour output. Work that is attempted but blocked by missing crop/stock/resources must produce a visible feasibility event, not secretly succeed.

**Markets — PROPOSED simplified slice:** local market accounts track food and coin, buy from producers and resell to residents within merchant capacity. Price can be fixed in Junior and configurable scarcity-sensitive in Full, but transaction, ownership and transfer semantics remain identical. Foreign trade can be a simple external bounded counterparty rather than a fully simulated kingdom.

**Price model — PROPOSED if used:** `nextPrice = clamp(basePrice * scarcityMultiplier, floor, ceiling)`; smooth integer prices and avoid zero or negative values. Separate purchasing-power constraints and unmet demand. Do not claim sophisticated economic realism from this deliberately simplified model.

**Forestry:** harvesting reduces forest stock, which regenerates according to a capped rule; no infinite timber by repeatedly selecting work. **Time:** one action per citizen per slot; physical capacity and location paths limit throughput. **Institutions:** wages, patrols, dissemination and public purchases consume resources or work capacity.

# 9. Multi-scale population and future growth

**Three representation levels:** detailed individual agents, attribute-preserving cohorts, regional aggregates. Only detailed individuals are required for MVP. `PopulationLedger` must include stable totals and typed distributions sufficient to later partition by traits required by active laws.

**Future cohort transition:** aggregate only when all law-relevant dimensions can be preserved or reconstructed with bounded approximation. Keep important named citizens persistent. When expanding an aggregate for inspection, sample individuals from a versioned distribution with deterministic keys; on reconciliation, apply net changes without duplicating or destroying resources or citizens. Record approximation bounds in debug reports.

**World topology:** separate physical location graph, political authority graph and jurisdiction predicates. A rule may target a species, job or guild across multiple territories. Do not embed an assumption that one location has exactly one legal authority.

**Expansion gates:** new module supplies schemas, registry entries, simulators, save migration, UI definitions, narrative mappings and regression tests. “Galactic empire” is a design-capacity goal, not an MVP acceptance target.

# 10. Events, causal tracing and narrative truth

**Every material change must carry provenance.** A production event references performer, job, field, fatigue, resource deltas and contributing law-version IDs. A later shortage event references observed stock change, consumption and contributing production/transfer events. Distinguish directly observed cause, multiple contributing factors and inferred correlations.

**Sample structured event:**

```json
{
  "eventId": "event_0412",
  "turn": 7,
  "slot": "afternoon",
  "type": "work.harvest_failed",
  "actorId": "citizen_12",
  "locationId": "field_01",
  "reasonCodes": ["FATIGUE_HIGH", "CAPACITY_EXHAUSTED"],
  "lawVersionRefs": ["law_17:v2"],
  "delta": {"resource.food": 0},
  "sourceEventIds": ["event_0409"]
}
```

**Royal Inquiry:** returns ordered factual factors, source event IDs, affected population, relevant rule versions and confidence when applicable. Do not label a single law the unique cause if several forces contributed. The UI should make the causal chain understandable without exposing raw debug fields.

**Narrative contract:** Adviser/Headline templates require typed factual input; template constraints validate supported facts. No random fabricated shortages, protests, profitability or motives. Comedy may embellish expression, not invent an unmodelled causal event. Distinct cooldowns prevent duplicate headlines/dialogue.

**Incident share card:** includes actual decree text, verified event summary, one attributable adviser quote and optional anonymised metrics. Never include children's real names, contact details, or hidden profile data.

# 11. Two mode profiles

Profiles are data, versioned and validated independently of saves. Example keys: `visibleActions`, `visiblePredicateTypes`, `maxComposerConditionDepth`, `scenarioSet`, `enabledModules`, `hintLevel`, `feedbackDensity`, `startingCitizenCount`, `economicParameters`, `dialogueAgeBand`, `turnAllowance`.

**Invariant:** In shared worlds with the same configuration values, a given law has the same meaning across modes. Junior is permitted to change exposure, scenario conditions and tuned parameters, but not silently reinterpret the law text. If a module is disabled, unsupported predicates must disappear from menus and loaded saves must not be silently downgraded.

**Suggested defaults — PROPOSED:** Junior starts with one condition or exception and explicit explanations; Full has both plus policy prioritisation earlier. Both versions include campaign and sandbox entry points, with mode-specific presets and starting worlds. Current builds should reject mid-save mode changes until migration semantics are designed and tested.

# 12. API and component boundaries

**Illustrative headless interfaces:**

```text
registry.listValidNextTokens(partialAst, worldContext, modeProfile) -> TokenOption[]
validateDecree(ast, worldSnapshot, authority) -> ErrorsAndWarnings
previewDecree(ast, worldSnapshot) -> ImpactedTargetsAndConstraints
applyLegislation(world, changeSet) -> NewLawVersionsAndEvents
advanceTurn(world, worldSeed) -> { world, factualEvents, checksum }
getInquiry(eventId, eventLedger) -> CausalGraph
renderGazette(factualEvents, narrativeRegistry, modeProfile) -> NarrativeCards
serializeSave(world) / loadSave(savedData, schemaVersion) -> World
```

The UI may propose operations, but only the simulation command layer applies them. Commands are idempotent by request ID to prevent duplicate enactments after network retries.

# 13. Persistence, performance, security

**Persistence:** atomic snapshot per completed turn; prior checkpoint; event log compression or bounded retention with long-lived incident summary; migration scripts for schema changes; checksums for replay. At minimum keep all decree versions and notable causal event summaries.

**Performance objective — PROPOSED benchmark for MVP:** 40 citizens, <=25 active decrees, 2 action slots/day, 30 turns, representative mid-range Android browser: median turn simulation <150ms and p95 <500ms on target test device; no UI lock >1 second. These are provisional engineering targets to measure, not claims of achieved performance. Larger worlds require new benchmarks once aggregation is built.

**Correctness tests:** seeded replay byte-equivalent logical snapshot; no negative inventory; no asset duplication on import/export; every applied law has valid scope and actor capability; no enforcement of repealed law; consistent legal precedence; no invalid action from a dropdown; Junior/Full engine parity for identical shared state and configuration.

**Safety/privacy:** never execute player text as code; content modules must be validated; use local-first data without personal information; no open chat or social accounts for children in MVP; comply with relevant age/privacy requirements before commercial release.

# 14. Reference algorithm and pseudo-code

```text
function advanceTurn(world, operations, seed):
  require(world.phase == BETWEEN_TURNS)
  world = enactValidatedVersions(world, operations)
  applyScheduledEnvironment(world)
  disseminateLawVersions(world, seededDraws(seed, turn, 'awareness'))
  for slot in [MORNING, AFTERNOON]:
    snapshot = freezeRelevantState(world)
    intents = []
    for actor in actorsSortedById(snapshot):
      lawsActual = evaluateCurrentLaw(snapshot, actor, slot)
      lawsKnown = intersectWithActorKnowledge(lawsActual, actor)
      feasible = getFeasibleActions(snapshot, actor)
      scored = scoreActions(feasible, lawsKnown, actor)
      intents += weightedSeededChoice(scored, actor.id, slot)
    assignments = allocateLimitedCapacities(intents, snapshot)
    effects = executeAssignedActions(assignments, snapshot)
    world = applyAuditedEffects(world, effects)
    world = resolveEnforcement(world, slot, seed)
  world = settleConsumptionWagesRestAndRegeneration(world)
  world = updateAttitudesFromObservedOutcomes(world)
  events = finalizeCausalEvents(world)
  return snapshotWithChecksum(world, events)
```

**Important:** production and enforcement must never depend on unordered iteration through map keys. Keep stable order and versioned numeric semantics. Recorded debug traces permit one citizen's action to be replayed and explained.

# 15. Test matrix and engineering gates

| ID | Contract | Required check |
|---|---|---|
| LAW-01 | Illegal token pair rejected | Farmer cannot receive action requiring guard capability |
| LAW-02 | Bad-but-valid law allowed | Excessive working obligation enacts, then affects behaviour |
| LAW-03 | Contradictions visible | MUST and MUST_NOT same action/time warn and resolve predictably |
| LAW-04 | Revision awareness delayed | Legal version changes next turn; some actors remain unaware |
| LAW-05 | Repeal is not retroactive | No fresh penalties for repealed law; historic effects remain |
| LAW-06 | Permission semantics | MAY overrides eligible prohibition only under stated precedence |
| AGT-01 | Needs affect behaviour | Higher hunger raises demand for food, within feasible choices |
| AGT-02 | Not all laws instantly obeyed | Compliance varies with trust/enforcement over seeded sample |
| AGT-03 | No impossible outcomes | No harvesting from an empty field; failed attempt logged |
| ECO-01 | Resource conservation | Account-level food/wood/coin ledger balances |
| ECO-02 | Capacity respected | Guards cannot handle more cases than active patrol capacity |
| RNG-01 | Same seed => same replay | Same logical world checksum after same commands |
| RNG-02 | Different seeds yield variation | Cross-seed distributions within predeclared statistical tolerance |
| MOD-01 | Mode data, not engine fork | Same shared law semantics under matching enabled parameters |
| NAR-01 | No fabricated claims | Gazette and adviser output only referenced facts |
| SCALE-01 | Registry expansion | Add test resource/action/predicate without core code changes |
| SAVE-01 | Save migration safe | Unknown schema fails explicitly; versioned migration tested |
| MOB-01 | Touch-only core flow | Decree authoring, amend/repeal, time advance and Royal Inquiry function without keyboard, hover or mouse |
| MOB-02 | Cross-platform simulation fixtures | Golden replay checksums match between selected mobile/web target runtimes for supported versions |
| MOB-03 | Safe lifecycle interruption | Suspended/killed app or browser restores a fully committed turn and an optional separate draft, never partial ledger updates |
| MOB-04 | Native adapters defined | Persistence, share/export, safe area and lifecycle interfaces have documented adapters or explicit future stubs |

# 16. Technical questions still requiring engineering sign-off

1. Cross-platform runtime and packaging decision: mobile-first touchscreen UX; web deployment option; eventual Android/iOS app-store builds; offline-first and lifecycle trade-offs.
2. Numerical type and RNG definition for cross-browser/cross-platform deterministic replay.
3. How much agent reasoning is evaluated each slot versus cached/cohort approximated.
4. Detailed trading/ownership accounting for the slice's simplified market, including default prices and salary flows.
5. Tuned coefficients for hunger, fatigue, trust, awareness and enforcement after playtests.
6. Causal trace storage budget, replay memory and compressed event summaries.
7. Save-file compatibility policy when adding new module schemas and rule actions.

**No-go for implementation without resolution:** fixed action registry, legal precedence, turn timing, economy ledger accounting, starting scenario, mode profile semantics and reproducible RNG. Other areas may be implemented incrementally behind interfaces if their contracts are stable.
