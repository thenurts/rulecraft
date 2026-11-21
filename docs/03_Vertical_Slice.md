# RULECRAFT
## Vertical Slice Build & Acceptance Specification

**Version:** 0.6 | **Status:** Prototype implementation plan | **Date:** 21 November 2026  
**Related:** Master GDD v0.6; Technical Systems Specification v0.6

> **Read first:** This is a *first-playable vertical slice*, not the complete first commercial release. **CONFIRMED** design requirements come from agreed Rulecraft direction. Everything labelled **PROPOSED**—especially balances, assets and performance budgets—should be entered as data-driven configuration and tuned in prototypes rather than hardcoded as permanent game truth.

# 1. Prototype purpose, hypothesis and exit gates

**Central hypothesis:** A player can enjoy repeatedly writing, amending and abolishing typed laws, watching independent citizens react, understanding the causes of surprising outcomes, and producing amusing shareable incidents—without any direct management controls.

**What must be demonstrated:**
1. One shared engine serves both Junior (7–12) and Full modes with different UX/content configuration.
2. Player commands are limited to legislation, inquiry, navigation and turn progression.
3. Citizens choose actions probabilistically from needs, opportunities, legal awareness and enforcement; behaviour is reproducible using a seed.
4. Goods and coins move by explicit ledgered events; no spontaneous unlogged resources.
5. Law revisions and abolitions affect future legal evaluation, not past history.
6. Four advisers report true, causally supported facts with frequent, varied humour.
7. The same scenario can be replayed with a different law strategy and produce materially different outcomes.

**Out-of-scope for this slice:** multiple towns, population cohorts in production, complex taxes/subsidies, elaborate culture and diplomacy, combat, space setting, procedural dialogue generation, user-entered free-text execution, multiplayer, extensive character animation, commercial purchases and public account features.

## Mobile-first prototype delivery contract

**Confirmed:** design the first playable for smartphone touch use. Web hosting may be used for the prototype, but it must run on real Android and iOS phone browsers and preserve a practical path to later packaged apps. Desktop is a secondary access mode, not the primary layout target.

**Build requirements:** support all core flows through taps and scrolling without typing, hover or drag-only gestures; use a narrow-screen-first layout with expandable vertical decree clauses; respect notches/system safe areas; preserve legibility at common phone widths and text scaling; show one clear primary action per screen. A portrait-priority layout is proposed, but landscape must remain usable unless a later orientation policy is approved.

**Persistence requirement:** a reload or app/background interruption cannot partially commit a turn. Save enacted decrees and resolved turns atomically; preserve or safely discard a separate uncommitted draft with explicit user feedback.

**Portability boundary:** use platform adapters for saves, local image export/share, lifecycle and assets. Native Android/iOS packages, app-store compliance, native notifications and native monetisation are future release tasks, not slice acceptance requirements. Select runtime after a cross-device technical spike.

# 2. Minimum world fixture — PROPOSED

**Setting:** A whimsical village, one field area, one finite forest, one market, one granary/store, one guard station, and homes represented by population records. Citizens are adult agents in the first simulation; demographic dependants can be layered later.

| Parameter | Prototype default | Rationale |
|---|---:|---|
| Citizens | 40 | Small enough to trace individual decisions |
| Farmers | 16 | Main food production |
| Foresters | 6 | Timber production and regeneration constraints |
| Merchants | 10 | Food distribution, simple local/external trade |
| Guards | 8 | Patrol capacity and law enforcement |
| Daytime action slots/day | 2 | Supports “whenever awake” and competing duties |
| Scenario length | 12 days | Fast consequence cycles in first campaign mission |
| Legislative changes/turn | 2 | Balancing hypothesis, configurable |
| Max active laws | No gameplay cap | Performance limits must still be tested |
| Initial food in market/granary | 45 units | Visible urgency while buying time to respond |
| Initial harvestable field stock | 450 units | Bounded resource source for harvest actions |
| Initial forest stock | 120 units | Renewable but non-infinite resource |
| Initial village market coins | 200 | Market has working capital |
| Initial treasury coins | 500 | Allows initial salary/enforcement operations |
| Initial citizen coins | 20 each | Enables first-day household purchases |

**Balance note:** Values are deliberately simple fixtures to be simulated and tuned. A working slice must not accept these numbers as final until it runs automated Monte Carlo tests and child/adult playtests. It must be possible to edit them in scenario JSON without recompilation.

**Citizen starter traits:** fatigue 15–35, trust 35–75, acceptance neutral until a law is known; disposition weights generated from seed. Explicitly record each citizen's starting attributes for replay. No personality adjective automatically guarantees obedience or disobedience.

# 3. Resource and action catalogue — PROPOSED

**Resources:** `food`, `timber`, `coin`. Resources live in owner/location accounts. Price values and wages are scenario configuration. Fields and forest have stock/capacity constraints. Daily food demand is one unit per citizen in the first prototype (40 units/day).

| Action ID | Actor eligibility | Inputs / capacity | Output / effect |
|---|---|---|---|
| HARVEST_FOOD | Farmer | Field access; harvestable crop; 1 slot | Up to 3 food; work fatigue; food assigned to producer stock |
| CUT_TIMBER | Forester | Forest stock; 1 slot | Up to 2 timber; forest depletion; work fatigue |
| DELIVER_FOOD | Merchant | Producer food supply; market coin; 1 slot | Up to 4 food moved to market; producer paid; merchant compensated |
| EXPORT_FOOD | Merchant | Export permission; stock; external demand; route capacity; 1 slot | Food leaves local economy; coin enters via bounded buyer |
| PATROL | Guard | Access to patrol area; 1 slot | Patrol capacity and fatigue; possible violation detection |
| REST | Any citizen | 1 slot | Fatigue decreases; no work production |
| BUY_AND_EAT | Any citizen, dusk | Market food, personal coin | Transfer food/coin; consume 1 unit; hunger reduction |
| SLEEP_RECOVERY | Any citizen, dusk | End-of-day tick | Partial fatigue recovery |

**Market mechanics:** For the first slice, merchants deliver farmer-produced food into a pooled local market account using a market purchase price, limited by merchant capacity and market liquidity. Citizens buy food at dusk at the market sale price; those unable to purchase or obtain food go hungry. Simple pooled market-clearing avoids building a full general-equilibrium economy now, while preserving actual ownership/transfer events. Merchant income can be a configured delivery fee funded by the market. **These exact price/wage flows need an engineering fixture test before acceptance.**

**Proposed starter values:** producer food payment = 1 coin/unit delivered; resident food sale price = 2 coins/unit; delivery fee = 1 coin per completed delivery; guard pay = 2 coins/day if funded; food harvest fatigue +25 per action; rest fatigue -35 per action; overnight fatigue -15; clamp fatigue to `[0,100]`. Timber production can be sold to Treasury up to its configurable daily purchase capacity, with stock used for market upkeep; exact purchase/maintenance values remain balance parameters.

**Key invariants:** If crop stock is zero, harvesting produces zero; if merchant delivery is not performed, newly harvested food cannot automatically appear in market supply; if consumers lack accessible food/coin, hunger rises; if no guards patrol, enforcement detection is limited accordingly.

**Lightweight external market:** `EXPORT_FOOD` uses a bounded standing buyer with configured price and capacity, not a simulated neighbouring kingdom. Export is **licensed by a MAY law**; without permission the legal gate prevents ordinary lawful export. This gives permission decrees meaningful functionality without implementing diplomacy.

# 4. MVP decree vocabulary and grammar

**Mandatory families:** MUST, MUST_NOT, MAY. Text assembled from typed menus, not user-input natural language. The final text is generated by the engine for review, never parsed back as the source of truth.

**Subjects:** Farmers, Foresters, Merchants, Guards, All Citizens. **Actions:** Harvest food, Cut timber, Deliver food, Export food, Patrol, Rest (shown only for valid target-action capabilities). **Optional clause:** one WHEN condition or one UNLESS exception initially; an advanced profile may expose both. **Conditions:** food stocks below/above threshold; fatigue above threshold; day period; forest stock below threshold; treasury funds below threshold. **Exceptions:** citizen exhausted, unavailable resource, unsafe route (if represented). For a condition to appear, its referenced variable and units must exist in the active module.

**Sample valid laws:**
- `Farmers must harvest food when village food stock is below 80.`
- `Farmers must not harvest food when exhausted.`
- `Merchants may export food when village food stock exceeds 100.`
- `Guards must patrol whenever awake.`
- `Merchants must not export food when village food stock is below 50.`

**Invalid example:** `Guards must harvest food` must be unavailable or rejected as capability mismatch. **Valid-but-poor example:** `All capable workers must work whenever awake` may be unavailable in the first action registry if no generic WORK action is implemented; never show an option that the evaluator cannot execute. Use supported occupation-specific actions for the first slice.

**Warning, not rejection:** opposite modalities affecting the same valid action/time; an obligation that is currently infeasible; a permission that has no additional effect; predicted overloaded guard workload. Enforcement and precedence must follow Technical Systems Specification section 5.

**Composer interaction:** Choose subject → modality → action → object/quantity if needed → optional condition → optional exception if mode allows → show sentence + impact preview + validation → Enact. Edit an existing law reopens prefilled tokens; saving creates new immutable version. Decree list shows status, version, scope, known conflicts and linked outcomes.

# 5. Minimum stochastic citizen model

**Every morning:** Evaluate notifications about new law versions and update citizens' known versions by seeded probability. A law is currently valid even before everyone knows about it. A citizen may have favourable attitude yet not perform a rule because work capacity or inventory is missing.

**Each action slot:** generate feasible actions for actor; evaluate needs, money, fatigue, personality, lawful pressures and available locations; score candidates; select one probabilistically via versioned keyed PRNG; allocate limited field/patrol/market capacity; execute or log inability; apply ledger changes and attempted-compliance state.

**Acceptance tracking:** Each citizen may approve or oppose an individual decree. The first slice may use a low-complexity attitude score instead of full social-network influence. Model 3-style peer learning and collective organisation are not required yet, but events should support adding them later.

**Enforcement:** Only available patrolling guards can investigate a bounded number of discovered violations; detection is stochastic and capacity-limited. Distinguish deliberate evasion, ignorance, blocked ability and legal compliance in reports. Default penalties are warnings/small fines and should be appropriate for Junior Mode.

**Probability fairness:** No literal “35% production penalty” from a decree. Law effects change actor scores, feasible actions, enforcement risk and actual attempts. Weather, resource stock and fatigue affect production directly. Use exactly specified seeded draws so a saved run is reproducible.

# 6. First campaign: The Hungry Village

**Objective — PROPOSED:** By the end of day 12, achieve both (a) at least 90% of citizen-days with sufficient food and (b) village market/granary food stock of at least 40 units. Present final trust level and shortages as additional non-gating scorecards. The threshold is a tuning candidate, not proof that a scenario is winnable with default parameters.

**Opening:** The Royal Gazette reports low food stores and rising complaints. Zoey frames the stock problem; Noah highlights food access; Liam notes patrol capacity; Mia notices cheeky citizen adaptations. The player is guided to author one food-related decree without being told a guaranteed winning combination.

**Teaching beats:**
1. Create a basic obligation; see who learns it and whether they attempt it.
2. Observe overwork or missed opportunities, with a trace back to fatigue/alternative choices.
3. Amend the decree with a condition or exception.
4. Watch traders or guards respond to their own policies; find a conflict or exploit.
5. Compare outcomes to the scenario objective; replay with a different strategy.

**No forced surprise:** Each teaching beat may be supported by targeted setup conditions and adviser prompts, but simulation consequences must remain genuine. Do not silently alter state to ensure a specific joke or scripted sequence occurs.

**Failure/retry:** At day 12, show achieved metrics, causal factors and notable legislative mishaps. Offer replay from initial seed, fresh-seed replay and, if implemented, checkpoint restart. Never silently rewind and pretend the run continued.

# 7. Sandbox entry

Same village and rule grammar; selectable world seed and initial scenario preset. No required victory threshold. Show running metrics and Royal Chronicle. Sandbox still respects production, trade, enforcement and legislative-change limits unless a clearly labelled experimentation preset alters them. No direct citizen manipulation or resource spawning as regular gameplay.

**Mode choices:** Junior and Full both offer Campaign and Sandbox from the main menu. Junior sandbox begins with the reduced token vocabulary and extra explanations; Full sandbox exposes the slice's complete supported vocabulary.

# 8. UI screen-by-screen build contract

| Screen | Essential elements | Primary user action |
|---|---|---|
| Home | Rulecraft identity, Campaign/Sandbox, Junior/Full, accessibility | Start a save |
| Village View | Visual homes/farms/market/guards, turn, stock and trust indicators, adviser feed | Inspect, open lawbook, advance |
| Decree Book | Active/suspended/abolished, title, version, warning, change count | Create, amend, suspend, reinstate, abolish |
| Composer | Cascading typed tokens, generated sentence, conditional path, warning/validation, enact | Legislate |
| Turn Resolution | Progress animation, delta summary, citizen visual reactions | Review consequences |
| Royal Gazette | Prioritised notable incidents, four advisers' remarks | Open incident |
| Royal Inquiry | Who did what, when, applied law, feasibility and resources, supporting events | Diagnose and return to law |
| Chronicle | Incident history, linked decree versions, share card | Review/export |
| End Screen | Objective, 12-day trends, causal retrospective, replay | Retry or continue |

**UI safeguards:** No invisible context dependency in dropdowns; selected parent changes clear invalid children; disabled options explain why; no hidden rule changes between modes; semantic labels remain available without colour; child-friendly text length; explicit final confirmation before deleting/abolishing an important law. Every essential action must be accessible on a phone by touch alone; no hover-only disclosure, keyboard requirement, drag-only gesture or horizontally overflowing decree grammar.

**Animation approach:** a small set of reusable gestures and contextual props for villagers/advisers. Physical comedy should be driven by supported states rather than a huge library of bespoke cutscenes. Placeholder art is acceptable in first playable; canonical character fidelity is a production art gate.

# 9. Four-adviser and comedy implementation

**Role mapping:** Zoey = economy/science; Liam = security/enforcement; Mia = culture/creative adaptation; Noah = welfare/social relations. All have access only to actual factual event inputs. No artificial adviser disagreement when facts contradict their scripted lines.

**Required narrative surfaces:** at least four Royal Gazette event families; each adviser has multiple fact-bound responses; citizen barks; one Chronicle listing; exportable incident card (PNG or equivalent). **PROPOSED event families:**
1. `LABOUR_EXHAUSTION` — work obligation raises duty pressure while fatigue accumulates; dialogue can highlight declining productivity.
2. `FOOD_ACCESS_GAP` — supply exists but merchant distribution/purchasing access is insufficient; adviser questions why stocked grain doesn't reach people.
3. `EXPORT_WHILE_SHORT` — licensed exports continue while local stores are low; officials debate wording and profit motives.
4. `GUARD_OVERLOAD` — too many duties/violations compared with patrol capacity; Liam reports stretched staffing.
5. `CONFLICTING_DUTIES` — citizen receives incompatible obligations for one action slot; Gazette cites law versions.
6. `BENEFICIAL_ABSURDITY` — unusual law combination improves outcomes; celebratory comedy, not automatic punishment.

**Narrative truth test:** A template may only fire if its event predicate is supported by log data. Each card links to source event IDs. Repetition suppression (e.g. once per family every three turns, configurable) and adviser rotation ensure humour remains varied.

**Share template:** `MY DECREE` / `WHAT HAPPENED` / `ADVISER VERDICT` plus scenario title and non-identifying world seed. Render from source facts; do not expose player or child's real name. A working local image export is enough to validate shareability; social-platform integration is excluded.

# 10. Acceptance tests — simulation and correctness

| ID | Input / operation | Pass condition |
|---|---|---|
| BUILD-01 | Start both modes in campaign and sandbox | Four combinations launch with appropriate data-driven vocab/settings |
| BUILD-02 | Use GUI to author and enact valid farmer MUST law | Generated text matches typed AST; active on next turn |
| BUILD-03 | Change subject from Farmer to Guard | Invalid `HARVEST_FOOD` child disappears/reset; no illegal AST reaches engine |
| BUILD-04 | Author valid but broad law | Warning may show; enactment is not blocked without syntax errors |
| BUILD-05 | Author opposing MUST/MUST_NOT | Conflict warning and deterministic documented precedence |
| BUILD-06 | Amend on day 3, repeal day 5 | Immutable history preserved; stale knowledge possible; no post-repeal legal penalty |
| BUILD-07 | Farmer chooses harvest with empty field | No food produced; blocked attempt and reason recorded |
| BUILD-08 | No merchants select delivery | Food produced by farms does not magically appear in market stock |
| BUILD-09 | No guards choose patrol | Enforcement action count zero or documented passive detection only; no unlimited fines |
| BUILD-10 | Funds insufficient for a payment | Transaction fails/partially fills with reason; no negative coin accounts |
| BUILD-11 | Citizen too poor or market empty at dusk | Hunger rises; not labelled willful legal disobedience |
| BUILD-12 | Same seed, initial data, decree sequence | Identical world checksums and event content on repeated runs |
| BUILD-13 | 200 different seeds, fixed policies | Outcomes show variation within predeclared statistical sanity checks |
| BUILD-14 | Change trust or patrol capacity across matched seed sets | Average compliance/detection responds in expected direction; exact threshold calibrated |
| BUILD-15 | Trigger supported humour incident | Gazette + at least one adviser refer to actual event IDs and correct decree version |
| BUILD-16 | Export incident | Share card contains factual decree/event/verdict; no personal data |
| BUILD-17 | Run resource audit for 12 days | Account balances never negative; every creation/transfer/consumption has ledger event |
| BUILD-18 | Save, close, reload, advance | Same world and active law versions; replay remains deterministic |
| BUILD-19 | Add test resource/action by registry | Validates and appears in appropriate menus without editing core grammar |
| BUILD-20 | Exercise 40 agents × 25 laws × 30 days | Benchmark recorded against provisional <150ms median / <500ms p95 turn targets |
| BUILD-21 | Complete both modes on narrow Android and iOS mobile browsers | All core functions work by tap/scroll; no clipped critical UI or hover/keyboard dependence |
| BUILD-22 | Interrupt while drafting; suspend/reload after committed turn | Draft is independently recoverable or deliberately discarded; no partially committed world state |
| BUILD-23 | Export share card on a phone | Image exported/downloaded using web adapter; native share interface remains an adapter seam |
| BUILD-24 | Run cross-runtime seeded golden fixture | Same state and event hashes on supported runtimes, or documented numerical portability blocker before stack sign-off |

**Statistical test caveat:** BUILD-14 requires 200+ matched-seed replicates and reported effect sizes/confidence intervals; do not use a brittle exact single-run compliance expectation. Tests on PC alone do not establish mobile-browser performance. Record device, OS, browser, screen dimensions, orientation, memory proxy, frame responsiveness and turn latency for physical Android and iOS phones; targets are provisional until measured.

# 11. Human playtesting requirements

**Junior test:** recruit age-appropriate children and obtain guardian consent. Observe independently: can they understand “who / must / action / when”; identify what their decree caused; amend a law after an unexpected outcome; understand adviser humour; navigate without excessive reading help? Do not assume a seven-year-old can understand conditional clauses unaided.

**Full Mode test:** can older players predict first-order results but still discover second-order consequences? Does an action feel consequential? Do players willingly experiment after completing an objective? Are surprises fair rather than arbitrary?

**Suggested metrics — PROPOSED:** first valid decree without help; percentage who can correctly identify a causal link; voluntary amendments per session; fraction of notable incidents correctly understood; time to first smile/laugh; repeat play intention; number of repeated humour lines. These require human interpretation; a laugh metric alone is not a definitive quality score.

# 12. Implementation sequence and dependencies

**Milestone A — Headless kernel:** stable state, seeded RNG, actors, two action slots, physical actions, resource ledger, save/replay. Gate: no UI; deterministic tests pass.

**Milestone B — Rule compiler:** registry, cascading grammar schema, AST validation, legal effect, priority, history, amendment/repeal. Gate: laws change choices in test fixtures.

**Milestone C — Autonomous village:** awareness/acceptance/choice, enforcement and market delivery, trust, fatigue, food access; gate: broad laws can generate traceable unintended consequences.

**Milestone D — Mobile-first player shell:** narrow-screen-first touch Village View, composer, Decree Book, day advance, Gazette/Inquiry and end screen; gate: fully playable on a smartphone without debug tools, keyboard or hover.

**Milestone E — Four-adviser comedy:** event templates, cooldowns, scene reactions, Chronicle/share export; gate: no unsupported narrative facts.

**Milestone F — Mode profiles + mobile validation:** Junior/Full configs, campaign and sandbox, tuning, physical Android/iOS browser benchmarks, interruption-safe save tests and supervised playtests. Gate: mobile-web pilot release candidate, with native porting seams documented.

**Parallel work:** placeholder illustrations/UI tokens can progress after interaction contracts are stable; approved Nurts canonical artwork enters only after the reference assets and art direction are confirmed.

# 13. Implementation-ready acceptance bar

**Pass:** One can start either difficulty, enact an intelligible law, advance days, see autonomous behaviour and economic consequences, investigate a real causal chain, change/repeal the law, observe a plausible difference, encounter at least one factually grounded cheeky incident, and replay deterministically.

**Conditional pass:** Numbers need balancing, but the causal engine is correct and tuneable through data. Some scenarios may need shorter duration or fewer thresholds after testing.

**Fail:** Laws directly add statistical bonuses without actions; guards can enforce unlimited laws despite no patrol capacity; food or coins appear from nowhere; Junior Mode forks rule semantics; narrative invents causes; replay differs on identical seed; a programmer must guess what a dropdown token means.

# 14. Sign-off checklist and open parameters

**Confirmed decisions locked into build:** standalone identity; two configuration-driven complexity modes; campaign and sandbox; decree-only player authority; immediate legal effect but progressive awareness/adoption; probabilistic citizen decisions with reproducibility; no gameplay cap on active laws; between-turn amendments; enforcement dependent on real capacity; valid-but-foolish decrees allowed; four Nurts advisers; substantial systemic comedy.

**Pending sign-off after prototype modelling:** exact 40-citizen split, action slot count, recipe yields, money and food stocks, legislative change allowance, price/wage flows, citizen scoring coefficients, awareness rates, scenario success thresholds, mode vocab differences, runtime stack and measured performance budgets.

**Recommended next tangible task:** produce an executable, headless 12-day prototype with JSON fixtures for the village, one law compiler path, farmer/merchant/guard behaviour, resource invariants and seeded logs. Once this demonstrates causal variation, build the full interface around the same API.
