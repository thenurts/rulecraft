# Rulecraft — Task 05 Narrative, Advisers, Gazette, Chronicle and Share Card

**Status:** Design proposal for product-owner review, not implementation authorisation
**Date:** 21 November 2026
**Prerequisite:** Task 04 playable-shell PR #14 merged. New games use v4, historical v3 continues with its original rules. Preserve all existing headless replay, ledger, legal and save contracts.

**Source contracts:** [Master GDD](01_Master_GDD.md) §§3, 6, 9, 11–12; [Technical Systems](02_Technical_Systems.md) §§10, 13, 15; [Vertical Slice](03_Vertical_Slice.md) §§8–11 and BUILD-15/16/23; [Task 05](../tasks/05_comedy.md); [Task 04 implementation report](11_Task_04_Engineering.md); [repo instructions](../AGENTS.md).

## 1. Why this milestone exists

Task 04 proves the simulation can be *operated* on a touch screen. It does not yet make emergent consequences vivid, emotionally legible or memorable. Task 05 must turn **real recorded simulation outcomes** into brief, truthful, characterful, sometimes funny *stories* that lead players back to understanding and rewriting laws.

Product test: after advancing a day, a player should be able to answer **what happened, why it was surprising, which factual evidence supports it, and what they might try next**. The game should not simply wrap database rows in decorative jokes.

**Do not change** food/timber/coin flows, citizen psychology, patrol detection, knowledge, decree grammar, world checksums, campaign scoring or turn ordering for narrative convenience. Narrative is a **read-only projection** of actual simulation state/events. There is no new citizen speech or emotions system in this milestone. No factual claim may rely on an unimplemented action, resource, motive, institution or economic trade.

Target player-facing features:
- Royal Gazette becomes an engaging, finite prioritised set of **grounded incident cards** with clear click-through inquiry; full factual action and investigation logs remain available.
- Four The Nurts advisers: Zoey (economy/science), Liam (security/operations), Mia (creativity/eccentric adaptations), Noah (welfare/social trust). Each offers a distinct lens, not four contradictory interpretations or four separate AI agents.
- Short **citizen-aside captions** tied to observed acts, clearly presented as stylised flavour writing rather than transcripts or an additional simulation event.
- A persistent-by-derivation **Royal Chronicle** of noteworthy days/incidents with filtering/previous-day navigation and explicit law-version links; multiple stories in a save do not vanish arbitrarily as the UI re-renders.
- A factual, **locally exportable PNG share card** containing “MY DECREE / WHAT HAPPENED / ADVISER VERDICT”, with optional scenario/day and non-identifying metrics.
- Both Junior and Full display the *same underlying facts* with different reading density/word choice. Do not infer a person's intent, moral fault or emotional state from a decision-weight draw.

No generative API, social login, analytics, public feed, cloud storage, share-to-social integration or canonical The Nurts art needed to satisfy this milestone.

## 2. Evidence contract and exact distinctions

Every incident candidate is a typed, versioned record with:
\`\`\`ts
type Incident = {
  id: string;                    // stable within a save, not React render order
  narrativeVersion: string;      // content/template family version
  family: IncidentFamily;
  turn: number;
  headlineTemplateId: string;
  adviserId: 'zoey'|'liam'|'mia'|'noah';
  adviserTemplateId: string;
  summaryFacts: readonly TypedFact[];
  witnessEventIds: readonly string[]; // directly witnessed factual source(s)
  lawVersionRefs: readonly {lawId:string;version:number}[];
  relatedEventIds: readonly string[]; // qualified context, not presumed causes
  strength: 'direct'|'contextual';   // evidence standard for wording
  salience: number;                 // ranked from recorded facts
}
\`\`\`
This shape is illustrative: define stable parsed types and validators in code. Never accept arbitrary user/network event IDs as trusted rendered content. Templates interpolate **only allowlisted numeric/enum/string facts** from verified records, with escaped output (no player-supplied HTML, code or unfettered text).

**Direct evidence:** an act's actual/perceived ruling, decision pressure, attempted/completed status, patrol encounter/disposition, funded/unfunded meal, transfer legs, legal notice and logged fatigue change. These may support an explicit mechanistic explanation *to the recorded granularity*. **Contextual co-occurrence:** “the market held food while a citizen could not afford a meal” is supported by a meal event with \`fundingShortfall>0\` and \`marketAvailableBefore>0\`; that is **not** proof a decree uniquely caused poverty. Same-day decline in trust and new laws is not automatically causal. No retrospective emotional attribution or fictional “villagers revolted”, “guards fined”, “exports boomed” or “scientists discovered” narratives.

**Provenance:** \`witnessEventIds\` must resolve to existing \`VillageEvent\`, \`Investigation\`, \`NewsEvent\`, \`LawVersion\` or \`LawNotice\` records with the same day/law identities. Each card's primary **Investigate** action opens actual Royal Inquiry evidence and displays any other witness IDs; no dead-end or synthetic IDs. For metric-derived headlines, cite the contributing \`resident-meal\`, \`patrol\`, \`harvest-food\`, \`market-delivery\` or similar event(s), not only a day-total counter. A summary statistic with no linkable event witness cannot become an incident.

**Legality and intent:** distinguish current legal status from a citizen's perceived version; attempted/blocked action from completed action; an educational encounter (\`disposition:'education'\`) from a formal warning; a known prohibition from an unrecognised one; market stock shortage from insufficient purchasing funds; potential legal conflict from actual competing feasible duties. Never describe a person as disobedient, lazy, lying or malicious just because a seeded choice went another way.

**Save versions:** v3 historical files must still run historical v3 mechanics, v4 files corrected mechanics. Derive narratives from actual saved records and typed disposition, not an assumed global engine version. Do not rewrite historical law/events to fit new copy. Preserve the v1–v4 golden runs, and do not change simulation state or hashes merely by opening the Gazette or exporting a card.

## 3. Event family taxonomy for the actual 12-day engine

Start with **at least four independently reachable, tested families**; the suggested catalogue below prioritises what v4 already records. For each family define: typed eligibility predicate, observable metrics, witness selector, salience, allowed headline/adviser statements, prohibited interpretations and negative fixture. A family may return no card even if one broad daily metric is nonzero.

| ID | Actual evidence predicate | Allowed narrative; caution |
|---|---|---|
| \`MEAL_UNAFFORDABLE\` | One or more \`resident-meal\` events with \`foodAccess.fundingShortfall>0\` and \`marketAvailableBefore>0\` | Some residents could not pay even though food was there at the time. Do **not** claim the food was hoarded, that any decree caused this, or that food was physically unavailable |
| \`MEAL_STOCKOUT\` | One or more funded meal attempts with \`foodAccess.supplyShortfall>0\` | Residents able to pay still went without because the market ran out. Producer stocks can be shown only as separately observed context |
| \`EDUCATED_AFTER_PUBLIC_PROHIBITION\` | \`Investigation.disposition==='education'\`, linked performed prohibited act, completed patrol and current-law/version ignorance | Citizen learned about a rule after an encounter. Never call it a formal warning or willing defiance |
| \`FORMAL_WARNING\` | \`Investigation.disposition==='warning'\`, \`act.knewCurrentVersion===true\`, relevant completed patrol and prohibition | A formal warning was delivered. Avoid invented fines, arrests or intent; any later restraint must have its own evidence |
| \`PATROL_CAPACITY_GAP\` | Public, completed prohibited acts and lower actual eligible investigations in relevant slots with recorded patrol capacity; enumerate missed public acts | Guard coverage was limited; never describe at-home violations as observable public patrol misses, or confuse non-detection with no investigation |
| \`FATIGUE_BLOCKED_WORK\` | Recorded \`not-feasible-at-selection\` or \`blocked-at-execution\` work event with \`reason==='fatigue-limit'\` | A worker could not take/complete that occupation's work. Do not say “they refused” |
| \`COMPETING_KNOWN_DUTIES\` | One actor/slot has >1 *feasible perceived* \`required\` duty outcomes with distinct applicable law refs | Competing obligations were observed. Do not infer an impossible assignment from mere \`POTENTIAL_CONFLICT\` warnings |
| \`FOOD_ACCESS_SUCCESS\` | Day metrics and corresponding completed meal events support unusually strong or improved feeding (with correct denominators) | Positive/surprising outcome, not proof that a particular law caused it |
| \`TIMBER_WITHOUT_BUYER\` | Real owner timber inventory and lack of recorded timber sale/payment in v4, appropriately bounded by observation | A forester has timber but no current market income mechanism. Do not invent refusals by non-existent buyers |

**Explicitly disallowed until the engine models them:** \`EXPORT_WHILE_SHORT\`, umbrella rentals, new building construction, police fines, international trade, public protests, morale/happiness changes, actual recorded conversations, real migration, scientific discoveries and any “law produced X bonus” incident. “Beneficial absurdity” is a future family unless a specific, testable and supported positive mechanism is demonstrated.

Coverage requirement: for a deterministic demonstration seed and at least 32 additional varied seeds, measure the frequency/variety of actual eligible families, zero-incident days, duplicate copy and selected advisers. **Do not fabricate a story to achieve a count quota.** If nothing notable happens, show a sincere factual Gazette (“A quieter day in the village”) and offer the ordinary unfiltered log, without presenting that filler as a sourced incident.

## 4. Narration engine, repetition and content stability

**Placement:** create a pure, DOM-free narrative projection module (e.g. \`packages/narrative\` or a pure \`apps/web/src/narrative/\` module), separate from the society executor and React components. It reads \`SocietyGame\` and current mode, returns structured validated incident records, rendered copy, display order and links. It must not call \`confirmLaw\`, \`advanceSociety\`, ledger writes, real-time entropy or wall clock. Repeated renders and app reloads yield the same cards.

- **Selection:** derive candidates from factual events; sort using stable, documented keys (e.g. severity/salience → day/family/event ID); use a *separately namespaced deterministic* tie/variant selector keyed by saved seed, turn, family, source event identity and narrative content version, not \`Math.random\`, \`Date.now\`, UI render order or unversioned browser UUID.
- **Cooldown proposal:** max **3 prioritised incidents per completed day**, max **one top-ranked per family/day**, and at least **3 complete days** between *repeating the same headline template*; allow related factual events in the full log even when a headline is suppressed. Test that a cooldown cannot hide the only serious welfare incident unless a reviewed policy explicitly permits it. When necessary, use a different truthful template instead of suppressing urgent information.
- **Adviser proposal:** select a primary lens from the incident's facts, not arbitrary round-robin whenever that would create a nonsensical adviser. Distinct voice should drive *how* the response is worded; all still acknowledge the same facts. Each adviser has **at least three distinct, independently fact-safe templates** across reachable families, with positive and cautionary options. A secondary adviser response can show a different supported framing, not invent a disagreement.
- **Versioning:** publish a \`narrativeContentVersion\` and a stable incident/template registry. For long-lived Chronicles, treat initial template selection as immutable for a given content version and save. On copy updates, preserve older template registries or perform an explicit tested narrative migration; do not silently rewrite old saved incidents after updates. Existing Task 04 saves have no narrative metadata: assign a documented default on first narrative load without modifying society events.
- **Chronicle:** deterministic list of supported incidents over all completed days with day, family, headline, links to actual decree versions and Inquiry. Filtering can be local derived state; no server or second world. On 12-day save/reload, the same stories and template IDs must appear in the same order.
- **Graceful failure:** unresolved/invalid witness → suppress the specific incident and log a safe diagnostic in non-player output; do not output fictional fallback text. Do not crash Village, decree authoring or turn progression when narrative selection/rendering/export fails.

## 5. Four advisers and visual treatment

| Adviser | Point of view, factual source | Example *permitted framing* under a matching witness |
|---|---|---|
| **Zoey** | Economy, coin flows, stock, delivery and trends | “The market had food. The missing ingredient was purchasing power.” (only where \`fundingShortfall\` and \`marketAvailableBefore\` support it) |
| **Liam** | Completed patrols, observed public offences, notices, staffing limits | “The patrol met the lawbreaker. The lawbreaker met the law—for the first time.” (only after real \`education\` event) |
| **Mia** | Odd patterns and contradictions in recorded behaviours, playful what-ifs clearly labelled speculation | “A decree can be crystal clear on paper and still surprise everyone in practice.” (linked to a real legal-belief/action divergence, not an invented adaptation) |
| **Noah** | Meal access, hunger, fatigue, trust and individual welfare | “There was food on the shelf, but not enough coins in everyone's pocket.” (when the per-meal funding evidence supports it) |

These are **candidate voice examples**, not approved lines that must appear regardless of eligibility. Keep jokes warm, specific and brief; avoid scolding or making hardship the punchline. Junior dialogue uses accessible shorter phrases, optional explanation of terms, and no cruel ridicule; Full can use more layered but still factual banter.

**Art:** no automatic canonical characters. Use generic silhouettes, name tabs/typography or explicitly labelled provisional adviser avatars. Real The Nurts designs and approved logo must be supplied and signed off separately. Avoid approximating remembered/adapted canon. Visual effects may show an *already supported fact* (food unit icon, exhausted-work badge) but not a fabricated animation (“guards chased a villager”) if no such action exists.

**Citizen asides:** choose very short **non-canonical storybook captions** attached to observed event IDs, never literal transcript evidence (“Citizen 6 said…”), emotionally diagnostic claims, or unmodelled citizen speech. They do not become new causal events or affect utility.

## 6. Gazette and Chronicle experience

- Immediately after Advance Day, show a **single strongest grounded headline** (when eligible) above existing factual results, plus a “Why did this happen?” tap target taking users to the right Inquiry witness; do not hide the core metrics or block the next decree.
- Gazette shows maximum three narrative cards/day with adviser name and evidence badge/phrase, day and short headline; offer **View evidence**, **See all factual records**, and **Add to share card** (or open card) actions. Never replace the existing unfiltered factual log with stories only.
- Chronicle lists all selected incidents from prior days in stable order, compact filters by day/family/adviser, and explicit links to historical law versions; it must distinguish currently operative and historic laws.
- The multi-column desktop grid is secondary; 320px narrow mobile and 200% text must show full headline, selected values and export actions. Address the known Task 04 clipping/truncation follow-up as a separate accessibility issue, not as a narrative-only CSS change.
- On a very uneventful day, use honest empty-state copy and no forced adviser joke. When several serious findings compete, welfare/safety facts must remain accessible regardless of comedic priority.

## 7. Fact-safe share card and local export

**One minimum card format:** portrait PNG, **1080×1350** proposed (4:5) plus a smaller/accessible on-page preview and text alternative. Content:
1. **RULECRAFT — THE VILLAGE RECORD** (not an unapproved Nurts logo).
2. **MY DECREE**: actual related law text/version, or **“No decree directly linked”** if the incident has no evidenced relevant law; do not invent a decree merely to fill the template. If the source law was repealed, show *historic version and status at the time*.
3. **WHAT HAPPENED**: factual incident with relevant number/denominator and day, supported by witness IDs.
4. **ADVISER VERDICT**: one eligible, fact-validated adviser line.
5. Footer: simulated scenario/trial disclaimer; optional non-identifying seed or incident code, no profile name.

**If the incident has no defensible linked decree**, either render a truthful alternate “Village report” layout or disable this particular three-panel decree share card with a clear reason; do not attribute the event to whichever law was last edited.

Generate locally with a browser PNG-capable adapter (Canvas or similarly portable approach); no upload, third-party rendering, social API or network required. For cross-browser test Safari/iOS image save paths and local downloads; preserve a text-only copy fallback if native download is unsupported, clearly disclose what succeeded. Any card generated must refer to a real incident ID and version; no identifiable children or real player names, no analytics/telemetry. Be careful about canvas tainting and browser memory.

**Export acceptance:** Playwright verifies downloadable PNG magic bytes, supported canvas dimensions, that displayed text and rendered PNG are derived from the same validated content, no player/session identifiers in visible or embedded data (other than optional non-identifying seed/incident reference), no remote requests, and accurate handling when an unsupported browser cannot download. Physical iOS Safari and Android Chrome remain **Not Yet Tested** until actually used.

## 8. Four implementation increments, with gates

### Increment 1 — Narrative truth and incident registry
- Add pure fact extractors, typed eligibility predicates, stable incident IDs, required witness validation and allowed statements for at least four verified reachable families. Produce fixtures demonstrating each family and negative near-miss cases.
- Run deterministic 12-day seeded samples and ≥32 extra seeds; report frequency, no-incident days and excluded invalid narratives. Do not set a required joke count.
- Unit tests: fabricated exports/fines/emotions blocked; education vs warning; out-of-stock vs too-poor; inapplicable/repealed law; competing duties; no patrol; no conservation/hash modifications.

### Increment 2 — Adviser lenses, variant selection and controlled humour
- Four voices with >=3 supported variant templates apiece across valid families; Junior/Full wording profiles and short stylised citizen asides.
- Stable ranking, per-template cooldown, no false causal attributions; copy library versioning. Add test that identical save/reload returns byte-identical rendered narrative (or content ID equivalent).
- Record content examples and editorial review findings; no use of unapproved canonical art. If the data cannot support a planned gag, cut the gag.

### Increment 3 — Gazette, Chronicle, Inquiry integration and share card
- Render story headlines after each day, fact-accurate Gazette and browsable Chronicle, with evidence and law-version drills. Preserve factual logs and fast turn/decree flows.
- Implement one in-browser downloadable PNG and accessible text-only equivalent; factual decree/action/quote all share the same validated record. No cloud/social posts or app-store integration.
- Tests of link integrity, PNG encoding/export, privacy and failure paths. Maintain two-generation IndexedDB save contract; derived narratives need no simulation mutation.

### Increment 4 — Coverage, UX QA, real-device status and product review
- Run existing 132 unit and 16 browser tests plus new narrative suites and browser export/Chronicle tests; record actual totals, commands, CI and v1–v4 golden hashes.
- Capture screenshots at 320px/390px and 200% text; no unlabelled truncation, clipped important copy or hover-only action. Record screen-reader semantics/keyboard focus. Real Android/iOS tests if accessible, otherwise **Not Yet Tested**, and explicitly measure share/export behaviour and performance where performed.
- Report coverage by family/adviser/template, repetitions per 12 days, major false-positive/near-miss examples, empty days, export byte size, load/turn/render changes and known creative limitations.
- Product-owner review to determine whether humour is good rather than merely valid. Do **not** merge the implementation PR or begin Task 06 without review.

## 9. Acceptance bar and unresolved decisions

- [ ] At least 4 **reachable and fact-proven** incident families; source event IDs always resolve and the displayed factual count/status matches saved records.
- [ ] All four advisers are distinctly voiced, with >=3 supported variant templates each and no contradictory/fabricated claims; at least one *true success* story if a justified positive event can be demonstrated, otherwise disclose lack of supported positive family.
- [ ] No fabricated exports, rentals, fines, crowd moods, causal link, law licence, currency flow or additional world state.
- [ ] Deterministic incident/variant selection for identical saved inputs; Chronicle stable across reload and documented template-version changes. No society hash, decree or ledger mutations caused by narrative rendering.
- [ ] Junior and Full use the same facts/law interpretation. Junior language accessibility and humour effectiveness remain human-playtest questions until tested.
- [ ] No literal attributed citizen speech; only labelled stylised asides based on real events.
- [ ] Gazette and Chronicle present actual linked evidence and retain unfiltered factual logs.
- [ ] A factual PNG card can be exported locally with accurate law/version/day/facts, zero user-identifying data and graceful failure handling; iOS/Android save behaviour clearly marked per test evidence.
- [ ] No regression in all Task 04 UI, save/recovery, replay, audit, 320px touch operation and CI.
- [ ] 12-day/32-seed narrative coverage and repetition report with qualifiers, editorial examples and screenshots.
- [ ] Implementation PR opened for product-owner review; Task 06 not started.

**Explicit owner-review choices:** provisional editorial voice examples, family priority, up-to-three per day, three-day same-template cooldown, 1080×1350 card, simple stylised captions, and narrative content versioning approach. Treat these as proposals, not independently authorised production policy.

## 10. Related, separate work

- **Mobile access/distribution:** existing app is not confirmed to be hosted at a stable HTTPS URL. Local Wi-Fi production-preview testing is supported; staging deployment requires an explicit private-access, security and origin/persistence decision. Do not make the private repository's playable prototype public by default.
- **Task 04 enlarged-text UX:** the actual 320px / 200% screenshot shows a mid-word title break and select value truncation despite passing horizontal-overflow checks; fix and add legibility-specific checks independently.
- **Task 06:** validated campaign/Junior objectives, sandbox presets, long-run save scaling, real-device performance and playtesting remain out of Task 05's narrative-content contract.
