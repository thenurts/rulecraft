# Task 06 pre-implementation evidence

This report measures the merged Task 05 baseline at `4411497`. Issue #20 requires design PR #21 to be reviewed and merged first, and the product owner elected to wait for that merge. The evidence published here runs against the shipped v4 engine and desktop web shell. [Issue #20](https://github.com/thenurts/rulecraft/issues/20) · [Design PR #21](https://github.com/thenurts/rulecraft/pull/21)

## Campaign viability

**Design blocker for the tested Hungry Village configuration.** The constructive delivery duty changed the day-by-day stock trajectory, but none of the tested constructive strategies improved either end objective. Restricting harvest made materially worse outcomes possible. The trial therefore shows legislative effects on village behaviour without demonstrating a meaningful route to victory.

The [campaign study](evidence/task-06/Baseline_Runners.md#campaign-study) uses the existing 40-person, 12-day fixture and the default v4 law and behaviour settings. The provisional targets stayed at ≥90% fully fed resident-days and ≥40 units physically in the market at the close of day 12. The exploratory seeds are 0–255. The holdout seeds are 10000–10255. Both use the same strategy set and thresholds, without tuning. All strategies use the public `confirmLaw` command before day 1, with a stable identifier for the same decree in different arms. The two-law strategy uses both day-zero change slots. Each tested AST is expressible with the shared preview grammar, so the current Junior and Full previews have identical inputs to the engine and share each arm's results. There is one preset. Future mode-specific presets would need their own comparisons.

| Policy | Explore fed mean ± SD (of 480) | Explore finish stock mean ± SD | Holdout fed mean ± SD (of 480) | Holdout finish stock mean ± SD | Feeding target hits, explore / holdout |
| --- | ---: | ---: | ---: | ---: | ---: |
| No decree | 468 ± 0 | 27 ± 0 | 468 ± 0 | 27 ± 0 | 256 / 256 |
| Farmers must harvest | 468 ± 0 | 27 ± 0 | 468 ± 0 | 27 ± 0 | 256 / 256 |
| Farmers must harvest in the morning | 468 ± 0 | 27 ± 0 | 468 ± 0 | 27 ± 0 | 256 / 256 |
| Merchants must deliver | 468 ± 0 | 27 ± 0 | 468 ± 0 | 27 ± 0 | 256 / 256 |
| Harvest and delivery duties | 468 ± 0 | 27 ± 0 | 468 ± 0 | 27 ± 0 | 256 / 256 |
| Farmers must not harvest | 432.77 ± 24.00 | 3.19 ± 6.76 | 429.77 ± 23.74 | 2.22 ± 5.85 | 143 / 127 |

For each policy in each cohort, zero of 256 runs met the stock goal or both goals, with a 95% Wilson interval of 0–1.48% per arm and cohort. The four constructive policies each had a zero paired change in both end metrics and in joint wins. The harvest ban reduced average feeding by 7.34 percentage points (paired 95% interval −7.95 to −6.73) on exploratory seeds and by 7.96 points (−8.57 to −7.36) on holdout seeds. End stock fell by 23.81 units (−24.64 to −22.98) and 24.78 units (−25.49 to −24.06), respectively. The intervals describe the tested seeds and strategies, not every possible law sequence.

For the two delivery-duty arms, daily feeding or market stock first differed from no decree by day 3 in 211 exploratory and 222 holdout runs, and by day 12 in every run. Harvest duty alone and morning harvest duty reproduced both baseline metrics on every day. The combined policy averaged 213.91 known feasible duties, 172.28 completed duties, 271.18 infeasible perceived duties and 138.91 applicable-but-unaware observations per exploratory run. The harvest ban averaged 132.07 performed prohibitions. These are recorded counts with different denominators, not percentages of residents. The runner emits each policy’s legal journal inputs, distributions, Wilson intervals, paired differences and first-divergence day counts.

| Mean per run | No law / four constructive duties, both cohorts | Harvest ban, exploratory | Harvest ban, holdout |
| --- | ---: | ---: | ---: |
| Unaffordable meal units | 12 | 8.52 | 8.07 |
| Meal events with funds short while the market held food | 12 | 6.63 | 6.09 |
| Market-stock shortage units | 0 | 38.72 | 42.16 |
| Coins paid in guard wages | 192 | 192 | 192 |
| Coins moved on delivery transactions | about 563 | 491.58 | 486.69 |
| Delivery records with insufficient market funds | 0 | 0 | 0 |

The fixture starts with 45 market-food units and 450 field-food units. The five policies that left end metrics unchanged relative to each other used all 495 units, with 468 consumed and 27 market units remaining. To finish at 40 with that same feeding outcome would require at least 508 accounted food units before any producer or field remainder. The six foresters have no timber buyer, no paying alternative action and 20 starting coins against meals priced at two coins. Their 12 missed purchases in the no-decree arm are affordability shortfalls with stock present. Wages settle only for guards under this fixture, before meals. Food distribution pays growers and merchants from the market's funds. Statutory price changes, timber sales and player-directed transfers are outside current law grammar.

Published evidence includes the complete [exploratory summaries](evidence/task-06/rulecraft-task06-exploration.json), [holdout summaries](evidence/task-06/rulecraft-task06-holdout.json), [seed-42 daily totals and actual witness records](evidence/task-06/baseline-seed42-trace.json), [agent-study output](evidence/task-06/rulecraft-task06-agent-study.json) and [desktop benchmark output](evidence/task-06/rulecraft-task06-performance.json). Fully fed resident-days count completed full rations. The denominator is all daily resident meal opportunities. The stock outcome reads the final market account, excluding field and producer stocks. The witness file includes recorded actions, notices, food-access outcomes and ledger legs.

These comparisons do not exhaust all possible decree sequences. They rule out treating the tested objective pair and fixture as a balanced starting campaign. Lowering the stock threshold alone would also reward doing nothing. If the scenario is to move forward, the decision is whether to first test a transparent, versioned starting fixture that creates both supply and distribution choices with existing mechanics, or approve a scoped, funded transaction such as timber purchase with a real buyer account and price. A fixture candidate must show meaningful differences in win rates versus no laws and more than one plausible constructive path on fresh seeds before either mode promotes it to a campaign. An economy change requires a separate ledger and replay review and an explicit versioning decision. A prototype centred on actively managing distribution rather than ending stock is another design option if the resulting criteria reward legitimate agency. Approval of a fixture or objective is a separate decision.

## Regression and performance evidence

Local baseline checks passed `npm test` (151 tests in 19 files), `npm run typecheck`, `npm run build` and `RULECRAFT_CHROMIUM=/usr/bin/chromium npm run test:browser` (19 tests). The suite exercises v1–v4 golden replay, resource audit, typed laws and historical save continuation, draft and revision recovery, Chronicle links and actual PNG export. Browser tests used Chromium 156 on Debian.

The [persistence benchmark](evidence/task-06/Baseline_Runners.md#browser-persistence-benchmark) prepared an isolated 30-day save for Chromium 156 on desktop Debian, using a 390 × 844 touch-emulated viewport. All 25 typed laws were confirmed through the public law API before day 1, using an unlimited change allowance for benchmark setup only. The browser resumed that save off-menu and ran 30 real turns through the production shell, save worker and IndexedDB. All 30 writes completed. The final payload matched a separate Node replay byte for byte, and all five reloads passed replay verification. The ledger accounted for all 495 food, 120 timber and 1,500 coins.

| Measurement | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Turn resolution | 30 | 8.3 ms | 23.3 ms |
| Encode and save | 30 | 789.7 ms | 1,216.1 ms |
| Day-30 reload and verify | 5 | 1,897.0 ms | 2,160.5 ms |
| Narrative derivation | 30 | 4.1 ms | 8.0 ms |
| Main-thread long tasks during the trial | 45 | 96.0 ms | 320.0 ms |

The longest observed main-thread task was 334 ms. Asynchronous save latency exceeded 1 second at p95, which measures a wait, separate from main-thread blocking. The current payload was 20,777,358 bytes and the logical two-generation storage record was 46,760,395 bytes. Browser-reported heap samples were 8.4 MB, 84.9 MB and 77.3 MB at days 1, 12 and 30. These coarse heap snapshots depend on garbage collection and exclude worker and system memory. A downloaded Chronicle card took 105.8 ms to prepare and contained 226,681 bytes. With only five reload samples, the reported reload p95 is the maximum observed. An initial harness run reached day 30 but timed out waiting for an inexact status label after reload. Correcting the locator and rerunning the benchmark produced the results above.

These are desktop measurements. The 46.8 MB logical save, observed save wait and reload time warrant profiling on physical devices before offering a longer preset. The existing player-facing Sandbox limit remains 12 days. Open-ended Sandbox still requires a versioned continuation or retention design.

Reproduce from the repository root with Node 24.22.3. The [runner appendix](evidence/task-06/Baseline_Runners.md) provides the extractable research programs. Save the snippets locally before executing these commands.

```sh
node tools/task-06-campaign-study.mjs exploration > /tmp/rulecraft-task06-exploration.json
node tools/task-06-campaign-study.mjs holdout > /tmp/rulecraft-task06-holdout.json
npm run --silent study:society > /tmp/rulecraft-task06-agent-study.json
npm test
npm run typecheck
npm run build
RULECRAFT_CHROMIUM=/usr/bin/chromium npm run test:browser
npm run preview -- --host 127.0.0.1 --port 4176 --strictPort
```

With the local preview running, use a second shell for the isolated benchmark.

```sh
RULECRAFT_CHROMIUM=/usr/bin/chromium node tools/task-06-persistence-benchmark.mjs
```

## Acceptance matrix for the available baseline

**Pass** identifies the evidence exercised under the named conditions. **Fail** means the baseline misses the check. **Not Yet Tested** means the complete check or required device or participant was unavailable. This matrix does not sign off functionality awaiting the implementation gate. [Vertical-slice acceptance](03_Vertical_Slice.md#10-acceptance-tests--simulation-and-correctness) · [Technical gates](02_Technical_Systems.md#15-test-matrix-and-engineering-gates)

| ID | Result | Evidence or gap |
| --- | --- | --- |
| BUILD-01 | Fail | Four preview starts resume in Chromium. The baseline lacks versioned, data-driven Task 06 profiles and scenarios. `playable.e2e.mjs` |
| BUILD-02 | Pass | Valid farmer MUST is rendered, confirmed and active for the next turn. `playable.e2e.mjs`, `law-book.test.ts` |
| BUILD-03 | Pass | Changing farmer to guard resets harvest and prevents review. `playable.e2e.mjs` |
| BUILD-04 | Pass | The warned broad rest duty remains valid and enactable. `law.test.ts`, `law-book.test.ts` |
| BUILD-05 | Pass | Rival obligations/prohibitions can be enacted with conflict evidence and deterministic precedence. `law-book.test.ts` |
| BUILD-06 | Not Yet Tested | Amendment, suspension, reinstatement, abolition and stale awareness are covered. Exact day-3 amendment and day-5 repeal sequence was not exercised in the baseline browser test. `playable.e2e.mjs`, `social-patrol.test.ts` |
| BUILD-07 | Pass | An unavailable field rejects selection or logs execution failure without output. `turn.test.ts` |
| BUILD-08 | Pass | Grower inventory does not move into a market without delivery. `turn.test.ts`, `social-behaviour.test.ts` |
| BUILD-09 | Pass | Zero completed patrols produce no investigations or warnings. `social-patrol.test.ts` |
| BUILD-10 | Pass | Unfunded transactions are blocked or partial with recorded reasons and audited balances. `turn.test.ts`, `snapshot.test.ts` |
| BUILD-11 | Pass | Empty stock and affordability are separate meal outcomes. Hunger and ledger changes are evidence-backed. `turn.test.ts`, `social-behaviour.test.ts` |
| BUILD-12 | Pass | Versioned deterministic snapshots and golden state/event hashes. `snapshot.test.ts`, `law-choice.test.ts`, `task-03-run.test.mjs` |
| BUILD-13 | Pass | Campaign study uses 256 seed pairs in each set, with every audited run reaching day 12. The harvest ban varies across seeds. Outcome stagnation for constructive laws is a separate campaign blocker. |
| BUILD-14 | Pass | Re-ran the existing 256-seed v4 agent study. Added patrol capacity raised detections by 15.83 pp (95% CI 14.79–16.88); formal-warning risk raised rest choices by 48.99 pp (43.76–54.22) in 247 comparable pairs. `tools/task-03-study.mjs` |
| BUILD-15 | Pass | Gazette and adviser incidents open actual Royal Inquiry event and exact decree-version witnesses. `facts.test.ts`, `narrative.e2e.mjs` |
| BUILD-16 | Pass | Real local browser PNG checked for factual source text, exact versions, size, privacy and local-only requests. `share.test.ts`, `narrative.e2e.mjs` |
| BUILD-17 | Pass | Twelve-day resource audit and both campaign datasets passed. `snapshot.test.ts`, campaign study |
| BUILD-18 | Pass | Current checkpoint restore and historical v3 continuation verified with deterministic payload equality on Chromium. `reliability.e2e.mjs` |
| BUILD-19 | Not Yet Tested | Adding a new resource/action through registry and traversing it in the actual composer is unverified. |
| BUILD-20 | Not Yet Tested | Desktop benchmark is supporting evidence. The representative mid-range Android performance target requires a physical device. |
| BUILD-21 | Not Yet Tested | Physical Android Chrome and iOS Safari touch flows pending. Existing Issue #17 covers the known enlarged-text composer clipping. |
| BUILD-22 | Pass | Desktop Chromium drafts resume independently and quota errors, competing writers and failed commits preserve the last good revision. Physical background/kill coverage is tracked below. `playable.e2e.mjs`, `reliability.e2e.mjs` |
| BUILD-23 | Not Yet Tested | Physical phone share/save flow pending. Chromium downloads are covered under BUILD-16. |
| BUILD-24 | Pass | Node and desktop Chromium use the same v4 replay and saved bytes. Physical mobile runtime verification remains pending. |

| ID | Result | Evidence or gap |
| --- | --- | --- |
| LAW-01 | Pass | Invalid capability is rejected and incompatible composer descendants reset. `law.test.ts`, `playable.e2e.mjs` |
| LAW-02 | Pass | Warning-bearing broad laws are valid, and known duties alter work choices. `law.test.ts`, `law-choice.test.ts` |
| LAW-03 | Pass | Warning and winner provenance tested. `law-book.test.ts` |
| LAW-04 | Pass | Versioned awareness may lag legal changes. `law-book.test.ts`, `law-choice.test.ts` |
| LAW-05 | Pass | Repeal leaves historical facts and beliefs but excludes fresh sanctions. `social-patrol.test.ts` |
| LAW-06 | Pass | Permission effects and applicable but ineffective permissions are distinguished. `law-book.test.ts` |
| AGT-01 | Pass | Matched hunger comparison and feasibility/utility tests. `task-03-study.mjs`, `social-behaviour.test.ts` |
| AGT-02 | Pass | Matched awareness, capacity and prior-knowledge experiments show variable behaviour. `task-03-study.mjs` |
| AGT-03 | Pass | Empty stock produces a recorded selection or execution barrier. `turn.test.ts` |
| ECO-01 | Pass | Account-level audit and conservation checks across seeded runs. `snapshot.test.ts`, campaign study |
| ECO-02 | Pass | Allocations and detected cases respect completed patrol capacity. `social-patrol.test.ts` |
| RNG-01 | Pass | Fixed checkpoint and law-journal replay. `task-03-run.test.mjs` |
| RNG-02 | Pass | Seeded variation and scoped law/behaviour results with statistical uncertainty. Campaign and agent studies |
| MOD-01 | Pass | Shared AST interpretation for the existing Junior/Full exposure; the planned profile/save matrix awaits implementation. `law.test.ts` |
| NAR-01 | Pass | Candidate negative fixtures, linked witnesses and multi-decree export. `facts.test.ts`, `share.test.ts`, `narrative.e2e.mjs` |
| SCALE-01 | Not Yet Tested | End-to-end new resource/action/predicate extension experiment pending. |
| SAVE-01 | Pass | Known v1–v4 versions replay and corrupt or unsupported saves fail explicitly under the baseline. Task 06 envelope migration awaits implementation. `snapshot.test.ts`, `reliability.e2e.mjs` |
| MOB-01 | Pass | Touch-only flows on desktop Chromium emulation. Physical device coverage is tracked separately. `accessibility.e2e.mjs`, `playable.e2e.mjs` |
| MOB-02 | Not Yet Tested | Physical Android and iOS runtime digests pending. Desktop Chromium and Node evidence in BUILD-24. |
| MOB-03 | Not Yet Tested | Real suspend, OS kill and resume pending. Atomic failure injection, competing writers and reload passed in desktop Chromium. |
| MOB-04 | Pass | Platform boundaries and native adapter seams documented. [Architecture report](04_Task_00_Architecture.md) |

## Product and device follow-through

| Test | Result | Procedure once available |
| --- | --- | --- |
| Android Chrome | Not Yet Tested | Record model, OS, browser, viewport, orientation and text scale. Use an owner-approved private origin or local device test. Run setup, author/amend/abolish, advance, evidence chain, share/PNG fallback, draft recovery, suspend/kill/reopen, offline interruption and two-generation verification. |
| iOS Safari | Not Yet Tested | Repeat Android protocol plus safe-area, keyboard, iOS save/share sheet and restore. Record image handling separately from Chromium. |
| Physical 30-day performance | Not Yet Tested | Run the isolated 40 × 25 × 30 fixture on each device. Capture p50/p95 turns and save/replay, long tasks, logical IndexedDB bytes and heap/resource growth proxy. Compare provisionally against 150/500 ms and inspect >1-second UI locks. |
| Consented first-time Junior | Not Yet Tested | With guardian permission, observe first unaided decree, explanation of who it affects and when, one matched evidence trail, a revision, and the distinction between stock and affordability. Note assistance, confusion, humour and retry intent without collecting names or sending telemetry. |
| First-time Full | Not Yet Tested | Observe a prediction, distinction between current and perceived law, an unexpected consequence and voluntary decree revision. Record qualitative agency, frustration and humour findings with sample size and consent. |
| Structured Campaign, versioned profiles and finite Sandbox presets | Not Yet Tested | Gameplay implementation awaits the design gate. The campaign balance finding applies to the measured fixture and strategies. A 30-day desktop run provides neither new gameplay nor evidence for a phone-ready horizon. |

The provisional campaign is **Not Balanced / Blocked**. The 30-day Sandbox remains subject to its separate persistence and provenance gate. The existing timed Sandbox preview should still be described as a 12-day trial. There is no first-playable product sign-off.
