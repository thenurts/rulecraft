# Hungry Village introductory mission design

**Recommendation for review:** a guided distribution puzzle with an open experiment and debrief. Existing evidence supports delivery as a constructive lever on the candidate fixture. The new study found a genuinely different legal lever, merchant rest, that improved fatigue but reduced feeding on average. Two versions of a delivery duty offer useful wording experiments within the same mechanism. This evidence supports one instructional puzzle. A broadly strategic campaign or an affordability mission requires more evidence. [Issue #22](https://github.com/thenurts/rulecraft/issues/22) · [Merged Task 06 design](14_Task_06_Modes_Campaign_Sandbox.md) · [Prior fixture and welfare evidence](16_Task_06_Fixture_and_Persistence_Study.md)

## Teaching hypothesis

A novice can follow food transfers in the ledger from field to producer to market, then explain why a shopper may still miss a meal. The player tests that explanation with their own decree and revises it after seeing the recorded outcomes. They should distinguish **what the council said**, **who learned it** and **what happened**. Preparing a law, the first notice and the first useful delivery may occur on different days.

Use the research candidate `five-merchants-farmers-v1` for the next design playtest, subject to approval. It starts with 21 farmers, six foresters, five merchants and eight guards. Prices, wages, starting cash and stocks match the published fixture. The horizon is 12 days, with 480 resident-day meal opportunities. Each person needs one unit per day. Intro copy may state initial facts from the fixture, such as 45 units in the market, 450 in the fields and two coins per meal. A fresh village has no harvest, delivery or shortage history to narrate.

## Player flow and low-fidelity wireframes

The following cards depict information order. Bracketed values are populated from the fixture or recorded source. The flow stays optional outside the first-time test protocol.

| Step | Junior wireframe and prompt | Full wireframe and prompt |
| --- | --- | --- |
| Opening | **Can food reach the table?** → **Field / Market / Supper** with plain labels and one line per step → **See the village**. Explain “food at the market” and “coins to buy it”. | Show opening accounts, occupation mix, declared horizon and meal price. Ask which bottleneck the player expects and why. |
| Pick a starting hypothesis | **Where could food get stuck?** Choose “Growing it”, “Carrying it” or “Paying for it”, or skip. Open Decree Book. The choice records a local observation in the playtest, without a simulated effect. | Invite a prediction about harvest output, deliveries or meal access. Offer optional comparison prompts and keep the full evidence list. |
| Author one decree | **Who → must / must not / may → action → review**. Keep registered actions for each subject. A recommendation may explain where to look while letting the player author and confirm. Basic wording comes first. | Same review and enactment semantics, with supported predicates and typed conflicts available. Show effective day, anticipated choices and physical barriers as possibilities. |
| Observe each new day | **What you asked → Who heard → What happened** with a single evidenced example when it exists. Otherwise show the factual day totals and a neutral route to evidence. | Show notices, actual/perceived ruling, chosen action and barriers, then resource and meal figures. Compare days without attributing differences to a decree from totals alone. |
| Day-six checkpoint | **Six days in** → **Feed count [x]/240** → **Food never reached the market / A resident could not pay**, displaying only supported findings → **Follow a record** → **Keep or revise decree**. A single guided clause can be offered at this stage. | **Report [x]/240** plus harvest/delivery split, funds vs stock, affected groups and links to ledger and awareness. Ask whether a revision would change the physical bottleneck. |
| Day-12 debrief | **Meals served [x]/480** → **What helped / What is still hard** → one factual positive or cautionary example when available → **Try the same seed again**. | Read the same primary result, distributions by occupation and persistent hardship, exact versions and an optional clearly labelled same-seed no-decree reference. Allow a new seed with a distinct start confirmation. |

The day-six checkpoint is a review point. It leaves the save current and the village on its actual timeline. Same-seed retry starts a fresh trial with the exact candidate profile and fixture; it requires explicit save replacement unless an independent run mechanism is separately approved. Make the familiar day-six prompt available even if the player has enacted nothing, has experimented with an unhelpful rule, or has no Chronicle incident.

### Evidence routing for hints and Chronicle

| Prompt, when evidence qualifies | Source required and destination |
| --- | --- |
| “Food was gathered. Did it reach the market?” | Link a completed `harvest-food` action with its field-to-grower transaction. A separate producer-to-market transfer supports a delivery claim; the daily market balance alone does not. |
| “This merchant knew the rule and delivered.” | Link the delivery's recorded legal choice and transaction. The applicable actual and perceived version, notice provenance and completed action must agree. An unlearned operative law gets a different sentence and its actual ruling. |
| “This delivery could not happen.” | Link the exact not-feasible or blocked action and its recorded reason, such as fatigue, insufficient working funds or lack of producer stock. |
| “Food was there, but this resident could not pay.” | Link a meal with positive `fundingShortfall` and `marketAvailableBefore`; link the resident meal outcome and any transaction. A supply shortfall uses a funded request with positive `supplyShortfall`. |
| “The village did better with this policy.” | The same-seed comparison supplies comparative totals in a separate labelled panel. Link explanatory examples to records in the current run. A matching notice or a later event alone does not show that a decree caused a specific action. |
| No matching witness for the current run | Show neutral totals, “See the day's records” and an optional question. Use Chronicle or a share card only for an already validated incident. |

Day-six teaching evidence exists in candidate seed 20000. The published trace links `notice.citizen.0030.delivery-duty.1` to the choice in `event.6.22`, the market movement in `tx.6.15` and day-six feeding rising from 24 to 32 in the matched runs. The day-12 discussion can use the separate seed-41000 day-11 meal witness: `citizen.0022` had already bought ten meals under delivery duty, and lacked coins with 23 units available. Those IDs are research examples scoped to their specific runs. [Delivery chain](evidence/task-06/fixture-witness-seed20000.json) · [Affordability chain](evidence/task-06/fixture-meal-pairs.json)

## New paired strategy results

This follow-up uses the same candidate fixture and the public v4 law API. Exploratory seeds 52000–52063 compared day-zero delivery duty, merchant rest at fatigue 45, merchant rest at fatigue 65, merchant morning rest, and delivery first confirmed after day six. Against no decree, the three rest variants changed feeding by **−11.83**, **−3.05** and **−38.91** resident-days on average, respectively. The least harmful rest variant was locked for separate holdout seeds 53000–53127. Every run passed the ledger audit. [Exploratory results](evidence/task-06/hungry-mission-explore.json) · [Holdout protocol](evidence/task-06/Hungry_Mission_Holdout.md)

| Holdout policy | Fed out of 480, mean | Paired mean difference [95% interval] | Supply-shortfall Δ | Affordability-shortfall Δ | Better / tied / worse than no decree |
| --- | ---: | --- | ---: | ---: | --- |
| No decree | 376.49 | Reference | — | — | — |
| Day-zero delivery duty | 397.95 | +21.45 [19.96, 22.94] | −22.95 | +1.50 | 128 / 0 / 0 |
| Merchant rest at fatigue ≥65 | 372.87 | −3.63 [−4.22, −3.03] | +3.86 | −0.23 | 1 / 44 / 83 |
| Delivery after the day-six checkpoint | 386.49 | +10.00 [8.98, 11.02] | −10.63 | +0.63 | 121 / 7 / 0 |

Day-zero delivery improved day-six feeding by 10.74 out of 240 and averaged 4.59 of five merchants informed by that checkpoint. It reduced the count of residents missing at least three meals from 19.47 to 12.13. Counts for at least three **consecutive** misses fell from 4.64 to 2.50. These are exploratory learning diagnostics for discussion, with no pass threshold. The duty improved average meals in all four occupations, including +2.20 for the six foresters as a group, while those foresters accounted for +1.50 affordability-shortfall units. Thirty-day storage or a production campaign are outside this experiment. [Holdout metrics and occupation breakdown](evidence/task-06/hungry-mission-holdout.json)

Rest at 65 addressed a distinct decision. It lowered merchant fatigue-blocked delivery records by 2.53 on average, but moved 3.63 fewer food units to market and left more meals unmet. In qualifying seed 52001 on day 4, merchant `citizen.0032` had fatigue 75, the same keyed draw 1631224174 and feasible delivery in both arms. The control action delivered four units (`event.4.61` and `tx.4.40`). The matched resident rested (`event.4.75`) after learning the version-one rest duty at dawn on day 1. The actual and perceived duty were required, rest weight rose from 25 to 92 and fatigue fell to 40. The day's market delivered and fed 28, versus 32 in the control; both closed at zero stock, and both fed 32 the next day. This is a helpful teaching contrast: fewer physical blocks can accompany worse access when a required rest replaces a feasible delivery. The evidence shows no robust second constructive lever in the tested policies. [Exact law, notice, choices, audit and ledger witness](evidence/task-06/hungry-mission-rest-witness.json)

## Objective frameworks and mode choices

The primary score in every option is **fully fed resident-days out of 480**, counted from daily metrics and auditable completed meals. Secondary diagnostics remain separate so the same missed meal is never counted twice in the headline. Show funded demand that could not be filled, inability to pay, role distributions and how many residents repeatedly missed meals. Closing market stock remains a diagnostic. Feeding one more meal must never become an objective penalty for drawing down the reserve.

| Framework | Fairness and learning | Replay value and limitations |
| --- | --- | --- |
| **Guided puzzle with a clearly labelled reference** (recommended for first playtest) | Same-seed no-decree panel shows improvement and uncertainty in what caused individual choices. Supports learning even if both branches still struggle. Delay the reference until checkpoint or debrief so the novice makes a prediction first. | Comparable retries encourage experiments. Explain the reference as another simulated run. Test whether more statistics confuse Junior players. Reference simulation cost and how it is cached remain implementation decisions. |
| **Fixed target chosen after playtesting** | One number is easy to understand. Must be calibrated against no decree and constructive distributions across new seeds, mode exposure and late revisions. | Easier to explain but seed variance could make an apparently sound policy unfair. No numerical threshold has been chosen. |
| **Checkpoint and debrief without win/fail** | Simplest first session. Treat the day-six result as a prediction check; final evaluation can ask a player to explain two distinct shortfall reasons. | Lower stakes may help novices. It does not establish a repeatable challenge or product difficulty. Study desire to retry before choosing it. |

**Junior.** Start on the same candidate in the first comparison. Use plain labels, one evidence question at a time and a day-six milestone that does not end the 12-day run. Progressive clause exposure reduces options early. The basic delivery duty remains expressible, but restricting conditional delivery or rest removes ways to investigate timing and fatigue. A shorter or gentler Junior preset is a separate visible start choice to validate on fresh seeds, rather than a different interpretation of the same AST. The current candidate still averages about 82 unmet meals under the effective policy. That severity is an unresolved age-suitability issue.

**Full.** Same engine and seed, with optional detailed walkthrough, earlier access to supported conditions, exact version and feasibility evidence, and side-by-side day and occupation totals. Give experienced users real opportunities to amend or repeal without presenting a guaranteed solution. The checkpoint intervention partially recovered food access when begun at day six. It is a reason to support iteration, not a second policy mechanism.

## Pre-playtest protocol and risk register

With informed consent, use first-time players and independent saves. For Junior, obtain guardian consent and the child's assent, allow withdrawal or a break at any time, use a guardian-facilitated session as appropriate, and collect no names or recordings by default. Use written observational codes locally, with an agreed retention period. A participant who asks for help still continues. Record whether a prompt was neutral, assisted or instructional.

| Task sequence | Observe and record |
| --- | --- |
| Open the mission and author a first valid law with no help | Time, navigation errors, independently valid AST, understanding of scope and next-day effect. Log assistance and allow skipping. |
| Predict a consequence, then advance and compare | Player's predicted stock/access change, one actual recorded outcome, whether they distinguish “in force” and “known”. |
| Read the day-six evidence card and interpret its source | Can they follow the event and identify whether scarcity is stock, transport or coins? Junior may explain orally. Full should identify an actual or perceived law or feasibility constraint. |
| Revise a decree or explain why they keep it | Whether a revision is deliberate, exactly what they intend to change and whether they can compare the next real outcome. |
| Read day-12 debrief and consider retry | Can they explain the residual hardship despite better feeding? Record perceived agency, confusing or funny moments, and spontaneous retry interest. |

| Risk | Current evidence and owner gate |
| --- | --- |
| One useful mechanism | Delivery works in three distinct seed sets. Rest, harvest and cash-pressure experiments give counterexamples. Approve a guided introductory puzzle or require another mechanism before promising broader strategy. |
| Persistent hardship after constructive play | Effective delivery still leaves roughly 82 missed resident-days and can expose late coin depletion. Choose the scope of a Junior lesson and whether this outcome is appropriate before setting difficulty. |
| Reference anchoring and explanation load | Test whether a same-seed panel clarifies agency or turns the lesson into copying. Check retention by asking for a prediction on a fresh seed. |
| Preset and profile changes | Compare the shared candidate first to isolate UI comprehension. Approve any shorter or gentler opening as a separately described, versioned fixture with new same-seed comparisons. |
| Native browser legibility and enjoyment | Physical Android and iOS tests, 200% composer selected-value clipping, and consented first-time Junior/Full playtests are **Not Yet Tested** in this work. [Known composer issue](https://github.com/thenurts/rulecraft/issues/17) |

## Reproduction and owner decisions

```sh
node docs/evidence/task-06/hungry-village-study.mjs explore
node docs/evidence/task-06/hungry-village-study.mjs holdout rest65
node docs/evidence/task-06/hungry-village-study.mjs trace rest65
```

The trace command verifies byte-exact replay for both matched v4 worlds. The previously published 256-seed results remain the baseline. This smaller follow-up tests a different strategy, timing and hardship metrics. All three commands completed successfully, and the witness command replayed each v4 arm byte for byte. The shared source baseline passed 151 unit and integration tests, 19 browser tests, type checks and the production build in the parallel save-spike worktree.

Owner review should choose the guided-puzzle format, the reference or debrief treatment, the severity appropriate for Junior, and whether a second constructive lever is a prerequisite for later campaigns. Approve any objective and preset separately. This proposal stops at the design and playtest gate.
