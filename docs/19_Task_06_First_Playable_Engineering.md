# Task 06 first-playable engineering report

This review build adds versioned starts, an evidence-led Hungry Village introduction and a bounded Sandbox to the existing Rulecraft shell. It follows the implementation authorisation on issue #20 and the merged design, mission and persistence studies. [Implementation authorisation](https://github.com/thenurts/rulecraft/issues/20#issuecomment-7063626449) · [Mode design](14_Task_06_Modes_Campaign_Sandbox.md) · [Mission research](17_Hungry_Village_Introductory_Mission.md) · [Persistence research](18_Compressed_Save_Research.md)

## What to try

1. Start The Hungry Village. Inspect the opening stocks and meal price, then compose a decree. The teaching prompt explains that a confirmed rule can take effect before residents learn it.
2. Advance to day six. Compare the 240 recorded meal opportunities, distinguish units residents could not afford from funded units the market could not supply, and follow the linked harvest, delivery, notice, or meal in Royal Inquiry. Resume or revise a decree.
3. Complete day 12. The debrief accounts for all 480 opportunities and shows missed meals across occupations and residents with repeated or consecutive misses. Revisit day six from Village. The Chronicle and Gazette remain available from the existing navigation.
4. Start a 12-day Sandbox experiment with either preset. Its seed is editable before starting. Compare days, follow prior records and repeat the experiment with the same preset and seed or another seed. A retry creates a new village only after explicit replacement confirmation.

Junior and Full use the same candidate world and engine for a given seed and preset. Junior provides short evidence prompts and exposes one optional clause after day six in Campaign, initially offering slot, market food or fatigue. Junior Sandbox has one optional clause from the start and all supported predicates. Full exposes both clause types and detailed evidence. A previously authored clause stays visible when reopening an existing law. Legislative operations are still limited by the existing shared engine policy.

## Architecture and evidence boundaries

- `profiles.ts` validates profile/version, scenario/version, permitted preset and uint32 seed. The Campaign uses the approved 21-farmer, six-forester, five-merchant and eight-guard fixture, with the original stocks, prices, funds and wages. Sandbox includes that preset and the original 16/6/10/8 mix. The frozen registry feeds the existing v4 initialiser. The scenario setup lives beside the canonical plain snapshot in the existing IndexedDB generation record. Same-session setup, seed, engine version and fixture are checked on commit. Loading revalidates the registry metadata against the verified engine world and can recover the last verified generation. Saves without setup metadata still open as their original v3/v4 previews.
- The existing two-generation transaction, revision conflict handling, separate draft store and worker codec remain in use. An accepted restart gets a new session ID and leaves the former committed generation available for recovery. The historical v3/v4 engine payloads and v1/v2 independent readers retain their original contracts. The storage research prototype is separate.
- The Campaign score is a sum of recorded daily fully fed counts. Its diagnostic totals are derived from resident-meal events. The miss streak is a daily run of missed full rations for an individual resident. Three misses is a labelled diagnostic cut, and it never controls completion. The checkpoint uses only records through day six. “Knew and delivered” needs a completed delivery transaction and matching actual/perceived requirement, exact decree version and recorded notice. Other witness copy describes the observed transfer or barrier. The mission does not generate a same-seed control inside a live game.
- The old 90%/40 figure remains visible only in legacy Campaign previews. Modern Campaign completes on day 12 with evidence and a debrief. Modern Sandbox ends at its stated day limit with facts and trends. The evidence model, original economy, decree semantics, narrative templates and canonical engine snapshots are unchanged.

## Tests by increment

Each increment ran the local equivalent of the CI workflow. The repository runs hosted CI on pull requests, so the completed implementation is the first hosted run for these increments.

| Increment | Unit and integration | Chromium browser | Typecheck and production build |
| --- | ---: | ---: | --- |
| 1. Profiles and session setup | 161 / 161 | 19 / 19 | Pass |
| 2. Hungry Village | 163 / 163 | 20 / 20 | Pass |
| 3. Bounded Sandbox and seed/retries | 164 / 164 | 21 / 21 | Pass |
| 4. Responsive QA and acceptance | 165 / 165 | 23 / 23 | Pass |

```sh
npm test
npm run typecheck
npm run build
RULECRAFT_CHROMIUM=/usr/bin/chromium npm run test:browser
```

Reproduce the Task 06 screenshots with `RULECRAFT_TASK06_SCREENSHOTS=/tmp/rulecraft-task06-screens` and `npm run test:browser -- task-06` after building. The legacy and scenario tests cover new starts in both modes, v3 and v4 preview continuation, permission to resume only the saved profile, distinct seed and preset validation, and matching world bytes after same-seed restart. Existing corruption, interruption, stale-tab, draft, ledger and export suites remain active.

## Actual campaign evidence and performance

The evidence for meaningful policy differences remains the existing matched experiments. In the merged 256-seed holdout, a public delivery decree improved feeding by 21.09 resident-days per run (95% interval 19.98–22.19), reduced stock shortfalls by 22.61 units and increased affordability shortfalls by 1.53 units. The distinct merchant-rest approach in the later 128-seed holdout reduced merchant fatigue blocks and worsened feeding by 3.63 resident-days. These are research effects for explicit stored command sequences, separate from the player-facing explanation of a specific run. [Fixture study](16_Task_06_Fixture_and_Persistence_Study.md) · [Introductory mission study](17_Hungry_Village_Introductory_Mission.md)

The authored browser run used Junior, seed 20000 and a merchant delivery duty. It recorded **225/240** resident-days fully fed by day six. The test followed a recorded delivery into Inquiry, then amended the duty to apply in the afternoon from day seven. The run ended at **413/480**, with 62 funded units unavailable and five units unaffordable. All 67 missed full rations reconcile to those recorded shortfalls. This is one observed playthrough, separate from the matched causal study. The Sandbox browser test completed day 12 at seed zero and reproduced its exact day-zero payload after a same-seed retry. An explicit new-seed retry stored 4,294,967,295 and a different opening snapshot.

The production-preview benchmark used Chromium 156.0.8078.79 on desktop Debian, one 12-day campaign with a farmer harvest prohibition and five reopens of the identical final save. Measurement starts at turn resolution, at save encoding and at load verification respectively. Browser save includes the worker and IndexedDB commit. Reload includes reading the generation and replay verification. The 95th percentile uses nearest rank and equals the maximum in these sample sizes.

| Measurement | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Synchronous turn resolution | 12 | 3.45 ms | 10.60 ms |
| Encode and commit | 12 | 91.70 ms | 150.10 ms |
| Day-12 read and verify | 5 | 244.40 ms | 339.70 ms |
| Narrative projection | 12 | 1.90 ms | 5.40 ms |

Day-12 save took 140.50 ms. The latest canonical payload was 2,273,694 bytes and the logical two-generation record was 5,034,912 bytes. The longest observed main-thread task was 66 ms. All 35 Chronicle entries reproduced in order and text after reload. The downloaded rule-free sample PNG was 127,137 bytes and took 29.70 ms to generate and request in the existing browser smoke test. Actual device storage overhead and timing may differ.

The benchmark ledger verified 787 transactions and 1,845 movements, with 495 food units accounted for as 393 consumed and 102 remaining. All 120 timber and 1,500 coins were accounted for. Historical replay hashes matched the published values. The v1, v2 and v4 commands below and the v3/v4 golden test were executed.

| Golden scenario | State hash | Event hash |
| --- | --- | --- |
| v1 rule-free | `713a9e709bf6e873` | `72f67e9184e65e5f` |
| v2 law example | `6d3f0260b1cde92c` | `a9114ded8e11a629` |
| v3 historical society | `375123c46edf3305` | `75b6f979dc9dd357` |
| v4 corrected society | `f4c46dbfd1b05523` | `076d885f324114cf` |

```sh
npm run --silent simulate -- --seed 42
npm run --silent simulate:law
npm run --silent simulate:society
```


## Visual and accessibility evidence

The composer uses native select semantics over a wrapping display of the current option. The displayed value and the picker's option come from the same registry label. A keyboard focus ring is visible for the whole control. Browser assertions check actual line rectangles, the heading’s first word, no document overflow, 44 CSS-pixel hit targets, selection and readable validation at 320 and 390 CSS pixels at 100% and 200% root text size. This is desktop Chromium with touch emulation. A real OS picker, VoiceOver and TalkBack still need testing. [Issue #17](https://github.com/thenurts/rulecraft/issues/17)

- [Opening, 390 px](screenshots/task-06/hungry-village-390.png)
- [Day-six checkpoint and evidence links, 390 px](screenshots/task-06/checkpoint-390.png)
- [Day-12 factual debrief, 390 px](screenshots/task-06/debrief-390.png)
- [Sandbox setup, 390 px](screenshots/task-06/sandbox-setup-390.png)
- [Sandbox outcomes and day comparison, 390 px](screenshots/task-06/sandbox-complete-390.png)
- [Composer selected values, 320 px with 200% text](screenshots/task-06/composer-320-200-percent.png)

## BUILD-01–24 acceptance matrix

Pass below is specific to the evidence supplied. Desktop Chromium does not validate physical devices. [Acceptance specification](03_Vertical_Slice.md#10-acceptance-tests--simulation-and-correctness)

| ID | Status | Evidence |
| --- | --- | --- |
| BUILD-01 | Pass | Both profiles launch in each track. Versioned metadata persists and Junior campaign unlock is visible at day six. `playable.e2e.mjs`, `task-06.e2e.mjs`, `world.test.ts`. |
| BUILD-02 | Pass | Confirmed farmer obligation, generated wording, typed command and next-turn activation. `playable.e2e.mjs`, `law-book.test.ts`. |
| BUILD-03 | Pass | Farmer-to-guard selection clears incompatible harvest action and blocks review. `playable.e2e.mjs`. |
| BUILD-04 | Pass | Broad rest obligation remains legal with a warning. `law.test.ts`, `save-store.test.ts`. |
| BUILD-05 | Pass | Opposing obligations are warned, may enact and resolve deterministically. `law-book.test.ts`, `law-choice.test.ts`. |
| BUILD-06 | Pass | Day-three amendment and day-five repeal preserve event history with no fresh sanction. A separate kernel test exercises stale belief after repeal. `world.test.ts`, `social-patrol.test.ts`. |
| BUILD-07 | Pass | Empty field keeps production at zero with recorded feasibility or execution failure. `turn.test.ts`. |
| BUILD-08 | Pass | No delivery leaves harvested food with growers. `turn.test.ts`, `social-behaviour.test.ts`. |
| BUILD-09 | Pass | No completed patrol means no investigations or warnings. `social-patrol.test.ts`. |
| BUILD-10 | Pass | Blocked and partial unfunded actions and wages preserve nonnegative accounts. `turn.test.ts`, `snapshot.test.ts`. |
| BUILD-11 | Pass | Purchases distinguish funding and stock shortages, with hunger and exact meal witnesses. `social-behaviour.test.ts`, `mission.test.ts`, `task-06.e2e.mjs`. |
| BUILD-12 | Pass | v1–v4 golden replay and byte-identical Junior/Full runs under the same inputs. `world.test.ts`, `snapshot.test.ts`, `task-03-run.test.mjs`. |
| BUILD-13 | Pass | Previously published 256-seed matched exploration and separate 256-seed fixture holdout, plus the independent 128-seed mission study. See the linked research. |
| BUILD-14 | Pass | Earlier 256-seed patrol capacity and evidence-based compliance study reports uncertainty. [Baseline matrix and outputs](15_Task_06_Preimplementation_Evidence.md). |
| BUILD-15 | Pass | Gazette and adviser stories resolve to source events and correct law versions. `facts.test.ts`, `narrative.e2e.mjs`. |
| BUILD-16 | Pass | Browser PNG is local and factual, includes multiple linked versions when applicable and preserves the text fallback. `share.test.ts`, `narrative.e2e.mjs`. |
| BUILD-17 | Pass | Day-12 audit reconciles food, timber and coins and confirms every recorded resource movement. `snapshot.test.ts`, `reliability.e2e.mjs`. |
| BUILD-18 | Pass | v3, v4 preview and current setup resume with verified engine state. `task-06.e2e.mjs`, `reliability.e2e.mjs`. |
| BUILD-19 | Not Yet Tested | An end-to-end resource/action registry extension through the composer is outside this build. |
| BUILD-20 | Not Yet Tested | Prior 40 × 25 × 30 desktop research exists. The requested physical mid-range benchmark and end-to-end budget remain unverified. |
| BUILD-21 | Not Yet Tested | Automated touch, orientation and enlarged-text checks passed in Chromium. Physical Android Chrome and iOS Safari flows are untested. |
| BUILD-22 | Pass | Desktop interruption injection, separate draft recovery and atomic save checks passed. Physical lifecycle testing is tracked separately. `reliability.e2e.mjs`. |
| BUILD-23 | Not Yet Tested | The automated desktop PNG check passed. Physical phone download and share-sheet behaviour are untested. |
| BUILD-24 | Pass | Node can verify the exact Chromium world bytes, including legacy replay. Device-runtime comparison remains pending. `task-06.e2e.mjs`, `reliability.e2e.mjs`. |

| Technical contract | Status | Evidence |
| --- | --- | --- |
| LAW-01–06 | Pass | Typed grammar and capability rejection, conflict/provenance, awareness and definitive repeal checked in `law.test.ts`, `law-book.test.ts`, `law-choice.test.ts` and `social-patrol.test.ts`. |
| AGT-01–03, ECO-01–02 | Pass | Utility effects, variable awareness and patrol, feasible choice and account-level conservation. Kernel tests and the earlier matched agent study. |
| RNG-01–02, MOD-01 | Pass | Golden snapshots, cohort variation and byte-identical cross-mode outcomes when a command is shared. |
| NAR-01, SAVE-01 | Pass | Witness rejection, Gazette, Inquiry and PNG source links, plain save recovery, and explicit invalid-metadata or engine-version handling. |
| SCALE-01 | Not Yet Tested | Same end-to-end registry extension gap as BUILD-19. |
| MOB-01 | Pass | Desktop emulated touch-only flow and 44 CSS-pixel hit targets. |
| MOB-02, MOB-03 | Not Yet Tested | Physical runtime and lifecycle verification. Desktop cross-runtime digests and fault injection were verified separately. |
| MOB-04 | Pass | Existing documented native adapter seams. |

[Prior technical matrix and detailed evidence](15_Task_06_Preimplementation_Evidence.md#acceptance-matrix-for-the-available-baseline)

## Product validation and review gate

| Check | Result |
| --- | --- |
| Physical Android Chrome and iOS Safari | **Not Yet Tested** for viewport, safe area, keyboard, native picker, IndexedDB quota, PNG saving, lifecycle/background/recovery, offline interruption and performance. |
| Manual screen-reader sessions | **Not Yet Tested**. Role/name assertions and browser keyboard focus were checked. |
| Consented first-time Junior and Full playtests | **Not Yet Tested**. Follow the [mission study protocol](17_Hungry_Village_Introductory_Mission.md#pre-playtest-protocol-and-risk-register). |
| Production migration, expanded Sandbox and deployment | Separate approval and evidence gates. |

When physical sessions are available, record device, OS/browser and viewport. Try tap-only authoring and amendments, selected values at enlarged type, checkpoint and debrief navigation, and a real PNG download. Background/kill during draft and save, test low-storage recovery, then verify the earlier Inquiry and Chronicle. Record turn and save/read distributions separately. For novice sessions obtain the appropriate consent and record unaided decree authoring, one prediction, one actual outcome, evidence interpretation, a deliberate revision and retry interest.

The owner still needs to judge Junior readability and difficulty, the explanatory value of the checkpoint, and whether to pursue separate age-specific presets or a controlled reference run. The supported strategy evidence describes a guided puzzle with one demonstrated constructive mechanism, and the existing candidate can still leave substantial hardship. Final victory thresholds, separate Junior balancing and longer play remain review decisions. This PR is the Task 06 implementation review gate.
