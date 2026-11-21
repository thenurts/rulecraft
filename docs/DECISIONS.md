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

## Task 00 proposals · 21 November 2026

Owner review is pending. See the [architecture report](04_Task_00_Architecture.md) for conflicts, alternatives, and the verification plan.

| Decision | Proposal and approval gate | Affected checks |
|---|---|---|
| ARCH-001 | Approve a TypeScript core with a React/Vite web shell and Vitest for the next milestone. Keep Capacitor provisional until Android/iOS device and WebView evidence. Godot remains a 2D alternative if rendering needs warrant it. | RNG-01, MOB-01, MOB-02, MOB-04 |
| SIM-001 | Approve versioned keyed draws, bounded integer/fixed-point arithmetic, stable IDs and canonical snapshot/event bytes. Choose and lock the algorithm, encoding, numeric scale and overflow rules before implementing Task 01 behaviour. | RNG-01, RNG-02, BUILD-12, BUILD-24 |
| WORLD-001 | Approve rule-free fixture accounts, action eligibility, slot and settlement order, blocked-attempt semantics and debits/credits before Task 01. The opening stocks and prices remain candidates. | AGT-03, ECO-01, BUILD-07, BUILD-08, BUILD-10, BUILD-17 |
| LAW-001 | Before Task 02, approve actual versus perceived decree versions, durable between-turn enactment, clause exposure, a full precedence/licence table and the rule-free Task 01 scope. Resolve the passive detection policy before enforcement. | LAW-02 through LAW-06, BUILD-05, BUILD-06, BUILD-09 |
| SAVE-001 | Approve whole-turn snapshot commits with a prior checkpoint and separate editable drafts. Define schema compatibility and failure handling before Task 01 persistence. Browser and native store implementations follow platform testing. | SAVE-01, MOB-03, BUILD-18, BUILD-22 |
| UX-001, PERF-001, PROD-001 | Keep portrait-first as a candidate. Agree the device matrix, orientation and release thresholds after physical-device checks. Validate Junior's disclosure and reading demands through supervised playtesting. | BUILD-20, BUILD-21, MOB-01 |

## Task 01 · Headless kernel

[Issue #1](https://github.com/thenurts/rulecraft/issues/1) approves the rule-free fixture contract and the keyed RNG approach. The implementation below supplies concrete engineering versions. Starting stocks, populations, prices, yields, capacity and behaviour weights are **PROPOSED** fixture values. Campaign targets remain **PROPOSED** and outside this milestone.

### SIM-001 · Keyed draws and integer quantities

- Engine `headless-v1`, content `village-v1`, fixture/schema version 1, RNG `fnv1a32-fmix32-v1`. Clock 0 is genesis. A turn visits morning, afternoon and dusk in that order. Within each phase, actors and accounts use ascending, case-sensitive ASCII ID order. Initial traits use independent genesis draws.
- Key bytes are the compact ASCII JSON array `[rngVersion, seed, turn, slot, actorId, subsystem, drawIndex]`. IDs are lowercase ASCII tokens. Seed, turn and draw index are unsigned 32-bit integers. Use FNV-1a starting at `0x811c9dc5` with prime `0x01000193`, then the MurmurHash3 32-bit finaliser. Its steps are xor-shift by 16, multiply by `0x85ebca6b`, xor-shift by 13, multiply by `0xc2b2ae35`, xor-shift by 16. All products wrap via ECMAScript `Math.imul`. Use the final word unsigned. This is a non-cryptographic keyed draw, without a shared stream or host entropy.
- Range mapping is `floor(draw * size / 2^32)`. Size is capped at 1,000,000 so the product fits exactly in a JavaScript safe integer. Bins differ by at most one of the 2³² possible words. Fixtures use whole units for goods and coin, with validated bounds for opening balances, population, days, prices, yields and weights. The independent package targets ES2022.
- Golden example for seed 42, turn 1, actor `citizen.0001`, subsystem `choice`, draw 0 gives 1345397066 in the morning and 3899484680 in the afternoon. Tests pin both plus changes to the seed, turn, actor, subsystem and draw index.

Increment 1 verification on Node 24.22.3 and npm 11.19.1. `npm ci --cache /tmp/rulecraft-npm-cache` installed 44 packages, `npm test` passed 21 tests in 2 files, and `npm run build` passed both type checks and the Vite production build. The first build exposed the need to enable TypeScript extension imports for the later Node CLI. The rerun passed with that setting.

### WORLD-001 · Rule-free action resolution and ledger

- Slot-opening balances define known feasibility. Select between the actor's occupation action and rest with keyed integer weights, then process intents in stable actor order. Recheck stock, fatigue, funding and capacity on execution. A blocked attempt uses the slot with zero resource movement. A failed eligibility check, a known infeasible option and an attempted action that fails have distinct status codes. Fixed-order contention can favour low IDs and is a provisional scheduling policy.
- Keep resources in named owner/location accounts. Field crop and forest stock are finite reserves. Harvest moves units from the reserve to the producer's account. The initial 45 market-owned food units share one account at the granary location. Timber stays with foresters. No timber buyer, regeneration, export, or enforcement is modelled in this fixture.
- Merchant deliveries pool existing farmer stocks in ID order. A trip reserves the market-funded fee, then buys as many whole units as stock, coin and capacity allow. Each trip commits all goods and paired payments together. Dusk settles funded whole guard wages first, then residents buy and consume as many whole units as they can afford. A partial or blocked meal records the reason and increases hunger by the shortfall. A fully fed resident recovers up to one configured daily ration of accumulated hunger. Rest and sleep apply configured fatigue recovery. Trust is a seeded starting trait for this milestone.
- Transactions stage all postings before applying them. Each leg records resource, quantity and account balances before and after. A transaction references its action event, which references the transaction in return. The audit reconstructs every account from fixture genesis, checks authorised sources/sinks, ownership, transaction shape and balances, and reconciles resource totals.

Increment 2 verification on Node 24.22.3. `npm test` passed 28 tests in 3 files. `npm run build` passed both type checks and the Vite production build after tightening the clock's TypeScript narrowing. Tests covered zero and unavailable field stock, selection versus execution, contention, no delivery, insufficient funds, all-or-nothing posting, finite forestry, actor reordering and resource reconciliation.

### SAVE-001 · Committed snapshots and replay

- Schema v1 stores the fixture, seed, versions, resolved state, ordered events, linked transactions and daily metrics in each complete turn snapshot. Canonical JSON sorts object keys by code unit, preserves array order, encodes safe integers in decimal, and escapes non-ASCII UTF-16 units. FNV-1a 64 over the canonical ASCII bytes provides an accidental-corruption checksum and separate state and event digests. It is a non-cryptographic format. The loader rejects unsupported versions, checks the checksum, and replays through the saved turn to verify the entire payload.
- The Node adapter keeps the latest and previous complete payloads in one file. It syncs a same-directory temporary file and atomically promotes it. A new checkpoint uses a hard link that fails if the destination exists. Updates use atomic rename. The tested Linux path also syncs the containing directory. This is a local, single-writer prototype with no migrations and a complete history retained in each checkpoint.
- Keep checkpoint storage platform-specific and draft storage independent. Cross-runtime replay matched in Node and desktop Chromium. Physical mobile, native persistence, and save-size and recovery costs beyond the rule-free fixture remain open.

See the [Task 01 kernel report](05_Task_01_Kernel.md) for final test counts, timing and acceptance evidence.

## Task 02 — decree-engine semantic approval · 21 November 2026

**Product owner confirmed:** immediate durable between-turn enactment effective from the next simulation turn; potentially stale citizen knowledge; current-authority-only enforcement; explicit authority/priority/tie precedence; `MAY` as permission rather than compulsion; no automatic passive enforcement. See [Task 02 semantic contract](06_Task_02_Law_Semantics.md) for implementation-level definitions and edge-case acceptance tests.

**LAW-001 status:** Approved at principle level. The v1 modality/precedence/licence truth table and initial notice mechanism in `docs/06_Task_02_Law_Semantics.md` are **implementation proposals**, not separately playtested product decisions; escalate counterexamples rather than silently change rule semantics. `MUST` does not grant a missing licence. An action without an executable effect is unavailable in the player composer. 

**Task 01 compatibility:** the published rule-free baseline and golden replay must remain reproducible or undergo an explicitly versioned, tested migration; no rewriting old save meanings. 

**Remaining open:** citizen awareness/acceptance coefficients (Task 03); fairness under actor-ID allocation; timber income and campaign economics; native Android/iOS tests. All fixture numbers remain provisional.

### LAW-001 · Task 02 implementation and review points

- The v1 law registry shares an action vocabulary with the kernel. The village council and village jurisdiction are the playable scope. The composer projects typed English, catches selector and predicate errors, and reports potential conflicts separately from blocking validation. Junior can expose one optional clause while Full can expose two. Both interpret the same AST. Export is reserved for evaluating the licence matrix and stays outside enactment and execution.
- Confirmation appends an immutable version effective from the next turn. The latest same-turn confirmation for a law ID governs that next turn. An amendment preserves a suspension, and only reinstatement restores it. An abolished ID is terminal. A retry with an identical command ID and normalised payload introduces no history, allowance cost or disk write. The default two-command allowance stays configurable.
- Separate notices record what each citizen learned without automatic propagation. Repeat notices are idempotent. An older notice arriving after a newer one is rejected, avoiding accidental regression through the Task 02 notice interface. Existing older knowledge persists until the citizen receives a later notice.
- Same-action precedence follows authority, priority, modality and stable ID. A qualifying `MAY` supplies a hypothetical licence independently of the normative winner. A winning `MUST_NOT` can still prohibit a licensed action. A winning `MUST` without any applicable grant reports an unlicensed duty. The lower-ranked grant plus higher-ranked duty case is covered for owner review. The precedence and licence semantics remain proposed v1.
- Freeze predicate inputs at each slot opening. Known `MUST` and `MUST_NOT` add and subtract provisional integer action weights. An otherwise feasible baseline candidate with positive weight retains a minimum weight of one under deterrence. `MAY` adds zero weight. Separate recorded outcomes distinguish an infeasible, unchosen, blocked, partial or completed duty. The ledger and factual state still come from normal executor actions.
- Schema 2 uses a distinct engine and registry version plus a command and notice journal. The loader replays the journal and whole turns. The local adapter atomically writes each confirmed operation and each completed turn. Rule-free schema 1 remains readable through its existing codec and retains the published Task 01 checksums. The v2 codec rejects v1 explicitly.

See the [Task 02 report](07_Task_02_Engine.md) for test evidence and open review points. Task 03 remains subject to owner review.


## Task 03 — autonomous citizen behaviour · 21 November 2026

**Status:** Technical design proposed for review; user authorised proceeding to Task 03 planning following the merge of PR #6. See [Task 03 Autonomous Society contract](08_Task_03_Autonomous_Society.md).

**Existing confirmed constraints (preserved):** decree-only player influence; physically feasible action execution; distinction between actual and perceived law; gradual awareness and acceptance as separate processes; enforcement limited by guard resources and current applicable law; factual event provenance; seeded reproducibility; one shared Junior/Full rule engine.

**New Task 03 implementation proposals requiring design review before coding:**
- Daily dawn law-version learning from explicit, logged public notice and previous-day peer channels; bounded seeded contact graph; no automatic universal broadcast. Any staffed institutional outreach needs a real capacity/cost contract.
- Per-citizen, per-law/version acceptance and experienced-event-based trust updates; explainable utility components with provisional tunable coefficients, not global decree multipliers.
- New v3 replay/clock semantics for dawn notices and deterministic, seed-fair scarcity allocation; preserve v1/v2 saves and golden results.
- Actual patrolling guards only; bounded detection of completed prohibited actions and **non-monetary warnings only**. No passive enforcement, fines, automatic sanction or fabricated inability-to-act charge.
- Four scoped increments with 200+ matched-seed tests and confidence intervals. No claim of calibrated human behaviour or campaign difficulty.

**Economy and balance remain OPEN:** timber is unsold in current fixture, and six citizens cannot afford food late in the 12-day reference run despite market stock. A timber procurement and maintenance loop must be explicitly funded/ledgered and separately agreed; do not silently add money, food or a buyer. Food access metrics must distinguish shortage from unaffordability and delivery limits.

**Additional technical debt:** propose a lightweight CI workflow; benchmark growing event/save size; physical Android/iOS tests and Junior playtesting remain pending.

### Task 03 implementation · v3 autonomous society

- Save schema 3 adds a dawn phase and a canonically generated contact ring. One roll per citizen/law/version uses public bulletin reach plus up to one attributable prior-day peer source, capped at 10,000 basis points. Dawn notices take effect that morning. Patrol education can teach by the next day. The v1/v2 codecs, timing and golden digests keep their historical meanings.
- The v3 turn model uses separate seeded lotteries by phase and resource. Within a slot the production, delivery, patrol and rest groups have a fixed execution order. Within each contested group, eligible actors are ordered by the resource draw, with ID used only for an exact tie. Meals, wages and producer sales have independent resource keys. Contention evidence links applicants and winners to the ledger outcomes. A rotating queue remains an alternative if playtests favour predictability.
- Feasible choices record base weight, disposition, perceived pressure, income and need, fatigue, trust, acceptance and warning-risk components. Per-version attitude initialization uses a notice plus personal opportunity, expected workload and disposition. Dusk trust follows actual meal access and warning experience. Experienced exertion adjusts the perceived version's attitude with the action ID as evidence. The confidence intervals do not validate these as models of psychology.
- Completed patrols open a bounded number of encounter attempts on the public work route. Each performed and currently prohibited public act can receive one attempt, with no self-investigation. Detected acts receive education or a non-monetary warning. The actor can remember their own recent formal warning as evidence for risk. More granular route allocation and differentiated responses to warning fairness need product review.
- The existing ledger has no timber buyer. Report inability to pay, market stock and undelivered producer stock separately. Campaign thresholds and all behavioural, enforcement and economic settings remain provisional. See the [Task 03 engineering report](09_Task_03_Engineering.md) for the matched-seed study, tests and open choices.


## Task 04 — first playable mobile web shell · 21 November 2026

**Status:** Design proposal published for owner review after PR #9 was merged. See [Task 04 contract](10_Task_04_Playable_Shell.md). The player-visible scope is observe → compose/confirm → advance → inspect → revise, backed by the actual v3 world, not simulated UI values.

**Proposed implementation choices, subject to design review:**
- One accessible portrait-priority React/Vite UI with Home, Village, Decree Book, Composer, Day Results, factual Gazette and Inquiry. Use generic labelled placeholders; adviser humour, canonical art and media sharing remain Task 05.
- Start menu contains Junior/Full × Campaign-preview/Sandbox-trial combinations; all share v3 law semantics and the existing **12-day** fixture. Do not claim full campaign progression, balanced objectives or unlimited sandbox until Task 06.
- Browser committed snapshots use a versioned IndexedDB adapter with revisioned atomic writes, last-good recovery and independent uncommitted drafts. Current Task 00 localStorage fixture test is *not* an adequate large-snapshot storage strategy. Native storage remains an adapter seam.
- Royal Inquiry and other output must be grounded in actual law/action/notice/transaction/investigation IDs. Never infer causes unsupported by evidence, conflate legal knowledge/acceptance/compliance, or label detected educational encounters as formal warnings.
- Minimum 320×640 and 390×844 tap-first tests, accessible full-screen composer/confirm, safe areas and ≥44px controls. Actual Android/iOS Safari/Chrome device checks remain unverified until run.

**Carry-over bug:** PR #9's merged code still conflates \`education\` and \`warning\` in remembered effects/experience labels; 256-seed +45.75pp claim is not a true prior-knowledge-warning cohort. Tracked as [issue #10](https://github.com/thenurts/rulecraft/issues/10). Correct before publishing player-visible enforcement claims. Historic v1/v2 hashes stay protected; if changed v3 model produces new hashes, document/version explicitly.

**Other open choices:** production map/art, native packaging, full campaign balance and timber-funded income, full-history save scalability, Android/iOS physical validation and playtesting with children.


### Issue #10 · Education and formal warnings

- New society snapshots use schema 4 with engine `headless-society-v2`. Education is an observation and a notice for the next day. It records a zero-delta `patrol-education` experience. Only a typed formal warning can apply `warningTrustLoss`, contribute a `patrol-warning` experience, or be remembered for `warningRiskWeight`.
- Formal warnings still require a performed prohibited action, the current prohibition and a completed patrol. The disposition records current knowledge and does not assert intent. Education or warning events are always labelled by their disposition.
- Existing schema 3 checkpoints replay with their historical semantics and hashes. The corrected v4 runner and matched pre-informed warning study supersede the prior reporting. See the [updated engineering evidence](09_Task_03_Engineering.md).

### Task 04 implementation · browser shell

- The four preview starts all use the same v4 society fixture and seed. Junior exposes one optional clause and Full exposes both. Mode and track are saved with the village. New decree IDs use a stable sequence within the village so command identifier randomness does not alter the named awareness draws. Command IDs remain unique for retry safety.
- IndexedDB stores the latest complete world and a last-good previous generation in one transaction. A same-transaction revision check rejects stale writers. The independent draft store is isolated from the world. A worker encodes and verifies engine snapshots. Existing v3 saves keep their stored simulation version when opened and advanced.
- The shell reports a change only after commit. Before committing a day, the user can cancel from the advancement prompt. The day and its recorded consequences appear together after storage confirms. Gazette and the Royal Inquiry show typed legal, choice, resource and enforcement evidence. Patrol education and formal warnings use the recorded dispositions.
- This is a local 12-day preview, with one active village per origin. Multi-profile saves, export and native lifecycle adapters remain future work. See the [Task 04 report](11_Task_04_Engineering.md).


## Task 05 — grounded advisers, incidents and sharing · 21 November 2026

**Status:** Design proposal for owner review. PR #14 Task 04 implementation is merged; the first mobile web trial is playable locally. See [Task 05 narrative/adviser contract](12_Task_05_Narrative_Advisers.md).

**Preserved confirmed product direction:** Zoey covers economy, Liam safety/enforcement, Mia creativity/surprising behaviours, Noah wellbeing. The Gazette/Chronicle/incident card must give cheeky, meaningful reactions to **real logged village events**, not invent causal mechanisms, finances, actions or emotions. This narrative milestone must not modify the simulation's world state or alter v1–v4 replay and resource checks.

**New proposals pending product-owner sign-off:**
- Read-only typed incident projection with verified source events, law versions, eligibility predicates, severity and explicitly distinguished *direct evidence vs contextual coincidence*. Minimum four **reachable** families; negative test for each. Exclude export/rental/fine/population-psychology stories unless actually simulated.
- Multiple distinct, fact-safe templates for each adviser, Junior/Full wording profile, short optional citizen-aside **stylised captions** (not attributed actual speech).
- Stable seeded/typed content IDs, deliberate incident priority, at most three selected headlines per day and three-day identical-template cooldown **PROPOSED**. No forced jokes for quiet days or suppression of severe welfare events.
- Deterministic Chronicle based on immutable historical event records; version or freeze narrative copy/template mappings to avoid arbitrary rewording of old stories across app upgrades. No write-back to the society engine.
- Fact-checked portrait **1080×1350 PNG** local share-card export **PROPOSED**; correct or explicitly absent source law, actual outcomes, validated adviser line, no user/child identifying data, no remote upload.
- Keep phone-optimised and screen-reader-aware event drill-down, with actual Android Chrome/iOS Safari export QA reported separately from desktop emulation. Owner should assess genuinely amusing storytelling and not equate passing text validation tests with game quality.

**Related independent follow-ups:** the current production build has no verified stable hosted URL; assess an access-controlled HTTPS staging preview before remote physical phone testing (separate permission/release gate). The Task 04 320px/200%-text composer screenshot shows selected value truncation and heading split; improve legibility in a narrow UX issue. Neither authorises public release or Task 06 expansion.

### Task 05 implementation · evidence-bound narrative

- The DOM-free web projection reads recorded events, notices, investigations and decree versions from the loaded engine. It leaves simulation, save and ledger schemas alone. Missing or inconsistent witnesses suppress the story and produce diagnostics outside player copy.
- The global registry is fixed at `village-record-1` for existing and new saves. It covers detectors, ordering and templates. Task 05 adds no narrative metadata to the world snapshot. Before introducing another catalogue, establish and test a backwards-compatible policy for choosing the content version of each save.
- Priority starts with meal shortfalls, followed by formal warning, education, competing duties, patrol capacity, fatigue and completed meals. A separate FNV-1a selector breaks ties and rotates copy using the version, saved seed, day, family, primary witness and draw purpose. Selection allows three headlines per day and one per family. Four truthful headlines per family give a daily welfare finding room to rotate while leaving three complete days between reuses.
- Gazette and Chronicle open the existing Inquiry records. Adviser names use text treatment. Storybook captions are labelled and optional. The local portrait PNG and selectable text use one fact-checked content model, including an explicit village report when there is no directly linked decree. Multiple linked versions retain their individual wording and status. If they cannot fit in a PNG, the complete text opens as the fallback.
- Voice, priority, rotation and share-card treatment remain open for playtest and owner review. The [engineering report](13_Task_05_Engineering.md) records the coverage and device limits.


### Task 06 research proposal · compressed browser saves

The research adapter keeps engine bytes and schema versions intact in a separate, versioned binary envelope. It verifies legacy or compressed current and previous records, with isolated browser tests for rollback and historical provenance. Review the storage savings separately from replay latency. Any production migration, rollback path or longer Sandbox horizon requires its own approval and physical browser checks. [Compressed save research](18_Compressed_Save_Research.md)


## Task 06 — real Junior/Full profiles, Campaign/Sandbox and first-playable validation · 21 November 2026

**Status:** Design proposal for owner review following verified merge of PR #19; no Task 06 implementation started. See [Task 06 design contract](14_Task_06_Modes_Campaign_Sandbox.md) and [original task](../tasks/06_modes_campaign.md).

**Confirmed product direction preserved:** one shared typed law/citizen/economy engine; Junior and Full alter exposition, guided learning, vocabulary exposure and explicitly configured scenario complexity—not legal meaning. Campaign has genuine objectives/progression, while Sandbox has no imposed victory condition and is a space for experiments. Player controls remain law-making, time progression, inspection and new-game setup; no direct citizen micro-management, off-ledger subsidies or fictional narrative events.

**New proposals requiring owner approval:**
- Versioned, validated \`ModeProfile\` and \`ScenarioDefinition\` registries, persisted profile/scenario/seed metadata and safe legacy-preview handling. Do not silently convert v3/v4 engine saves or change older narrative templates.
- Junior staged typed grammar and understandable, causally grounded hints; Full expanded supported grammar/metrics. No “Junior” badge alone presented as genuine different difficulty; make tested starting pressures/objectives and comprehension distinct.
- The Hungry Village must be a *strategically viable* scenario. The original 12-day ≥90% fed citizen-days and ≥40 market-food targets remain hypotheses: run 256+ seed no-law and 3+ legal-strategy comparisons, report effective decisions, food poverty and supply, confidence intervals, then a separate seed holdout before setting actual thresholds. Do not retune away problems or invent a timber buyer without approval and ledger changes.
- Sandbox supports seed, actual preset data and zero campaign win/fail. A 12-day fixed trial is **not open-ended**. Longer experiments are conditional on demonstrated save/replay/storage performance; do not label a capped sandbox unlimited. Any continuation must be versioned/replayable rather than silently changing historical fixture duration.
- Separate **engineering-ready** and **first-playable product validation** gates. The latter requires real Android/iOS browser checks and age-appropriate Junior / first-time Full human playtests, with truthful sample results. Automated desktop tests cannot validate enjoyment, accessibility or actual devices.
- Full BUILD-01–24 evidence matrix with Pass/Fail/Not Yet Tested, preservation of v1–v4 digests and Task 04/05 gameplay, Chrome/Safari and 200% text assessments.

**Still-open dependencies:** [private staging and physical phone test issue #16](https://github.com/thenurts/rulecraft/issues/16); [320px enlarged composer accessibility issue #17](https://github.com/thenurts/rulecraft/issues/17); 12-day dual-generation save growth; foresters lacking a timber buyer; narrative catalogue currently globally pinned to \`village-record-1\`; native packaging and compliance outside Task 06.

### Task 06 research proposal · Hungry Village introductory mission

- Consider a guided distribution puzzle on the research fixture `five-merchants-farmers-v1`. The 128-seed independent holdout verified the delivery benefit and found that a distinct rest duty reduced fatigue blocks at the cost of meals. A late delivery duty showed scope for recovery after the day-six teaching checkpoint.
- Use fully fed resident-days as the proposed primary outcome with separate supply, affordability and repeated-hardship diagnostics. The tutorial format, preset, thresholds and separate Junior severity remain subject to review and real playtests. [Introductory mission design and evidence](17_Hungry_Village_Introductory_Mission.md)

### Task 06 first playable · implementation decisions

- New starts use setup metadata version 1 in the same atomic IndexedDB record as the plain canonical snapshot. The profile, scenario and preset are fixed for the lifetime of a village. Legacy previews retain their existing behaviour when setup is absent.
- The Hungry Village uses the approved Five Merchants fixture for both profiles. Day six teaches observation and revision, and day 12 accounts for actual food access. The only modern completion condition is reaching the preset's day limit. Repeated hardship is reported as a diagnostic.
- Junior Campaign introduces the optional clause after completing day six. Junior Sandbox offers one optional clause from the start with all supported predicates. Full offers both clause types. The rule interpreter is shared.
- Sandbox has two versioned 12-day presets. A retry is a new village and needs explicit replacement confirmation. Actual phone and novice playtests remain separate gates. [Implementation report and acceptance matrix](19_Task_06_First_Playable_Engineering.md)

### Task 06 review fix · save-identity guard

- The canonical snapshot checksum verifies simulation history. To identify a setup-less historical browser preview, the loader checks v3/v4, the original fixture, default society and law settings, and the shipped preview UI's fixed seed 42.
- Versioned generations use an outer `sessionFormat: 'scenario-v1'` marker alongside their setup. Missing setup on a marked generation or an unknown marker triggers the existing verified-generation recovery path. Loading is read-only.
- A standard Sandbox and a legacy preview are indistinguishable when both outer identity fields are absent and the seed, fixture and settings are identical. An unmarked modern record with intact setup still opens and is marked on its next commit. [Post-review validation and caveat](19_Task_06_First_Playable_Engineering.md#post-review-correction--save-identity-and-legacy-preview-recovery)
