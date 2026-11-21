# Task 01 · Headless village kernel

[Issue #1](https://github.com/thenurts/rulecraft/issues/1) defines this milestone. The simulation runs in the TypeScript package using ECMAScript APIs. The Node command and checkpoint storage sit in `tools/`. The fixture in `fixtures/task-01-village.json` contains the proposed population, clock length, starting balances, per-slot capacity, yields, prices and behaviour weights.

| Increment | Delivered | Commands and outcomes |
|---|---|---|
| 1 · Fixture and clock | Versioned model and JSON validation, explicit owners and locations, stable IDs, independent keyed RNG, known draw vectors | `npm ci --cache /tmp/rulecraft-npm-cache` installed 44 packages. `npm test` passed 21 tests in 2 files. `npm run build` passed both type checks and the Vite build. |
| 2 · Actions and ledger | Opening-snapshot selection, execution rechecks, bounded transfers, finite harvest and forestry, patrol, wages, meals, fatigue and hunger | `npm test` passed 28 tests in 3 files. `npm run build` passed. Tests included absent stock or delivery, partial fills, insufficient funds and an injected blocked attempt that used its slot. |
| 3 · Snapshots and replay | Linked factual logs, checked save codec, atomic local checkpoint adapter, prior-turn recovery and reproducible 12-day CLI | `npm ci --cache /tmp/rulecraft-npm-cache`, `npm test`, `npm run build` and `git diff --check` passed. Vitest ran 39 tests in 5 files. |

Checks used Linux, Node 24.22.3, npm 11.19.1 and Vitest 5.1.1. Chromium 156 ran the same engine by importing the ES modules through the Vite dev server on loopback. It saved and loaded its day-6 payload in memory, finished at day 12, and matched the Node hashes and audit.

## Reproduce the result

```sh
proof=$(mktemp -d /tmp/rulecraft-task-01.XXXXXXXX)
npm run --silent simulate -- --seed 42 --timings > "$proof/full.json"
npm run --silent simulate -- --seed 42 > "$proof/repeat.json"
npm run --silent simulate -- --seed 42 --until 6 --checkpoint "$proof/checkpoint.json" > "$proof/day6.json"
npm run --silent simulate -- --resume "$proof/checkpoint.json" --checkpoint "$proof/checkpoint.json" > "$proof/replayed.json"
npm run --silent simulate -- --seed 42 --events > "$proof/ledger.json"
cmp "$proof/full.json" "$proof/repeat.json"
cmp "$proof/full.json" "$proof/replayed.json"
```

Both comparisons passed. The full log contained 2,356 events, 888 transactions and 2,262 movements. The resource audit reconstructed each balance from genesis and checked the source, sink, ownership and provenance of the recorded transfers.

| Resource | Genesis | Consumed | Day 12 |
|---|---:|---:|---:|
| Food | 495 | 468 | 27 |
| Timber | 120 | 0 | 120 |
| Coin | 1,500 | 0 | 1,500 |

The market held the final 27 food. There were 468 fully fed citizen-days out of 480. On days 11 and 12, six residents each day could no longer afford food even though the market had stock. That is a fixture outcome, not an assessment of campaign winnability.

| Seed/runtime | State digest | Event/ledger digest |
|---|---|---|
| 42 · Node, disk resume and Chromium | `713a9e709bf6e873` | `72f67e9184e65e5f` |
| 43 · Node | `5ff3a99178d0faf2` | `98a05a01706c488d` |

The seed-42 timing sample was 1.276 ms median and 3.624 ms p95/max across 12 in-memory turns on the Linux cloud host. It excludes disk writes, decoding, audit, checksum generation and rendering. It cannot establish the mobile performance budget.

## Acceptance and limits

| Slice check | Task 01 evidence |
|---|---|
| BUILD-07, BUILD-08 | Passed. Injected empty-field attempt produced zero and logged the reason. Harvest without merchant delivery left the market unchanged. |
| BUILD-10, BUILD-11 | Passed. Funding constrained delivery, meals and wages. Unmet meals increased hunger and no account went negative. |
| BUILD-12, BUILD-17 | Passed for the rule-free baseline. Byte-identical repeated summaries, golden hashes and exact 12-day account reconciliation. |
| BUILD-18, BUILD-22 | Headless portion passed. Mid-run disk resume matched uninterrupted output. Interruption before file promotion preserved the previous complete turn, and corrupt current payload recovery restored the previous verified payload. Device and draft interruption checks remain pending. |
| BUILD-24 | Node and desktop Chromium matched. Android/iOS and packaged WebView golden runs remain pending. |
| BUILD-13, BUILD-20 | Pending as specified. The tests exercise multiple seeds and report the 12-day headless timing sample. The 200-seed statistical gate and the law-loaded mobile benchmark require later milestones. |

Approved issue decisions are recorded alongside concrete policies in the [decision register](DECISIONS.md). Fixed ID ordering can favour earlier IDs in scarcity. Forestry is finite and has no buyer, deliberately avoiding an unspecified timber subsidy. Trust remains a starting trait. Starting values and campaign thresholds remain provisional. Save v1 retains full history and validates by replay. Storage footprint and recovery time will need review for longer runs. Native builds, physical-device checks and campaign balancing remain pending.
