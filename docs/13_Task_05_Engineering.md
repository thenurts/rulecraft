# Task 05 engineering report

The Gazette and Royal Chronicle derive stories from actual saved event, law, notice and investigation records. Decree authoring, day advancement, the raw action records and Royal Inquiry remain available. All content stays on the device. The simulation package, decree rules, resource ledger, engine selection and IndexedDB save format have no source changes in this PR. [Issue #15](https://github.com/thenurts/rulecraft/issues/15) · [Design contract](12_Task_05_Narrative_Advisers.md)

## Implementation and evidence

| Increment | Changes | Actual results |
| --- | --- | --- |
| 1. Truthful incidents | Typed fact extraction and stable incident identity in `apps/web/src/narrative/facts.ts`. Verifies witnesses, legal applicability and record identity before allowing a family. | `npm test` passed 139 tests. `npm run build` passed. Sampled seed 42 plus seeds 0–31. |
| 2. Advisers and selection | Versioned Junior and Full text, adviser lenses, labelled storybook captions and deterministic editorial ordering in `copy.ts` and `projection.ts`. | `npm test` passed 143 tests. `npm run build` passed. Replay, shared Junior/Full facts and daily affordability coverage passed. |
| 3. Playable integration | One top story on day results, up to three in Gazette, Chronicle filters, actual Inquiry links and local share-card rendering. | `npm test` passed 146 tests. `npm run build` passed. The 16 existing browser flows passed after the integration. |
| 4. QA and review | Browser evidence, quiet-day and invalid-law tests, coverage runner, screenshots, documentation and historical golden checks. | **147 tests across 19 files, 18 Playwright tests, standalone type checks and production build passed locally.** |

The projection checks direct evidence before using causal wording. A recorded education witness requires a real performed prohibition, completed public patrol, lack of knowledge of the current version and a matching notice. A warning requires prior knowledge and a formal warning disposition. Meal shortfalls use individual meal events. Insufficient funds with stock present is a contextual finding and carries no decree attribution. An all-fed story needs the same complete population in the daily totals and individual meal records.

The following negative cases were exercised alongside real positive witnesses.

| Family | Near miss examined |
| --- | --- |
| Unaffordable meal | A resident with neither coins nor market food does not prove food was available to buy. |
| Funded stockout | Missing funds with available food does not prove a stock shortage. |
| Education | A missing notice, missing patrol or inapplicable prohibition suppresses the educational narrative. |
| Formal warning | A missing or inapplicable law and a missing patrol suppress the warning even when an investigation references it. |
| Patrol capacity | Removing completed patrol witnesses suppresses the gap. Only performed public acts without an investigation count towards this story, and the eligible patrols must have used their recorded capacity. |
| Fatigue | Removing the work records whose feasibility or execution was blocked by fatigue suppresses the story. |
| Competing duties | Removing knowledge notices or making the second action infeasible suppresses the story. |
| Meals served | A daily total without the matching meal records cannot produce the story. |

The global `village-record-1` registry uses one projection for Junior and Full. Reading mode changes adviser language only, with identical evidence, counts and template IDs. The Chronicle derives its list in day order from the saved simulation. Later laws and future days leave earlier incident identities and wording stable. Chronicle and card annotations show current or historic decree status as applicable. On a 12-day browser reload, all 36 selected entries matched in order and visible text, and both IndexedDB world generations matched byte for byte. Opening and exporting a share card also preserved the stored generation.

## Narrative coverage

Reproduce with `node tools/task-05-coverage.mjs`. The fixed run used a morning harvest prohibition and guard patrol duty, for seed 42 plus every seed from 0 to 31. This is a coverage sample of one scenario with varying seeds. Targeted fixtures exercise more extreme conditions.

| Incident family | Eligible in 396 completed days | Selected |
| --- | ---: | ---: |
| Food present, funds short | 66 | 66 |
| Funded stockout | 0 | 0 |
| Patrol education | 103 | 103 |
| Formal warning | 198 | 198 |
| Patrol capacity gap | 112 | 112 |
| Fatigue blocked work | 310 | 288 |
| Competing known feasible duties | 0 | 0 |
| All residents fully fed | 330 | 243 |
| **Total** | **1,119** | **1,010** |

A funded stockout was reproduced in a small forester village with coins and an empty market. Competing duties were reproduced when farmers knew two feasible duties for one slot. Neither condition occurred in the fixed sweep. The sample had **0** days without eligible stories, **0** days without selected stories and **0** detector or cooldown diagnostics. A separate completed-day fixture with no eligible source showed no forced story. The day cap held at three, with no duplicate families within a day. All 66 supported affordability stories were selected. A separate 12-day persistent-shortfall fixture kept the serious finding visible every day.

| Adviser | Selected responses | Distinct response templates observed |
| --- | ---: | ---: |
| Zoey | 159 | 4 |
| Liam | 413 | 12 |
| Mia | 212 | 3 |
| Noah | 226 | 5 |

The study exercised 24 headline templates, with at least 16 distinct headline templates in each 12-day trial. Across trials there were 364 within-trial headline-template reuses. There were at least three complete intervening days for every reuse and zero cooldown violations. There were 375 within-trial adviser-template reuses. The counts matched when deduplicating by exact rendered Full text. Adviser wording rotates independently, with reuse allowed if the eligible alternatives have recently appeared. The coverage command prints counts by response template and day-by-day seed-42 examples.

The seed-42 Gazette opened on day 1 with **A rule learned on patrol**, **Acts left uninvestigated**, and **A full meal for everyone**. Day 2 included **Formal warning recorded** and **Fatigue narrowed the choices**. Days 11 and 12 showed **A gap at the counter** and **Food on the shelf, coins short**, respectively. In the rule-free share example, Mia’s Junior verdict “Give this row of the ledger a ribbon” appears with 40 of 40 residents fully fed. The ribbon is a figure of speech. The underlying evidence is the completed meal records. The duties template “Two musts walked into one slot. Only one could leave as an action” requires two applicable, known and feasible obligations and says nothing about the resident’s motive.

## Reproduction, conservation and browser evidence

Run from the repository root with Node 24.22.3. The local browser verification used Chromium 156 on Debian.

```sh
npm ci --cache /tmp/rulecraft-npm-cache
npm test
npm run typecheck
npm run build
RULECRAFT_CHROMIUM=/usr/bin/chromium RULECRAFT_NARRATIVE_SCREENSHOTS=docs/screenshots/task-05 npm run test:browser
node tools/task-05-coverage.mjs
npm run --silent simulate -- --seed 42
npm run --silent simulate:law
npm run --silent simulate:society
git diff --check
```

These commands passed. The existing golden runs and replay suite verified the following seed-42 digests. The v4 checkpoint example replayed byte-identically through day 12 and reconciled 888 transactions and 2,232 movements. Its audit accounts for 495 food units as 468 consumed and 27 remaining. All 120 timber and 1,500 coins remained accounted for.

| Engine and scenario | State | Events |
| --- | --- | --- |
| v1 rule-free | `713a9e709bf6e873` | `72f67e9184e65e5f` |
| v2 law example | `6d3f0260b1cde92c` | `a9114ded8e11a629` |
| v3 historical society | `375123c46edf3305` | `75b6f979dc9dd357` |
| v4 corrected society | `f4c46dbfd1b05523` | `076d885f324114cf` |

Playwright used actual touch interactions to advance a village, investigate an incident’s exact witness ID and open the associated decree version. On abolishing the decree and advancing, Chronicle marked its earlier version historical. The Chronicle remained filterable by day, topic and adviser. The full action log was still visible on demand. At 320px and 200% root text the Chronicle and share card fit the viewport, their story and export actions stayed at least 44px tall, and Chronicle’s filter options fit within their controls. Keyboard focus reached the new screens and controls. Playwright checked the navigation semantics and accessible control names.

GitHub’s bundled Chromium exposed a font-width difference in the enlarged-text Chronicle filter. The `Meals served` label was shortened to `Meals`; the browser test still checks the width of every option. GitHub Actions now surfaces browser test failures directly in the PR checks.

The real browser download produced a **1080 × 1350 PNG**. The test checked the PNG signature, header dimensions, two decoded pixels and the exact text sent to Canvas against the selectable card text. The test exercised both an unavailable PNG encoder and an unavailable download API. The verified fallback remained selectable and the status described the failure. The flow observed no remote requests and no save identifier in the card text or PNG data. The historic decree test confirmed the exact source version and its status on the incident day.

### PR #19 review correction

The share preview, selectable text and PNG now list every linked decree version under **Linked decrees**. Each entry gives the Decree Book number, exact version and wording, and its status on the incident day. Historic and operative labels describe the version as of the loaded save. If the incident references an older perceived version while a different version was official, the card identifies both statuses. Single-decree and village-report headings are retained. The correction uses the existing narrative references and does not change the simulation, story detectors or adviser text. [Product-owner review](https://github.com/thenurts/rulecraft/pull/19#pullrequestreview-6004772440)

The shared competing-duties fixture produces two known, feasible duties for the same slot. Regression tests verify that both version 1 decrees appear exactly once, preserve their incident-day status after a later abolition, and distinguish perceived version 1 from official suspended version 2 in a separate day-2 case. The Chromium test downloads and inspects a 1080 × 1350 PNG, compares the full rendered text to the selectable version, and checks every line’s bounds. Font-width stress tests exercise wrapping and smaller type. When the complete card cannot fit, export stops before painting or encoding, and the web view opens the full text with an explanation. [Downloaded competing-duties PNG](screenshots/task-05/example-competing-duties.png)

The correction passed `npm test` (151 tests across 19 files), `npm run typecheck`, `npm run build`, `RULECRAFT_CHROMIUM=/usr/bin/chromium npm run test:browser` (19 tests) and `git diff --check`. The save/reload evidence applies to the current global catalogue. Per-save catalogue selection remains a future compatibility decision before new narrative copy is shipped.

### Local measurements

The browser ran the 12-day harvest-ban trial using the production preview. Projection timings cover the pure narrative derivation and exclude DOM paint. Save time covers worker encoding and IndexedDB commit. Reload time covers reading and verifying the saved generation.

| Measurement | Task 05 observed | Task 04 reported |
| --- | ---: | ---: |
| Median turn resolution, 12 samples | 3.35 ms | 3.15 ms |
| Median save, 12 samples | 104.55 ms | 62.80 ms |
| Day 12 encode and commit | 140.80 ms | 85.40 ms |
| Day 12 read and replay verification | 251.80 ms | 173.20 ms |
| Day 12 canonical world payload | 2,138,017 bytes | 2,138,017 bytes |
| Latest and previous world generations, serialised | 4,747,831 bytes | 4,747,831 bytes |
| Median narrative projection, 12 samples | 1.90 ms | — |
| Day 12 narrative projection on reload | 11.20 ms | — |
| PNG generation through download request | 51.90 ms | — |
| Downloaded PNG size | 127,137 bytes | — |

These are individual local browser runs. The Task 04 figures came from a separate session, so the observed timing differences do not isolate the cost of this change. [Task 04 measurements](11_Task_04_Engineering.md#browser-measurements)

## Screenshots and open review points

- [390px Gazette with an education incident](screenshots/task-05/gazette-390.png)
- [320px Chronicle filters at 200% text](screenshots/task-05/chronicle-320-200-percent.png)
- [320px Chronicle story at 200% text](screenshots/task-05/chronicle-story-320-200-percent.png)
- [390px share preview with selectable fallback](screenshots/task-05/share-preview-390.png)
- [Actual downloaded PNG](screenshots/task-05/example-day-1.png)

Physical Android Chrome and iOS Safari are **Not Yet Tested**, including platform image saving. Browser automation covered DOM and accessibility semantics. A manual screen-reader session has yet to be performed. The pre-existing Task 04 composer’s enlarged-text select clipping is a separate follow-up. Hosted access and native packaging are outside this PR.

Liam delivered 41% of responses in the patrol-heavy study. The humour, balance of adviser appearances, rate of all-fed stories and Junior reading level still need playtesting. The advisers use name tabs with typography. Approval and supply of canonical artwork remain separate. The scenario supports a factual success story about all residents being fed. A broader beneficial-absurdity family would need independent engine evidence.
