# Rulecraft — Task 03 Autonomous Society Design Contract

**Status:** Proposed implementation contract for product-owner review (not yet a gameplay-balancing sign-off)  
**Date:** 21 November 2026  
**Prerequisite:** PR #6 (Task 02) merged into main  
**Related:** Master GDD v0.6; Technical Systems §§6–8, 10, 13–15; Vertical Slice §§2–6, 10; Task 01 and Task 02 engineering reports and decision registers.

## 1. Objective and engineering boundary

Move from externally supplied law notices and fixed legal-choice adjustments to an autonomous, observable village in which **information, beliefs, attitudes, incentives, physical capability and institutional capacity** interact. Demonstrate causal variety in a 40-person, 12-day village; do not pretend this is a statistically validated model of real human behaviour.

**Preserve confirmed product rules:** The player may change the world only by decrees; citizens and institutions decide actions autonomously. Enacted law is distinct from the citizen's knowledge of it, and effective enforcement is distinct from legislation. MUST creates pressure, MUST_NOT deters without magically preventing action, MAY grants permission without compelling action. No direct happiness, output, food or trust bonus simply for enacting a law. One headless engine shared by Junior and Full modes.

The implementation must distinguish at least:
1. **Actual law** — operative legal status according to current versions and slot conditions.
2. **Perceived law** — latest version a citizen actually knows, including stale versions.
3. **Acceptance** — citizen's opinion of a specific decree/version, not equivalent to knowing or obeying it.
4. **Intent** — which feasible action the citizen selected and why.
5. **Execution** — whether stock, money, location and capacity permitted that choice to complete.
6. **Compliance** — classify based on the specific known and feasible opportunity; report ignorance, competing duties and blocking separately.
7. **Detection and disposition** — separately model whether a guard actually observed a relevant violation and any consequence.
8. **Realised effects** — hunger, fatigue, resource balances and justified changes to trust/attitude based on experienced events.

## 2. Scope and deliverables

**In Task 03:** versioned deterministic citizen information channels, small bounded peer-contact topology, law-version awareness, per-law acceptance, needs/income/fatigue/trust-driven action utility, practical feasibility and contention, actual patrol-limited detection and proportionate non-monetary warnings, factual provenance and transparent metrics. Keep existing basic harvest/merchant/food/guard/forestry ledger. Fairer reproducible allocation under scarcity is required before interpreting outcomes about welfare.

**Not in Task 03:** full user interface, four advisers' banter/Gazette/share cards, factions and rich social networks, simulated psychology claims, new world scales, taxation, dynamic prices, fines or detention, unimplemented food export, campaigns proven winnable, native mobile packaging, premium economy or multiplayer. Task 04+ retains player-facing screens and actual playtesting.

**Design-versus-balance:** Mechanistic separation and data provenance are engineering requirements. Notification probabilities, contact counts, utility coefficients, attitude shifts, detection chance, patrol throughput and sanctions are *proposed tunable prototype parameters*, not empirical facts or immutable game rules.

## 3. Phase ordering, notification and knowledge (proposal to implement and test)

Keep morning/afternoon daytime actions and dusk settlement. Extend a day as follows:

1. At dawn of day D, read confirmed law history and previous completed-day social/contact state. Identify *currently effective* law statuses/versions and potential information sources; do not grant universal instantaneous awareness.
2. Resolve at most one attempt to learn a **particular currently effective version** per eligible citizen per day, using a keyed seeded draw. Notification attempts must have grounded sources (e.g. a standing publicly accessible council notice and/or a peer known to have the version as of the preceding day). Institutional dissemination requires an actually staffed/resourced action, not a free phantom institution.
3. Commit newly learned versions *for use in the morning of D*, with explicit notice event ID, source/channel, original version/status and learned-at phase. Treat this as a dawn event inside D's **single atomic completed-turn save**; a crash before commit recovers the prior completed turn.
4. Resolve morning actions from a frozen morning opening snapshot; afternoon from its own opening snapshot; then dusk needs/experience/trust/attitude updates and metrics. Knowledge gained through same-day peers should not leap recursively to the entire population: any social spread uses the previous completed day or an explicitly scheduled later information phase.

The Task 02 manual notice API remains available **for controlled tests/debug** but not as a player-controlled mechanism. Existing semantics (confirmed commands durable between turns, effective next turn; old notices cannot downgrade official knowledge) are preserved.

Represent learning with a stable per-citizen/per-law-version record, including the **latest learned status** (active, suspended or abolished). A citizen can retain old beliefs until learning the update; knowledge of a repeal does not erase historical awareness. Multiple same-turn amendments: citizens should learn the final effective version for that turn, never an already superseded queued version through the default public channel. A later false rumour, if ever introduced, requires a *separate misinformation model*, not rollback of official notices.

**Compatibility concern:** Task 02 uses notices with learnedAtTurn < evaluatedTurn. Task 03 may introduce an explicit dawn phase/time for notice effectiveness. Version the schema and test the change rather than reinterpreting existing v2 saves or modifying v2 replay hashes silently. Implement awareness in the new v3 engine path.

### Communication model proposal

Use a **bounded deterministic contact graph** built from fixture/seed (e.g. home-neighbour links plus a small number of occupation links). Persist or canonically reconstruct the graph. Peer influence must refer to named peers and their *previous-day* known versions, not a made-up global awareness percentage. Keep a public bulletin mechanism with an explicit publication event as a low-probability information source; public availability does not imply every citizen reads it.

If adopting the technical spec's candidate learn-rate formula, implement probability in **integer basis points** with stable seeded draws and documented rounding/caps; for example, a base bulletin reach plus separately attributable peer and institution terms. Expose all coefficients, channel availability and reach as scenario configuration. A zero-reach negative fixture must permit zero dissemination; a complete disconnection must not magically create social reach. Model at most one learning trial per eligible citizen/law version/day, with a documented policy for multiple qualifying sources (priority/combination and evidence).

A fresh enactment must show a gradual and seeded distribution of learning; changing communication reach must alter learning distributions over matched seeds. Learning cannot be a direct multiplier on harvested output.

## 4. Acceptance, trust and action-choice contract

Per citizen, track an attitude toward each **law/version** on a bounded integer scale (technical proposal: -100 through +100), distinct from general institutional trust (0 through 100). Initial attitude uses transparent individual costs/benefits and disposition; no instant universal approval of MUST or hatred of MUST_NOT.

Attitude updates at a defined phase only from **observed/evidenced** experiences, including ability to buy food, fatigue/overwork, useful public service, experienced detection/notice and perceived procedural fairness. A citizen must not become unhappy solely because a decree has a strict-looking text label. Store contributing event IDs and component deltas. General trust changes should likewise reference real experiences and should not be double-counted simply for hearing the same law repeatedly. Bound and cap all integer updates.

Calculate intended action choice from explicit, individually inspectable components such as need/hunger, expected earning opportunity, cost/fatigue, personal disposition, social influence, acceptance and perceived-law pressure. Maintain stable integer weights, candidate lists and deterministic keyed RNG. Use **perceived** current/stale knowledge only for legal pressure. Preserve stochastic choice with a non-zero possibility of defiance where genuinely feasible; an actual MUST_NOT does not physically remove the action.

No actor can spend money or time they do not have, create resources by obligation, carry out ineligible work, or successfully execute more than one action per slot. Recheck contested capacity and state at execution. Record a failed attempt separately from a deliberate choice not to attempt a duty.

Distinguish *supply shortage* from *cash affordability shortage* from *merchant delivery bottleneck* in food access metrics. Current baseline six foresters lacking income is a known economic-access limitation, not proof that food production is low. Do not quietly add a timber buyer, government subsidy or invented money supply. If a small Treasury timber procurement + real use/stock mechanism is needed to make a reasonable welfare test, propose its seller/buyer, quantity cap, price, ownership, ledger movements and timber destination **before implementation** and flag this as a product-owner choice. Economic calibration/market redesign can be a separate ticket; do not force the campaign's 90% target to pass.

## 5. Fair, reproducible scarce-capacity allocation

Task 01/02 use ascending actor IDs to process scarce jobs, goods and meals; this biases outcomes and invalidates fairness comparisons.

**Task 03 should implement a v3 deterministic, seed/turn/slot/resource keyed allocation order** (e.g. reproducible daily lottery/rotation with stable tie-breaks), separate from global actor listing and random action-choice keys. An actor's permanent ID must not systematically determine access to a scarce field, merchant delivery slot, market food or paid service. No reshuffling after seeing a citizen's outcome or a decree's desirability. Avoid adding stochastic variability to resource balances beyond explicitly evidenced capacity assignment.

Acceptance: same seed/fixture/replay yields exactly the same allocation, reordering input arrays does not alter it, each contention event records eligible applicants/winners/reason, and 200+ seeds reveal no persistent low-ID advantage after appropriate conditioning. Keep old v1/v2 historical implementations and hashes intact by versioning rather than altering their historical meaning.

## 6. Enforcement: guards must actually be present

Only a guard who **chose and successfully performed PATROL in the relevant slot/location** contributes detection capacity for that slot. A guard who rested, was blocked, or merely received a wage cannot patrol or detect anything automatically. No passive enforcement.

Define a modest per-patrol investigation capacity and a bounded keyed encounter/detection probability. Match inspections to actual, currently prohibited **performed actions** using the same authoritative slot conditions, not a citizen's stale memory. Do not automatically assume that a missing action in response to MUST is observable; record the unmet duty and only investigate if the game models an observation mechanism.

Record factual enforcement chain: current rule version / actual illegality, prohibited action event, active guard and patrol event, opportunity for encounter, selected/attempted investigation, detection outcome, citizen knowledge at the moment, and disposition. One patrol cannot produce unlimited or double-counted detections. If zero guards patrol, detected violations, enforcement dispositions and sanctions must be exactly zero. An unaware citizen may be informed/warned without being falsely described as a knowingly defiant offender.

**Proposed MVP disposition:** warnings/education only, with no coin fines, detention, automatic tax, physical blocking or unaccounted transfers. Guard fatigue and staffing/resource costs still arise through normal actions/ledger. If adding fines is proposed, obtain a new audited, authorised coin movement contract before implementation; do not introduce it under this issue.

If the present fixture lacks an illegal attempted action in a typical seed, construct targeted legal/physical scenarios and a seed sweep; do not invent phantom violations solely to show patrol activity. Current MUST_NOT cannot disable an action executor by fiat.

## 7. Compliance classifications and denominators

Each law/actor/slot result should be separable into:
- **Unaware** (actual law may apply, but citizen does not know current version);
- **Known / not applicable** (condition, exception, subject, slot);
- **Known / infeasible at selection** (physical/financial impossibility);
- **Known / feasible / attempted and completed**, attempted but **blocked/partial**, or feasible and **not chosen**;
- **Competing duties** (multiple feasible obligations and limited slots);
- **Prohibited action performed**, with actual prohibition and perceived state separately reported;
- **Detected vs not detected**, and warning disposition where capacity existed.

Do not label every known unchosen obligation as **wilful defiance**: other duties, uncertainty and competing needs matter. A classification of “informed noncompliance” is acceptable when supported by evidence; stronger claims of intent require explicit model evidence. Unknown current laws must not create fictional perceived deterrence.

Publish numerator and denominator of each measured rate, e.g. known/applicable/feasible opportunities for obligation-compliance; all actual prohibited acts for detection; unique citizens informed by day for awareness; individual-law attitude and trust distributions. Do not merge awareness, acceptance, attempt, completed compliance and enforcement into a single “adoption” percentage. If shown as composite later, define it transparently without hiding the components.

## 8. Testing, causal proof and reproducibility

**Increment 1 — Knowledge diffusion and versioned state**
- Add configurable, seeded daily notification channels and a bounded contact graph; snapshot/event provenance and clock tests.
- Tests for no notice, public-only, peer-only, funded/staffed institutional channel if implemented, stale notice after amendment/repeal, known previous-day peer, same-day no chain amplification, zero reach and deterministic graph/IDs.
- Persist/reload law version, citizen awareness, attitudes and configuration in a new engine/schema. Retain v1/v2 loaders and golden tests.

**Increment 2 — Decisions, needs, attitudes and fair allocation**
- Add explainable integer action-choice components for hunger, income, fatigue, disposition, trust, acceptance, perceived law; update attitudes/trust from observed events.
- Fix actor-ID scarcity bias with deterministic allocation. Separate unaffordability from shortages and delivery access.
- Make events and summary metrics distinguish attempted, completed, blocked, unaware, informed and conflicting obligations. Tests for actual/perceived and physical feasibility remain.
- Add negative/falsification tests: law wording with no experience does not change trust; zero contact cannot magically teach; a poor forester cannot buy food without a funded transfer; fairness does not overdraft/duplicate stock.

**Increment 3 — Capacity-limited enforcement**
- Patrolling guard presence, encounter tests, targeted illegal actions, finite investigation throughput, actual current legality only, warning event provenance, no fines.
- Test zero patrol = zero enforcement; blocked/resting guard = zero; multiple violations with one guard produce bounded outcomes; repealed rule cannot be enforced; unaware prohibited acts are not branded intentional; no duplicated detections; the same patrol cannot handle more than capacity.
- Preserve ledger conservation, save/reload and cross-runtime replay.

**Increment 4 — Statistical validation, engineering report and regression**
- 200+ matched seeds, predefined outcome directions and effect sizes with confidence intervals for awareness exposure vs learning, higher guard capacity vs detection, perceived enforcement risk vs compliance where evidence exists, and effects of hunger/income/fatigue on choices.
- Report where a predicted effect fails or is too small; never adjust coefficients silently to guarantee passing results. Compare distributions and causal pathways, not only one headline rate.
- One 12-day law-aware run with notices, attitudes, patrols and resource audits; interrupted day-six replay and Node/desktop Chromium state/event hashes where feasible.
- Preserve legacy v1/v2 golden fixtures/hashes; new v3 golden vectors/version record, CLI reproduction commands, actual install/test/build output.
- Keep a concise performance/storage sample; do not claim physical Android/iOS tested when they have not.

## 9. Release gates and hand-off

- [ ] Product-owner review of this proposed contract before Codex begins Task 03.
- [ ] Headless, typed and replayable; no React/DOM imports in the simulation package.
- [ ] A connected village demonstrates **gradual**, non-universal, attributable version learning.
- [ ] Knowledge, acceptance, choice, execution, actual legality, detection and trust are separate and auditable.
- [ ] No fabricated enforcement without patrol effort or illegal event; no automatic sanctions.
- [ ] Distinguish deliberate behavioural choice from infeasibility, competition and ignorance.
- [ ] Scarce-capacity allocation is deterministic, seed-fair and unbiased against permanent actor IDs under matched seeds.
- [ ] Ledger audit, no negative accounts, no resource/currency creation; regressions for rule-free and law-aware v1/v2 engines still pass.
- [ ] At least 200 matched seeds with denominators, effect sizes and confidence intervals; results not hand-tuned post hoc.
- [ ] All tests, type checks and production build executed and reported; report untested mobile-device checks explicitly.
- [ ] Decision register distinguishes confirmed mechanics from provisional coefficients and any open economic trade choices.
- [ ] Open Task 03 PR; stop for product-owner review; do not start Task 04 automatically.

## 10. Open risks for explicit review

1. **Realism versus prototype simplicity:** contact topology and trust/attitude model are hypotheses, not research-backed human psychology. Evaluate plausibility through playtests later.
2. **Economic access:** the current timber activity has no customer; do not call the baseline famine a purely agricultural problem. A properly funded timber-buying or maintenance loop requires a separate decision and may need its own follow-up issue.
3. **Save scalability:** v2 replay retains full history and verifies through resimulation; capture checkpoint size and reload latency with social events and many decrees.
4. **Mode and child suitability:** no child playtests or live UI here; Junior and Full share semantics and need dedicated presentation validation later.
5. **Older engine compatibility:** v3's new timing and fairness semantics may change new replays; preserve historical v1/v2 loaders and golden outcomes without silent upgrade.
6. **Performance and continuous integration:** add a minimal CI install/test/typecheck/build workflow before Task 03's PR merge if repo permissions permit; retain the independent Codex command log.
