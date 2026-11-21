# RULECRAFT
## Master Game Design Document

**Version:** 0.6 | **Status:** Implementation-planning draft | **Date:** 21 November 2026  
**Project:** Standalone game featuring The Nurts advisers; not *The Nurts Adventures: Lead the Way*  
**Companion documents:** 02 Technical Systems Specification; 03 Vertical Slice Build & Acceptance Specification

> **Document convention:** **CONFIRMED** means explicitly agreed in design discussion. **PROPOSED** is a buildable default to be validated in prototyping. **FUTURE** describes intended extensibility, not first-release scope. Numerical values throughout are design hypotheses, not playtested balance.

# 1. Product definition

**Premise.** Rulecraft is a comedic, systems-driven governance game. The player creates, amends, suspends, reinstates and abolishes decrees; autonomous inhabitants and institutions respond according to their needs, goals, beliefs, opportunities, resources and willingness to comply. A living society changes as a result. The player investigates outcomes and writes better instructions—or deliberately experiments with ridiculous ones.

**Player promise:** *Write the rules. Watch the world react. Laugh at the consequences. Rewrite the rules.*

**Genre hypothesis:** Rule-authoring / systemic governance simulation. This describes the desired experience, not a claim that no comparable mechanics exist elsewhere.

**Standalone boundary — CONFIRMED.** Separate project, save data, production plan and gameplay architecture from *The Nurts Adventures*. Zoey, Liam, Mia and Noah appear as advisers. Character art must follow separately approved canonical references; placeholder portraits are allowed during prototyping.

**Design pillars — CONFIRMED**
1. **Indirect authority:** The player influences society exclusively through decrees. No direct unit orders, production buttons, construction placement or market transactions.
2. **Autonomous response:** Citizens can comply, fail, adapt, exploit, resist or disobey. A legally active decree never guarantees an outcome.
3. **Consistent causal world:** Resources, time, geography, institutional capacity and prior laws constrain outcomes; randomness is seeded and explainable.
4. **Playful legislative experimentation:** Loopholes, over-broad wording, contradictory duties and cascading consequences provide humour and strategic discovery.
5. **Readable consequences:** Feedback identifies what happened, which actor acted, why it was plausible and which decrees contributed.
6. **Expandable architecture:** Population detail, territorial scope and decree expressiveness scale independently.

**Out of scope for initial vertical slice:** direct control; free-form AI-executed laws; warfare; full diplomacy; multiple settlements; real-time multiplayer; player-authored arbitrary code; conversational AI citizens.

# 2. Audience, modes and platform

**Junior Mode — CONFIRMED:** approximately ages 7–12. Visually guided short sentences; fewer active systems and simultaneous problems; shorter scenarios; early, legible effects; forgiving outcomes; age-appropriate cheeky humour. A seven-year-old's accessibility remains a playtest risk, especially reading demands.

**Full Mode — CONFIRMED:** older audiences. More conditions, restrictions, compound policies, opacity of emerging second-order effects, institutional constraints and multiple objectives. Humour remains central rather than becoming a decorative layer.

**One engine / one application — CONFIRMED direction, technically feasible.** Both modes share the same rule interpreter, citizen core, event system, save schema and simulation semantics. Mode profiles configure exposed vocabulary, enabled modules, scenario parameters, adviser verbosity and UX. Junior Mode is not a second branch of simulation logic. Mode is selected at game creation; changing mode mid-save is **PROPOSED: disabled initially**, because laws and scenario states may reference features hidden in Junior Mode.

**Platform strategy — CONFIRMED:** Rulecraft is a **mobile-first game**. The intended long-term distribution includes dedicated **Android and iOS applications**. Web hosting is an acceptable initial deployment and testing route, not the definitive product form. Design and engineering decisions must preserve a practical path to both mobile stores without reimplementing core gameplay or redesigning the primary interactions. Desktop browser access is secondary and should adapt gracefully.

**Implementation route — OPEN:** Select a cross-platform game/runtime stack or a portable web/hybrid stack through a short technical spike before committing to major UI or rendering architecture. Neither a web wrapper nor a chosen game engine is assumed to guarantee effortless Android/iOS release. Required native integrations, app-store compliance, device testing and optimisations remain distinct workstreams. The deterministic simulation kernel, rule compiler, content registry and event schema must be independent of the platform-facing UI.

**Initial delivery — PROPOSED:** web-hosted, installable-on-phone prototype where practical, optimised for real touchscreen devices. Offline continuity after first load and native packaging are planned design targets; both need explicit testing and are not implicitly complete merely because the browser prototype runs.

**Tracks — CONFIRMED:** Campaign (structured objectives and progression) and Sandbox (open-ended experimentation). Both offered in both modes; content and available controls vary by mode profile.

## Mobile-first interaction requirements

**Primary device:** smartphone touchscreen. Every essential action—creating/editing/abolishing decrees, inspecting the village, advancing a turn, reading adviser feedback and sharing incidents—must be fully usable without a keyboard, mouse, hover state or precise pointer. Native and web presentations should share the same interaction model and core layouts.

**Screen layout — PROPOSED:** design primary workflows for narrow portrait screens first; adapt the village/map view and detailed investigations to landscape and tablet widths without requiring landscape mode. Orientation policy for native builds remains to be validated through usability tests. Prioritise a single focused task per screen rather than multi-panel desktop dashboards.

**Decree composer:** use full-width, thumb-friendly cascading controls with short readable labels, progressive disclosure of optional clauses, persistent sentence preview, clear validation and an explicit enact/amend confirmation. Changing a parent selection clears incompatible descendants. No drag-and-drop, gesture-only commands or text entry are required for core play.

**Information density:** high-priority alerts, citizen reactions and adviser commentary appear as concise cards. Detailed statistics, causal chains and long decree histories live in drill-down views. Interactive village elements must not rely on tiny tap targets to reveal essential information.

**Continuity:** the user can leave during decree editing or between turns without losing an enacted state; interrupted turns require atomic save/resume semantics. Minimise long blocking processing, battery drain, memory usage and bandwidth dependency on mobile hardware.

**Native-port readiness:** avoid browser-only assumptions in save files, asset references, file export and navigation. Introduce adapters for local persistence, sharing, notifications, platform-specific safe areas, app pause/resume and touch input. No native-only feature is needed to prove the first gameplay slice, but these seams must be documented.

# 3. The moment-to-moment loop

1. **Observe:** See village activity, shortages, citizen disputes, economic signals and adviser reactions.
2. **Decide intent:** Choose an objective: protect food supply, improve trust, increase production, control exports, etc.
3. **Legislate:** Create a decree or amend, suspend, reinstate or abolish an existing one, between turns only.
4. **Enact:** The decree becomes legally active before the next simulated turn; citizens do not instantly become aware, accepting or compliant.
5. **Advance:** Resolve a day through autonomous agent and world-system decisions.
6. **Discover:** Receive the Royal Gazette, citizen reactions, measurable impacts, warnings and comic incidents.
7. **Investigate:** Use the Royal Inquiry to follow a surprising result back to actor behaviour, resource flow and decree versions.
8. **Repeat:** Try a different instruction, exception or policy combination.

**Session rhythm — PROPOSED:** 3–8 minutes for Junior scenarios/experiments; 10–25 minutes for Full Mode sessions. No hard real-time timers during decree construction. The player can pause indefinitely between turns.

**Primary satisfaction:** “I caused that”, “I see why it happened”, “I can fix this”, and sometimes “That was so ridiculous I want to share it.”

# 4. Player actions and constraints

**Permitted direct actions:** author, preview, enact, amend, suspend, reinstate, abolish, prioritise where unlocked; inspect any visible world information; advance time; open a non-committing experiment/replay when available; choose scenario and presentation settings.

**Prohibited direct actions:** manually make a farmer harvest; force a merchant to sell; move guards; place a building; create resources; change happiness, trust or prices through a dashboard slider. Such outcomes must flow from decrees and simulated actors.

**Legislative timing — CONFIRMED:** creation and changes only between turns; active immediately on enactment for the next turn; adoption and consequences unfold progressively.

**No hard active-decree count — CONFIRMED.** A per-turn change allowance may constrain legislative throughput; **PROPOSED vertical-slice default: two operations/turn**. Changing, suspending and abolishing each count as one operation. The limit is scenario-configurable; it is not a requirement to build an arbitrarily infinite number of evaluated rules regardless of hardware capacity.

**Costs — CONFIRMED:** Institutions and enforcement consume actual resources, available staff time and public trust where causally appropriate; avoid artificial “law mana”. Administrative rollout costs can be introduced by module and scenario.

**Repeals:** Abolition immediately ends future legal application but does not rewind fatigue, mistrust, inventories, contracts or previous actions. Every revision is retained for the Royal Chronicle and causal investigation.

# 5. Rule composition and semantics

**Interface — CONFIRMED:** modular cascading dropdowns/tokens, not unrestricted free text. Select a compatible subject, modality, action and typed parameters; optionally select conditions, exceptions, jurisdiction, duration or priority. Only valid options appear after parent choices. Invalid syntax cannot be enacted; strategically foolish, broad or conflicting valid laws can be enacted.

**Rule families at vertical slice — CONFIRMED:** Obligation (`must`), prohibition (`must not`), permission (`may`). **Later depth modules — FUTURE:** tax, entitlement, allocation, subsidy, incentive, penalty, institution creation, delegated rulemaking and treaties. The AST/data model is extensible now; later semantics are not assumed implemented.

**Law structure — PROPOSED:** Issuer / Jurisdiction / Target / Modality / Action / Object / Condition / Exception / Priority / EnforcementPolicy / EffectiveTurn / Version / Status. The editor renders the law as a human-readable sentence, but the executable form is a typed abstract syntax tree (AST).

**Examples:**
- `Farmers must harvest food when village food stores are below 80, unless exhausted.`
- `Guards must patrol roads when bandit risk is high.`
- `Merchants must not export food when village food stores are below 50.`
- `Merchants may export food when food stores exceed 120.`

**Semantic fairness:** Terms have explicit in-game definitions. “Awake” corresponds to defined daytime action slots; it is not an invitation to reinterpret ordinary words capriciously. “May” changes legal permission or overrides a restriction where applicable; it does not automatically motivate an agent to act. If a permission would do nothing under current law and circumstances, preview flags that fact.

**Conflicts:** The composer warns about known contradictions but permits enactment. The rule system must have transparent resolution rules, including conflict between different duties competing for one action slot. The technical specification supplies the starting policy.

**Law preview — PROPOSED:** show who is affected, possible legal effects, required institutional capacity, and conflicts; do **not** promise a precise outcome or reveal hidden future random draws.

# 6. Citizens, institutions and society

**Citizen baseline — CONFIRMED:** people have needs, opportunities, dispositions, trust, resources, awareness of laws and willingness to comply. A person can support a decree but be unable to obey it, or oppose a decree but obey because enforcement is credible.

**Citizen lifecycle — PROPOSED:** update needs and knowledge; identify legal constraints; score feasible actions; make seeded stochastic choice; execute within time and resource limits; update wellbeing, trust and memory. Avoid omniscience: a citizen knows local conditions and communicated laws, not the entire kingdom's hidden state.

**Adoption is multidimensional — CONFIRMED direction:** law awareness, acceptance, behavioural compliance and practical feasibility evolve separately. Never treat a single adoption percentage as a magic direct multiplier on production or trust.

**Institutions — PROPOSED:** the Treasury and Guard exist as autonomous, resource-constrained services. Future Public Works, education, diplomacy and other institutions share the same interface. Government cannot simply command outputs it lacks staff, money, materials or jurisdiction to deliver.

**Social evolution — FUTURE:** peer influence, norm formation, collective organisation, emergent factions, policy learning and culture; architecture should allow adding these without requiring advanced social AI in the vertical slice.

# 7. World systems and scale

**Vertical slice:** one whimsical village with fields, forest, village store/granary, market, guard station and households. Four citizen occupations: farmers, foresters, merchants and guards. Three initial economic units: food, timber and coins. No neighbouring kingdom is individually simulated; a bounded external market interface can be used only if required to test permissions.

**Core causal systems:** food production/consumption, fatigue/rest, local trade or distribution, limited forestry, treasury/guard capacity and citizen trust. A world system must only modify variables through explicit logged processes. No arbitrary “food -15 because strict law” effect.

**Spatial progression — FUTURE:** location → district → settlement → region → kingdom → world → planet/star system. Geography, political authority and law jurisdiction are separate graphs/relationships; do not hardcode them into one territorial tree.

**Simulation fidelity:** named individuals for the active, small world; cohorts for larger populations; aggregate regional states at high scale. Each representation must preserve the information required by active decrees. Conversion must reconcile population counts, goods, wealth and memorable character histories. Cohort switching is *not* required to be production-ready in the vertical slice, but data and test seams are.

**Extensibility:** modules register entity types, action types, resources, attributes, rule predicates, visualisation hooks and narrative reactions. A future interstellar module can add species, planets, starship travel and treaties without redefining `must`/`must not`/`may`.

# 8. Difficulty and cognitive accessibility

**Shared semantic engine; different exposure.** The profile selects token sets, number of visible conditions, available world modules, population sizes, information presentation and scenario parameters. No silent reversal of what a shared predicate means in Junior Mode.

| Design dimension | Junior | Full |
|---|---|---|
| Starting grammar | Subject + modality + action; one condition/exception unlocked progressively | Conditions and exceptions available earlier; complex clauses expandable |
| Simultaneous systemic pressures | 1–2 highlighted problems | Multiple interacting priorities |
| Economy | Clear stocks and simple prices | Scarcity, market competition and institutional overhead as modules mature |
| Information | Strong causal hints and readable visual stories | Rich investigations, partial information and comparative reports |
| Penalties | Recovery-friendly objectives and checkpoints | Longer-horizon and more consequential trade-offs |
| Language | Short labels, icons, optional read-aloud later | Full detail and advanced filters |

**Accessibility:** 44px-equivalent minimum touch targets where practical; no colour-only signalling; legible typography; icons supported by text; no compulsory time pressure. Support reading assistance as a planned accessibility enhancement; do not imply included voice narration before it is specified and budgeted.

# 9. Four advisers and tonal design

**CONFIRMED:** Four recognisable Nurts advisers, with complementary perspectives—not four independent simulation engines.

| Adviser | Primary lens | Tone and gameplay role |
|---|---|---|
| Zoey | Economy, productivity; science later | Logical, direct, points out statistical absurdities and unintended costs |
| Liam | Security, enforcement; military later | Practical, mischievous, spots loopholes, operational constraints and risky shortcuts |
| Mia | Culture, creativity, recreation | Imaginative, enthusiastic, notices eccentric customs and inventive adaptations |
| Noah | Citizen welfare, social cohesion; diplomacy later | Empathetic, notices hardship, inclusion, relationships and longer-term trust |

**No sole correct adviser.** They may disagree from different viewpoints, but all statements must be derived from actual simulation evidence. No canned claim that “Noah says everyone is hungry” unless hunger states support it.

**Humour — CONFIRMED:** frequent cheeky, absurd, shareable consequences. Mechanisms include literal compliance, policy loopholes, clashing duties, opportunism, unintended incentives, administrative escalation and genuinely ingenious absurd successes.

**Humour surfaces:** ambient citizen dialogue, adviser banter, Royal Gazette headlines, visible scene reactions, milestone incident reports and the Royal Chronicle/Lawbook of Shame. Character banter is a presentation of events, not a cause of simulation changes.

**Comedy contract:** no arbitrary reinterpretation of valid rules; no humour that requires unimplemented transactions; explainable chain of causes; avoid repetitive identical jokes; make space for success, surprise, tenderness and harmless chaos, not only disasters. Age-appropriate Junior phrasing; avoid cruelty towards vulnerable inhabitants.

**Illustrative event, not MVP promise:** A ban on *selling* umbrellas produces a rental boom only if umbrellas, rentals, price restrictions and merchant alternatives are all genuinely simulated. The vertical slice should use events its smaller system can actually produce.

# 10. Campaign and sandbox

**Campaign — CONFIRMED:** structured missions with explicit starting conditions, constraints, objectives and optional stretch outcomes. A scenario can end in success, failure or partial outcome, with replay. Unlock additional rule components through mastery rather than arbitrary numerical power. Multiple valid solutions are intended.

**First campaign scenario — PROPOSED:** *The Hungry Village*. Sustain food availability and citizen wellbeing for a fixed number of days despite shortages and competing needs. Unlock condition and exception clauses by guided discovery; test effects of labour laws on fatigue, merchant behaviour and trust.

**Sandbox — CONFIRMED:** no imposed primary victory condition; the same rules and world systems apply. Player can choose a seed, world preset, mode and perhaps eventually custom stressors. Sandbox is not an unrestricted debug/cheat console. Scenario editing and custom world authoring are FUTURE.

**Failure philosophy:** setbacks should be informative and often recoverable. A collapse should produce a meaningful, occasionally cheeky retrospective. For Junior Mode, allow replay checkpoints and a less punishing objective curve.

# 11. User interface and navigation

**Primary screens — PROPOSED:** Home (Campaign / Sandbox / Mode); World View (living village, status, adviser feed); Decree Book (create, search, version, suspend/abolish); Decree Composer (cascading tokens, preview, validate, enact); Turn Resolution (animated consequence overview); Royal Gazette (prioritised events); Royal Inquiry (causal drill-down); Royal Chronicle (persistent notable stories); Settings and accessibility.

**UI constraints — mobile-first:** a phone must be able to compose a simple decree without typing. Advanced clauses expand into vertically stacked cards, not desktop-style horizontal token chains that overflow. Always display the generated sentence before enactment. Show that a law is **active**, **known**, **accepted** and **complied with** as separate concepts. Do not imply certainty where the simulation uses probabilities. Controls must work by tap and scroll, with visible focus/selection states and support for system font scaling where practical.

**Information hierarchy:** (1) unusual event or player objective; (2) affected people/resources; (3) likely causes; (4) relevant decrees; (5) possible amendment route. Humour may lead, but the explanation must be one interaction away.

**Share card — PROPOSED:** “What I decreed / What happened / Adviser’s verdict”; generated from a validated event chain; local export with no child personal data. Social posting/upload integrations are FUTURE and require privacy review.

# 12. Non-functional design requirements

**Determinism:** reproduce a run from the same build, schema version, starting state, player decisions and random seed. **Stochastic gameplay does not mean untestable gameplay.**

**Performance:** the first slice must be tested on physical mid-range Android and iOS phones, initially through supported mobile browsers, with frame responsiveness, turn latency, memory growth, thermal/battery behaviour and input reliability measured. Numerical targets belong in the acceptance specification and must be measured, not assumed. A passing desktop benchmark is insufficient.

**Platform portability:** gameplay logic must not depend on a specific browser API or operating-system UI widget. Versioned saves, decree semantics, content IDs and seeded random-number behaviour must remain consistent across targeted platforms. Web sharing/export must have a defined adaptation path to native share sheets and device storage.

**Release gates:** Android and iOS app-store builds are planned future outputs, not vertical-slice deliverables. Prior to release, separately validate lifecycle interruptions, offline/online state transitions, package size, asset loading, privacy/parental requirements, store policies and device compatibility.

**Privacy and child safety:** local profiles without real names by default, no behavioural advertising in child mode, no open chat, no public social features, no default personal-data transmission. Complete regional compliance review before commercial launch.

**Persistence:** versioned save states, explicit world seed, enacted decree versions and causal log. Loading cannot silently lose active rules or change their meanings.

**Testing:** grammar validity, rule conflict resolution, physical feasibility, seeded stochastic reproducibility, conservation of resources, adoption behaviour, Junior/Full parity on shared laws, and narrative truthfulness.

# 13. Scope gates and decision register

| Design item | Status | Decision or next action |
|---|---|---|
| Standalone project, four advisers, cheeky humour | CONFIRMED | Preserve throughout delivery |
| Decree-only control, campaign + sandbox | CONFIRMED | Core mechanics and game modes |
| Two difficulty configurations, shared engine | CONFIRMED | Measure age suitability and complexity |
| Structured cascading rule builder | CONFIRMED | No unrestricted free-text execution |
| Probabilistic compliance/adoption, reproducible engine | CONFIRMED principle | Tune coefficients in prototype |
| 2 legislative changes/turn | PROPOSED | Balance after first playtests |
| Exact citizen utility coefficients | PROPOSED | Technical model and calibration |
| Detailed initial economy and stock levels | PROPOSED | Vertical slice fixtures |
| Mode switching mid-save | PROPOSED disabled | Revisit after save migration tests |
| Mobile-first delivery; eventual Android/iOS apps | CONFIRMED | Web hosting may precede native release; mobile UX is primary |
| Cross-platform runtime/stack and native packaging route | OPEN | Architecture spike before major production commitment |
| Commercial model | OPEN | Separate business decision |
| Multi-settlement, war, aliens, delegated lawmaking | FUTURE | Architecture seam only, not MVP features |

# 14. Success criteria and design risks

**Prove the core fun before production scale:**
- Players can independently compose a meaningful law with minimal instruction.
- Different laws produce observably different, causally defensible outcomes.
- Players voluntarily amend or repeal laws to explore alternatives, not merely follow hints.
- Notable stories are funny *and* traceable to simulation facts.
- Junior and Full Modes feel distinct without forking the underlying rules engine.

**Major risks:** simulation complexity overshadows play; law vocabulary feels too limited; excessive randomness breaks perceived fairness; advisers falsely attribute causes; Junior Mode depends on more reading and abstract reasoning than younger players can manage; adding new modules breaks old saves; large populations lose individual charm. The technical and MVP documents specify mitigations and tests.

# 15. Glossary

**Decree:** Executable rule authored by the player. **Version:** Immutable revision of a decree. **Enactment:** Legal activation. **Awareness:** Citizen knows a rule exists. **Acceptance:** Citizen's attitude towards the rule. **Compliance:** Behaviour conforms to the rule when applicable and feasible. **Enforcement:** Institution attempts detection and response to violation. **Cohort:** Aggregate population with tracked distributions. **Royal Inquiry:** Evidence-based causal inspection. **Royal Gazette:** Narrative summary of current events. **Chronicle:** Persistent record of notable events and decree history. **Seed:** Initial pseudorandom state used for reproducibility.
