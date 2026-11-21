# Task 03 · Autonomous village

[Issue #7](https://github.com/thenurts/rulecraft/issues/7) and the [merged contract](08_Task_03_Autonomous_Society.md) define the milestone.

## Matched-seed evaluation plan

The comparison uses exactly 256 distinct seeds, integers 0–255. Within each comparison, both arms share the seed and the unchanged inputs. Measure the named output and denominator in the table. For capacity, risk and field allocation, omit a pair only when its stated opportunity denominator is zero. Report the aggregate numerators and denominators plus the mean per-seed paired difference and its approximate 95% confidence interval (paired mean ± 1.96 standard errors). Each seed has equal weight in the interval. These intervals describe the simulation under these scenarios. They carry no claim about people, and there is no multiplicity adjustment. All endpoints and coefficients below are fixed before running the evaluation.

| Endpoint | Control → treatment | Denominator and expected direction |
|---|---|---|
| Learned by dawn three | Bulletin 750 → 3,000 bp, peer settings unchanged, investigations disabled | All 40 citizens for the same decree version, expect higher learned share |
| Detected public harvest | One → three investigations per completed patrol, same 6,000 bp detection chance | All actually prohibited harvest actions in day one, expect higher detected share |
| Restraint after warning | Remembered warning deterrence 0 → 50 weight, otherwise identical first-day warning experience | Day-two morning candidates warned for harvesting on day one, known prohibition and physically feasible harvest in both arms, expect higher rest share |
| Hunger | Identical test opening state except farmer hunger 0 → 5 | Feasible morning harvest choices for the focal farmer, expect higher work share where funded earning is possible |
| Opportunity to earn | Market funds 0 → 200 coins with a merchant and available crop | Feasible morning harvest choices for the focal farmer, expect higher work share |
| Fatigue | Fixed opening fatigue 10 → 75, both below the physical limit | Feasible morning harvest choices for the focal farmer, expect higher rest share |
| Fair field access | Compare the lower-ID farmer's winner share to 50% | Morning slots in which two equally configured farmers selected the single available field place, expect no persistent early-ID advantage |
| Fair meal access | Compare the lower-ID buyer's winner share to 50% | Two equally funded applicants for the single ration, expect no persistent early-ID advantage |

Hunger is a controlled headless study intervention on input state. The example replay uses factory-generated starting state and the normal turn API. For directionality comparisons an interval spanning zero is inconclusive and a contrary result will be reported as such. For fairness an interval spanning zero means the sample gives no clear directional evidence of an ID advantage.

## Observed study results

| Comparison | Pairs | Control count | Treatment count | Paired effect and 95% CI, pp |
|---|---:|---:|---:|---:|
| Learned by dawn three | 256 | 3,469/10,240 | 8,492/10,240 | +49.05 [47.77, 50.34] |
| Detected public harvest | 256 | 236/3,270 | 749/3,270 | +15.83 [14.79, 16.88] |
| Restraint after warning | 247 | 182/380 | 361/380 | +45.75 [40.55, 50.95] |
| Hungry farmer chose work | 256 | 196/256 | 203/256 | +2.73 [0.73, 4.74] |
| Funded earning opportunity | 256 | 187/256 | 196/256 | +3.52 [1.26, 5.78] |
| Tired farmer chose rest | 256 | 58/256 | 79/256 | +8.20 [4.83, 11.57] |
| Early-ID field wins against 50% | 255 | 127.5/255 expected | 129/255 | +0.59 [−5.56, 6.74] |
| Early-ID meal wins against 50% | 256 | 128/256 expected | 128/256 | 0.00 [−6.14, 6.14] |

Nine risk pairs yielded no comparable warned and feasible opportunity. In one field pair only one farmer selected the field action. Hunger and income effects are positive but modest in these fixtures. Both fairness intervals span zero. This sample gives no clear evidence of early-ID advantage in those contests and does not prove the absence of smaller or other allocation biases. The risk effect is comparatively large under the targeted warning scenario and warrants later calibration.

## Reproduce and audit the 12-day case

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run --silent study:society
npm run --silent simulate:society
npm run --silent simulate -- --seed 42
npm run --silent simulate:law
```

The v3 example uses seed 42, a morning harvest ban and a patrol duty. It encountered gradual learning, distinct actual and perceived law evidence, patrols, warning dispositions and recorded attitude changes. Two versions among 40 residents create 80 possible citizen/version records. Dawn one delivered 20 notices from the bulletin. Dawn two delivered 23, including 14 through known peers. There were 16 warnings over 142 completed patrols, with 46 investigations for 58 prohibited acts. The recorded attitude range at day 12 was −81 to 0, trust 45 to 84 and hunger 0 to 2. On each of days 11 and 12, six food units went unmet through affordability, with no shortage of market stock. This is a prototype welfare outcome.

The Node runner interrupting promotion of turn seven restored day six and produced byte-identical output to the uninterrupted day-12 run. Desktop Chromium 156 repeated encode/load at day six and matched the Node hashes and audit.

| Replay | State digest | Event digest |
|---|---|---|
| v1 rule-free, seed 42 | `713a9e709bf6e873` | `72f67e9184e65e5f` |
| v2 law example, seed 42 | `6d3f0260b1cde92c` | `a9114ded8e11a629` |
| v3 society example, seed 42 | `375123c46edf3305` | `75b6f979dc9dd357` |

The v3 audit reconciled 888 transactions and 2,254 movements. From genesis, 495 food units = 468 consumed + 27 remaining. All 120 timber and 1,500 coins remained accounted for, with no negative account. There were 2,292 village events and 3,446 total per-day records including news, experience, allocations and patrol evidence. The day-6 two-snapshot file was 2,874,149 bytes and the day-12 payload was 2,524,323 bytes. One Linux sample measured 211.39 ms for load and full replay through day six, and 2.51 ms median over 18 in-memory turn samples. These are single-host measurements, with neither device performance nor scalability established.

### Evidence and scope

| Increment | Actual checks |
|---|---|
| 1 · Awareness and clock | Lockfile install passed. `npm test` passed 103 tests in 10 files. Type checks and production build passed. |
| 2 · Decisions and fairness | `npm test` passed 108 tests in 11 files. Type checks and production build passed. |
| 3 · Patrol-limited warning | `npm test` passed 114 tests in 12 files. Type checks and production build passed. The first run exposed two dawn-only tests that now needed to isolate the independent patrol education channel. |
| 4 · Evaluation | `npm ci --cache /tmp/rulecraft-npm-cache`, `npm test` with 115 tests in 13 files, `npm run typecheck` and `npm run build` passed. Both historical runners and both society commands were executed. |

GitHub Actions defines a PR check for clean install, test, type check and production build.

The event-level denominator for perceived duties includes stale known obligations. It separates infeasible opportunities from feasible ones, then counts completed, partial, blocked and unchosen feasible duties. Actual prohibitions and known/inapplicable and unaware rules have separate counters. A performed prohibition at home remains visible but cannot generate an encounter on the public route. The study establishes no claim about psychological realism, campaign win rates or physical Android/iOS behaviour.

### Outstanding product questions

- A seeded directed contact ring is small and deterministic. Later review can compare physically adjacent or occupation-mixed contacts. Bulletin chance takes the first share of a single learning roll and one previous-day informed peer can supply the remaining peer chance. No staffed outreach is simulated.
- The public zone uses a single patrol route across workplaces, with home rest private. A finer alternative is assigning guards to distinct sites with travel cost. Decide before inferring neighbourhood-level enforcement. Warning education affects choices the following day. Its trust cost and remembered deterrence, along with meal-access trust and exertion attitude shifts, all remain provisional.
- The status quo leaves six foresters without a timber customer. A later decision could keep subsistence support absent or add a capped, funded Treasury timber purchase tied to an audited buyer, seller, ownership change and real consumption sink. This milestone adds no purchasing mechanics or subsidies. A market shortfall coinciding with unsold grower food is a distribution signal and does not prove the delivery constraint caused every missed meal.
- The atomic full-history checkpoint supports local recovery and compatibility but amplifies save sizes. Measure bounded history or checkpoint indexing before longer campaigns. Mobile UI, device interruption and native persistence tests remain pending.
