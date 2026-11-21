# Rulecraft — Task 06 Modes, Campaign, Sandbox and First-Playable Validation Contract

**Status:** Proposed implementation/design brief for product-owner sign-off; no Task 06 gameplay implementation authorised yet
**Date:** 21 November 2026
**Baseline:** Task 05 PR #19 merged; the functioning Task 04 touch-first shell and Task 05 fact-bound narrative must remain intact.

**Primary source specifications:** [Master GDD](01_Master_GDD.md) §§2–5, 8, 10–14; [Technical Systems](02_Technical_Systems.md) §§1, 11, 13, 15; [Vertical Slice](03_Vertical_Slice.md) §§1–8, 10–14; [original task](../tasks/06_modes_campaign.md); [AGENTS.md](../AGENTS.md). The 12-day \`fixtures/task-01-village.json\` and existing v4 society / typed law interpreter are the verified baseline. Treat GDD values marked **PROPOSED** as hypotheses requiring testing.

## 1. Product purpose and honest completion criteria

This milestone is **not** merely a different label on the four existing preview starts. Establish coherent, distinct Junior and Full experiences, a real structured first campaign scenario, and a Sandbox entry that invites experiments with the same actual simulation. Demonstrate — do not assume — that laws matter, goals are comprehensible, outcomes can vary, and the game is enjoyable enough to justify further investment.

**Two separate gates**:
- **Engineering-complete gate:** documented mode/scenario configuration, functional and automated checks, evidence-grounded success/failure and replay, tested legal invariants, measured performance, a truthful risk/gap report. Achievable without pretending actual children or phones have been tested.
- **First-playable product validation gate:** observed first-time *Junior and Full* participants and real Android/iOS browsers, with recorded results and owner review. This gate remains **Not Yet Tested** until the actual sessions exist. No automated test count alone can declare the game fun, age-appropriate, or mobile-release-ready.

**Core invariant:** only the player's legislation changes the society; inspection, selecting a scenario/seed, turning a day, saving/replaying, or reading hints are allowed controls. No direct citizen orders, free resource grants, guaranteed outcomes, invisible scenario rescue, or UI-simulated production bonuses. One shared typed law semantics, v4 society world executor and evidence layer under all modes; a new engine schema is justified only by a separately documented necessary simulation change.

## 2. Mode profiles: data, parity, and teaching

Introduce a validated, versioned \`ModeProfile\` registry in an engine-independent config or pure shared module. **Profiles configure presentation, exposed grammar and scenario inputs, not the meaning of ASTs**.

Proposed, reviewable profile fields:
- \`id\` (\`junior\` / \`full\`), \`profileVersion\`, \`locale\`, \`readingLevel\`, \`hintDensity\`, \`progressionRules\`, \`visiblePredicateTypes\`, \`maxExposedClauses\`, \`scenarioIds\`, \`permittedStartPresets\`, \`objectivePresentation\`, \`tutorialSequence\`, \`playerFacingLabels\`.
- Scenarios supply **separate** \`fixture\`, \`SocietyConfig\`, \`LawPolicy\` and seed defaults; if the mode changes economics, it does so by distinct **explicitly displayed and persisted** scenario parameters, not a hidden interpretation of \`MUST\` or \`MUST_NOT\`.
- Cross-profile invariant: when \`fixture\`, \`SocietyConfig\`, \`LawPolicy\`, seed and command journal are identical and an AST is visible in both profiles, its legality, outcomes and replay hashes must be identical. Pure UI copy may differ.

**Junior (7–12) — initial programme:**
- Visual one-step vocabulary: who → must/must not/may → available action, condition/exception progressively introduced through **real player authoring**. At the start, expose a simpler choice set and **one optional clause** at most; no unsupported implied actions. Do not hide a pre-existing complex law when loading an older save: show it in read-only explanation or reject incompatible mode conversion.
- 1–2 highlighted pressures at a time with concise evidence-based adviser explanations. Define terms like “available food” vs “can afford food”, “current decree” vs “heard an old version”. No artificial “everyone now obeys” line.
- Forgiving **scenario parameters or checkpoint options** may be configured, but any restart is an explicit new run or a verified prior checkpoint, never an unlogged rollback. Shorter tasks/checkpoints are candidate choices that require data from playtests.
- Text enlargement, 44px targets, inclusive icons+labels, no compulsory reading at adult density; no spoken narration unless actually implemented.

**Full — initial programme:**
- Expose both WHEN and UNLESS where registry supports them, more detailed comparative metrics and lawful conflicts, longer/stronger scenario pressures only if tested. More complex does not mean arbitrary punishment or a different law interpreter.
- Hints are optional and explain actual cause/constraint rather than a recommended “winning” code path.

**Profile persistence:** save immutable mode id + profile version + scenario/preset id, scenario config version and seed with the committed \`GameSession\` or versioned metadata. The snapshot still stores authoritative fixture, seed, engine, law journal and event history. Historic Task 04/05 sessions without this new metadata must load under explicitly mapped **legacy preview** behaviour or a clear safe migration, not silently acquire newly tuned objectives/profiles. Disable mid-save switching until it is designed and parity-tested. A future upgraded copy registry must not silently rewrite older Chronicle text; the current \`village-record-1\` catalogue requires an explicit compatibility plan before new copy ships.

## 3. First campaign scenario: The Hungry Village

**What is confirmed:** Campaign is an objective-driven story with replay; the first case is a village struggling to feed residents. **What is not confirmed:** the initial benchmark's 90% of citizen-days fully fed and 40 market-food units by end of day 12 are currently **provisional**. The actual 40-citizen, 12-day engine has known structural problems (foresters have no timber buyer, some households lack purchasing power even with food on shelves). It is not yet established that either threshold is meaningfully achievable via player laws, difficult for an informed player, or appropriately forgiving for children.

Design a declarative \`ScenarioDefinition\`: \`scenarioVersion\`, seed/preset, world fixture and behaviour settings, legal policy, objective predicate definitions, optional stretch/partial outcomes, horizon, teaching stages, initial info/context and consistent displayed completion reasons. Validate every objective against real \`DailyMetrics\`, event records, balances and the actual ledger. Do **not** create an alternate UI-only \`victoryScore\` unrelated to the source data. The provisional targets can stay as baseline candidates while evidence is gathered.

**Teaching flow (proposed):**
1. Read a short factually grounded problem; notice market supply versus actual food access.
2. Author one valid food-related decree, with an explained preview and genuine next-day enactment/learning lag.
3. Observe a recorded choice or missed opportunity; inspect one related real event (and contrast actual vs perceived law).
4. Revise, suspend or remove a decree if the player chooses; introduce one WHEN/UNLESS predicate in Junior after real progress. Use hints to highlight mechanisms **without forcing a citizen event** or promising that an intervention will succeed.
5. By scenario end, show status (met all, met some, met none) with exact numerators and denominators, historic laws and at least one factual incident if one truly occurred; suggest one *testable strategy question* for retry. Players can retry **same seed** for comparability or start a different seed for variety, with clear save replacement confirmation.

A “partial” outcome must represent the actual subset of objectives met; do not call a failure “success” to protect feelings. No arbitrary scores for “creativity” unless there is an explicitly specified, measurable and validated objective.

**Campaign strategy viability is a hard review gate.** Before freezing the world or thresholds, execute the following on fixed, reproducible datasets:
- ≥256-seed exploratory sweep of **no-decree baseline** and at least 3 clearly defined lawful, meaningfully different policy strategies (e.g. harvest duty versus time-conditional harvest duty versus restrictive work policy). Enact each through the **same public law-command API**, not direct citizen interventions. Document attempted commands, actual legal status/knowledge and inability-to-act details.
- Report for **each mode and scenario preset**: fully-fed citizen-days, market stock at finish, poor-but-stocked meals, supply shortfalls, wage/market transfer constraints, default and strategy victory rate with Wilson/binomial intervals or predeclared bootstrap, variance across seeds and time-to-meaningful-outcome.
- Explain cases where different laws cannot substantially alter the objective because the engine lacks necessary mechanisms (e.g. no timber buyer), and demonstrate whether the campaign can genuinely be won/lost through player choices. **Do not change only the objective thresholds to manufacture “meaningful choice”.**
- Reserve a separate holdout seed set (e.g. 256 new seeds) after tuning for reproducible confirmation. Predeclare the final threshold and avoid optimising solely to seed 42. If no viable and interesting solution emerges, report the scenario **Not Balanced / Design Blocker** with proposed change options rather than claiming a passed win-rate.
- Propose, do not silently implement, funded/ledgered changes to timber earnings, market demand, essential needs, guard wages, or prices if those are necessary to make the scenario functional. A core economic-mechanics change requires product-owner sign-off, schema/versioned replay assessment and resource audit; never alter historical v1–v4 saves and hashes.

**Difficulty decision:** junior and full may use different **versioned starting fixtures, duration or tested goals**, but every game must show which parameters differ. Do not assume Junior is easier merely because the composer shows fewer options; fewer tools against identical objectives can make it **harder**.

## 4. Sandbox: meaningful experimentation, not a disguised campaign

Sandbox has **no imposed win/fail threshold**, no hidden enforced campaign objective and no forced tutoring. It uses the same action/legality engine. Offer a safe choice of seed and at least one honest scenario preset (more only if demonstrated), a readable explanation of the preset's resources, starting problems and day horizon, and metrics/Chronicle/Inquiry over time. Seed entry is an allowed setup control, not an in-game cheat.

**Important scope boundary:** the existing Task 04 “Sandbox” is a labelled **12-day trial**, not open-ended Sandbox. The underlying JSON fixture accepts a duration up to 365 days, but the **full event history in two-generation IndexedDB snapshots scales with length**; do not simply promise indefinite play because the parser accepts 365.

**Proposed Task 06 acceptance:** provide an actually extended Sandbox play horizon justified by measured save/load/turn performance (target a 30-day option **only if** measured on realistic hardware and browser persistence). Prefer adding a bounded “Continue experiment” renewal mechanism only if a correct, versioned, replayable extension can be implemented **without editing the past fixture/snapshot invisibly**. If the technical foundation cannot support an endless run, label it explicitly (e.g. “30-day sandbox experiment”) and mark true open-ended Sandbox **not yet delivered**. Do not call a timed trial “open-ended” or pretend a new seed is continuation.

**No debug console, direct resource spawn, forced demographic control or live rule AST import.** Presets are versioned immutable starting parameters; selections visible before start and recorded in save metadata. Sandbox allows all supported lawful operations between turns and respects real market/fatigue/patrol constraints.

## 5. Progression and modes vs existing saves

Current new games start society schema v4; existing v3 snapshots intentionally advance with v3 semantics. Maintain this separation.

- Introduce scenario/progression metadata as a versioned **UI session envelope** with clear backward-compatible fallback for older \`GameSession\` records. Keep the existing \`encodeSociety\` checksums and \`loadSociety\` replay verification; do not forge engine migrations. If any engine v5 change is approved, retain v1–v4 golden baselines and provide explicit migration/restart policy, not silent upgrades.
- “Unlock” means **expose already supported tokens** or enable editor hints, with prerequisites recorded and tested; it never changes execution of a previously created lawful AST. If a Junior player reopens an existing law containing advanced predicates, display it accurately and prevent accidental loss, rather than deleting conditions.
- Campaign completion must persist/restore and not change retroactively on replay. If a user replays the same seed from scratch, that is a **new game**, with explicit confirmation before replacing current local saves.
- Do not require cloud accounts/telemetry/real names. Avoid multiple saved villages unless there is a separately tested revision-safe storage extension.

## 6. Playtest instrumentation and responsible interpretation

**Proposed structured observation, not surveillance:** design a **manual research sheet** or opt-in local export of nonidentifying session measures. Collect no real child names or chat content, no child analytics network beacons. For research involving minors, obtain parent/guardian permission and appropriate safeguarding.

First-time Junior participants: age bands within 7–12, age-appropriate reading and devices; can they author a decree without intervention, identify who it affects and when it starts, follow one genuine evidence chain, change their approach, recognise that a stocked market is different from an affordable meal, understand advisers and share card? Record facilitation and confusion explicitly.

First-time Full participants: can they distinguish current vs perceived law, investigate an unexpected event, predict first-order result, and then voluntarily modify a decree? Observe if policy strategies feel meaningfully different and surprising but fair.

**Suggested measures (proposals):** completed first valid decree without prompting, time to first independent iteration, correct explanation of one causal link, voluntary law revisions, observed humour response (qualitative), desire to replay, number of mistaken UI/legal expectations, perceived agency and frustration. Use video/notes only with consent and review retention/privacy. No minimum “laughs per minute” criterion as a proxy for game fun. Clearly separate measured observations from facilitator interpretation and sample size, avoid claiming statistical validation on a handful of tests.

**Known UX prerequisite:** existing issue #17 reports clipping of selected values in the Task 04 composer at 320px with 200% text, despite a no-horizontal-overflow test. Fix and retest before declaring child/assistive accessibility.

## 7. Mobile availability and performance are separate evidence gates

The app currently has **no confirmed hosted staging URL**. Local LAN test is available; issue #16 tracks an **access-controlled HTTPS staging plan** and actual Android Chrome/iPhone Safari testing. Private GitHub repository != private deployed site; do not deploy publicly or send data to a new host without product-owner approval.

**Device-test matrix:** at least one real Android Chrome and one real iOS Safari device with recorded model, OS/browser version and viewport. Exercise setup, all core decree controls, latest narrative, 200% text, notch/safe area/keyboard, change confirmation, day advancement, background/suspend/resume, reload, full-history save verification, PNG download/share fallback and offline interruption. Record **Pass/Fail/Not Yet Tested**; desktop Chromium emulation never counts as a real device result.

**Provisional engineering performance target** from the technical spec: representative midrange Android, 40 citizens × up to 25 active laws × 30 days, median turn resolution below 150 ms and p95 below 500 ms (and no >1s UI lock). Also report save/verify p50/p95, JS long tasks, total two-generation IndexedDB footprint, memory/resource growth and file export time; on iOS measure honestly and compare the same scenario with Android. These are test targets, not achieved results. Degrade visible detail/retention only with a versioned and audited design, not silent history deletion.

If real devices, private staging or human testers are not available in this milestone, compile the exact manual test protocol and leave product/mobile release sign-off **pending**. Do not block deterministic profile/config/scenario engineering design, but do not label the game device-ready or playtest-validated.

## 8. Proposed four implementation increments and gates

### Increment 1 — Versioned profile/scenario architecture
- Build validated \`ModeProfile\` and \`ScenarioDefinition\` registries with actual fixture/policy/grammar exposure, common semantics and immutable session metadata; keep Junior/Full and campaign/sandbox as four real starting combinations, not merely labels.
- Add typed scenario selection/start confirmation and backward-compatible loaded-save mapping; show mode, scenario/version and engine used. For old v3/v4 saves, preserve their original law/event behaviour.
- Test cross-mode identical-state semantic parity, no unsupported token display, legitimate saves with older metadata, forbidden mid-save conversion, and saved profile/seed consistency.

### Increment 2 — Campaign teaching, outcome accounting and balance study
- Implement factual Hungry Village opening, 3–5 evidence-led teaching beats, mission overview, objective progress and final/partial outcomes grounded in true day and ledger metrics, then safe same-seed/fresh-seed retries. No scripted outcomes or invisible help.
- Keep threshold values **provisional** until ≥256-seed paired policy-strategy exploration plus holdout verification. Run no-law and lawful contrasting strategies in Junior/Full; provide exact definition of player agency and the outcomes being measured.
- If core economy makes objectives unachievable, trivial, misleading or excessively dominated by initial cash, stop and request owner sign-off on explicit proposed fixes instead of inventing subsidies or calling calibration complete.

### Increment 3 — Sandbox presets, seed selection and honest horizon
- Support Sandbox without victory conditions, visible seed and starting preset(s), lawful legislation, Day Results/Gazette/Chronicle/Inquiry, transparent duration and repeat/compare controls. Preserve single-save/atomic persistence.
- Benchmark longer horizons; only offer a >12-day preset/continuation that the actual browser and verified snapshot code can support. Mark unlimited Sandbox **future** if genuine indefinite continuation is not implemented. Do not silently modify a fixture mid-run.

### Increment 4 — Regression, mobile readiness, human-playtest dossier
- Complete automated BUILD-01–24 and NAR/LAW/AGT/ECO/SAVE/MOB acceptance matrix, with per-item **Pass / Fail / Not Yet Tested**, evidence filenames, versions and defects. Keep at least all 151 current tests, 19 browser tests, existing replay hashes and resource audits; report new actual counts rather than promising a target number.
- Add browser flows for mode/tutorial unlocks, objective validity, same-seed replay, distinct strategies, Sandbox setup, preview save compatibility, scenario completion/retry, failure/recovery, 320/390px/200% text; preserve factual share-card evidence.
- Run measured scenario sweeps and performance samples. Execute actual Android/iOS and age-appropriate playtest sessions *only if available*; otherwise document exact steps and truthful missing evidence. Do not claim acceptance where evidence does not exist.
- Publish engineering + **product validation** report: scenario distribution, two valid contrasting policies, Junior/Full comprehension and iteration observations, useful/harmful surprises, playtest fun findings, physical-device results, content limits, unresolved design decisions and recommendations.
- Open Task 06 implementation PR for product-owner technical review and distinct first-playable **go/no-go** assessment; do not automatically merge or claim a production-ready mobile game.

## 9. Explicit design/approval decisions

**Preserve:** decree-only authority; one engine; Junior + Full and Campaign + Sandbox as confirmed products; real legal awareness, choice, resource conservation and enquiry; narrative truth; existing v1–v4 golden semantics; no unapproved The Nurts canon.

**Propose (requires product-owner review):**
- Versioned per-save profile/scenario metadata and legacy-preview compatibility.
- Junior's initial vocabulary, unlock timing and tutorial/hint presentation; Full's enhanced explanation.
- Scenario baseline, final campaign objectives (original 90%/40 only as candidate), whether changes to the economic engine are required, and any separate Junior/Full start conditions.
- Sandbox realistic >12-day cap/extension design, save retention and measured performance budget.
- Seeded testing methodology (≥256 exploratory + ≥256 holdout, meaningful alternative-law strategies), human-playtest protocol and first-playable exit language.

**Do not silently introduce:** new currency/timber buyer, unlogged “aid”, fines, child behavioural tracking, cloud accounts, free-text law interpretation, altered old save meaning, a claim that Sandbox is unlimited, or a claim of phone/children's readiness without real evidence.

## 10. Known dependencies and next boundaries

- **Issue #16:** access-controlled HTTPS staging & real-device test — planned, **not deployed or authorised as a public site**.
- **Issue #17:** 320px / 200% composer selection clipping — genuine accessibility gap pending correction.
- **Narrative content version:** global \`village-record-1\` registry currently used; choose a per-save content-version strategy before adding new narrative copy or changing text across upgrades.
- **Unfunded foresters/food unaffordability:** known prototype economy limitations; true Campaign objective viability must be demonstrated before sign-off.
- **Save growth:** Task 05 measured ~4.75 MB latest+previous logical record after 12 days. Extending into a 30-day/full campaign needs actual storage performance evidence.
- **Native Android/iOS packaging and store compliance:** future release milestones, not a Task 06 claim.
