# Versioned lossless browser save research

**Recommendation for review:** treat compression as a candidate for reducing persisted size. It does not remove the work of reconstructing the canonical world or transporting its history. Keep the current 12-day Sandbox while evaluating device behaviour. [Issue #23](https://github.com/thenurts/rulecraft/issues/23) · [Merged baseline](16_Task_06_Fixture_and_Persistence_Study.md)

## Prototype and compatibility

The [research harness](../research/compressed-save/) builds an isolated page, starts a loopback-only preview on an ephemeral port and opens a fresh browser context. The adapter requires a `rulecraft-save-research-` database name and uses the existing isolated draft store. Production has no entry point to this prototype. The harness accepts only research fixtures and has no pathway to live saves.

Each IndexedDB head contains the revision, current generation and previous generation. Generation metadata retains the ID, mode, track and committed revision. A legacy payload is the original canonical string. A compressed payload is a tagged storage envelope, version 1, with algorithm `gzip`, expected canonical byte length, original engine checksum and compressed binary bytes. The storage version is independent of the engine save version. A worker encodes the original snapshot, optionally compresses it, and transfers the binary payload. Reading decompresses with a strict UTF-8 decoder and a bounded declared output length, then checks length and the original engine checksum header before calling the existing `loadSociety` checksum and deterministic replay validator. The 64 MiB canonical limit bounds the research format; it is no claim about a supported game horizon.

A writer without both gzip stream APIs can still write a legacy string. A reader without the decode API tries a verified compatible previous generation and reports its recovery state. If no generation verifies, it fails explicitly. The format keeps the legacy and mixed-generation read paths. An unknown format version or algorithm is rejected independently of the engine schema.

Expensive encoding happens before opening the write transaction. Within one strict IndexedDB transaction the adapter reads the head, compares its revision and atomically writes the new current and the previously verified generation. If load fell back to an older generation, the next explicit repair retains that verified generation even if a corrupt head was newer. Drafts are addressed separately with the existing draft adapter. A stale writer cannot overwrite either checkpoint. No separate migration transaction is needed to replace a payload representation in the prototype; loading by itself never migrates a record.

## Replay, recovery and evidence validation

The Chromium harness exercised legacy reads, exact compressed canonical bytes, mixed generations, an injected quota-style abort, explicit interruption, missing streams, truncated gzip, outer and inner checksum corruption, unsupported version and algorithm, decompressed expansion limits, partial conversion, repair and stale writers. It checked the independent draft after failure and after repair. In a two-page race at the same revision exactly one writer committed; the other received the stale-tab error. Faults were injected for deterministic recovery. Device quota exhaustion, browser termination and operating system eviction require separate testing.

The harness continued historical v3 from day six and continued v4 the same way. Each reconstructed snapshot matched the corresponding uninterrupted canonical bytes and audit. The current adapter handles the existing society snapshots v3 and v4. The independent v1/v2 legacy loader and golden suite continue to run as source regressions.

| Historical fixture | State hash | Event hash | Identical Chronicle incidents | Resolved Inquiry witness/version links |
| --- | --- | --- | ---: | ---: |
| v3 | `375123c46edf3305` | `75b6f979dc9dd357` | 29 | 444 |
| v4 | `f4c46dbfd1b05523` | `076d885f324114cf` | 30 | 383 |

The harness uses the existing Chronicle projection and Inquiry provider. It compares each linked evidence record, including source events, law versions, notices and applicable ledger records. Template IDs and content version stay with the same projection. For an actual competing-duties record it compared the original and restored two-decree source text and rendered the share card before and after reopening. The two 1080 × 1350 PNGs were byte-identical at 186,058 bytes in the trial. This tests the renderer in Chromium, separate from physical save/share-sheet interaction. [Raw browser validation](evidence/task-06/compressed-save-validation.json)

## Full pipeline benchmark

The matched test uses the same deterministic 40-person, 25-law workload and previous/current committed pair at each horizon. The public law API confirms the 25 laws before the first day, with a benchmark-only allowance. Each timed sample commits the latest day against an intact previous day, then reads, verifies and restores the new generation. A warm-up per arm precedes the five measured samples. Plain and gzip order alternates. The benchmark checks both stored canonical strings and measures end-to-end store latency in desktop Chromium 156 on Linux. These are repeat samples of one workload on one machine, not independent phone sessions.

| Workload | Current canonical payload | Plain pair, raw payload bytes | Gzip pair, raw payload bytes | Reduction |
| --- | ---: | ---: | ---: | ---: |
| 12 days | 9,408,450 | 18,165,423 | 605,175 | 96.7% |
| 30 days | 20,777,358 | 40,924,745 | 1,148,001 | 97.2% |

The raw pair excludes the storage envelope and IndexedDB overhead. Serialising the plain head as nested JSON produced 20.75 MB and 46.76 MB for the 12-day and 30-day workloads respectively. The earlier 30-day study reported the latter metric, a distinct measure.

| Stage (p50 / p95 ms) | Day 12 plain | Day 12 gzip | Day 30 plain | Day 30 gzip |
| --- | ---: | ---: | ---: | ---: |
| Total commit | 696.8 / 2,126.7 | 732.4 / 898.8 | 1,468.6 / 2,435.5 | 1,300.5 / 2,547.1 |
| Engine encode in worker | 383.2 / 1,658.3 | 278.0 / 560.3 | 658.8 / 1,963.0 | 612.6 / 1,907.3 |
| Compression in worker | 0.0 / 0.0 | 145.6 / 213.2 | 0.0 / 0.0 | 403.4 / 417.3 |
| Synchronous save postMessage call | 45.2 / 132.2 | 66.4 / 103.3 | 97.5 / 101.7 | 96.8 / 186.9 |
| Save bridge residual | 194.8 / 347.8 | 125.0 / 189.0 | 244.3 / 330.0 | 249.3 / 287.5 |
| IndexedDB read before write | 16.5 / 37.9 | 1.3 / 41.4 | 49.4 / 99.4 | 2.4 / 7.5 |
| IndexedDB write after read | 95.0 / 135.2 | 4.6 / 111.5 | 297.6 / 477.5 | 8.0 / 23.8 |
| IndexedDB commit including head read | 116.0 / 151.0 | 5.9 / 152.9 | 327.7 / 566.3 | 10.4 / 31.3 |
| Total read and replay | 963.0 / 1,701.2 | 870.3 / 2,223.4 | 1,726.9 / 2,771.9 | 1,874.6 / 1,935.7 |
| IndexedDB load read | 52.5 / 97.2 | 2.6 / 11.7 | 162.3 / 320.0 | 4.2 / 8.3 |
| Decompression in worker | 0.0 / 0.0 | 41.1 / 67.3 | 0.0 / 0.0 | 59.1 / 140.3 |
| Engine verify and replay in worker | 779.0 / 1,451.8 | 752.7 / 1,983.2 | 1,324.9 / 1,983.1 | 1,532.3 / 1,593.7 |
| Synchronous load postMessage call | 4.6 / 6.3 | 0.1 / 0.2 | 15.1 / 16.8 | 0.1 / 0.2 |
| Load bridge residual | 114.2 / 151.8 | 106.2 / 196.3 | 221.5 / 535.4 | 229.4 / 280.8 |

The worker-bridge residual is round-trip time less worker compute. It includes serialisation, copies, queuing and scheduler delays. It does not isolate transport. The synchronous postMessage call is reported separately and overlaps that residual. Component p50/p95 values come from each stage's own distribution and cannot be added to reconstruct the total percentile. With five samples p95 is the maximum.

IndexedDB work fell sharply. Total commit timing was mixed. Day-12 gzip was slightly slower at the median and faster at the observed maximum. Day-30 gzip was faster at the median and slower at the maximum. Median day-30 verification still took 1.53 seconds with gzip, and median gzip reload reached 1.87 seconds before rendering a playable scene. The initial instrument-check run showed a different ordering for day-30 save medians. The final benchmark therefore supports a storage conclusion and leaves any general commit-speed claim open. The earlier isolated write measurements pointed to the same compression-versus-I/O trade-off.

Chromium reported roughly 1.77 MB IndexedDB usage after both 12-day arms and 4.70 MB after the 30-day arms as well, with a desktop quota estimate around 10.7 GB. Those figures apply to the whole ephemeral origin, including both formats. Internal compression, accounting delay and the absence of true device pressure make them unsuitable as per-arm disk measurements.

The main-page JS heap samples ranged from 69–164 MB (plain) and 55–177 MB (gzip) at day 12, and 117–408 MB (plain) and 108–307 MB (gzip) at day 30. This is a point-in-time browser estimate affected by garbage collection. It excludes worker and OS memory. The Long Tasks API reported maxima of 1,342/1,061 ms at day 12 and 1,717/1,552 ms at day 30 for plain/gzip respectively. Counts were 13/9 and 21/10. Counts include tasks overlapping the operation window and may include adjacent research work within the same task. They do not isolate user-visible stutter in the live game. The data cannot establish a memory or responsiveness benefit on phones.

[Raw samples, long tasks, heap and quota estimates](evidence/task-06/compressed-save-benchmark.json).


## Decision and further work

**Roll forward only after a separate review.** Begin with a reader for both encodings behind explicit storage capabilities and snapshot migration tests. A proposed production trial would require opt-in activation, verified backup of the current and previous legacy bytes, and an atomic revision comparison during each replacement. A launch plan must keep a compatible rollback/export reader or preserve the raw backup. Once both generations are compressed, reverting to the old plain-only app can no longer read them. On failed conversion or interrupted commit keep the previous verified generation intact, and show the recovery day before letting a player commit a replacement. Test downgrades, tabs with mixed app versions, quotas and low-storage recovery before enabling writes.

**If replay and memory remain the limit, design a separate shared checkpoint and indexed immutable evidence archive.** Persist one copy of committed-day event and ledger segments. Index event IDs, decree versions, notice IDs and transaction references to authenticated segment contents or integrity checks. Publish the new manifest and revision only when all its segments have been written and verified. The previous manifest and its chunks remain readable after interrupted writes. Garbage collection may reclaim only chunks with no live generation references. Keep historical executors and the narrative catalogue, and test exact reconstruction, same incident/template IDs, prior Inquiry and multi-decree export. This architecture remains a proposal.

**Physical protocol pending.** On representative Android Chrome and iOS Safari record device and browser versions, origin mode, quota estimate, warm and cold open, background and OS kill, write/read p50 and p95, worker transport, memory and long tasks. Repeat 12-day and isolated 30-day workloads, stress a low-storage device, force interruption during a mixed-format commit and verify the same legitimate historical Inquiry and share export. Compare with current plain saves, including browsers without stream support. All physical-device results are **Not Yet Tested**. Existing 12-day Sandbox remains the player-facing limit.

## Reproduce

```sh
npm ci
RULECRAFT_CHROMIUM=/usr/bin/chromium node research/compressed-save/run.mjs validate
RULECRAFT_CHROMIUM=/usr/bin/chromium node research/compressed-save/run.mjs benchmark 5
npm test
npm run typecheck
npm run build
RULECRAFT_CHROMIUM=/usr/bin/chromium npm run test:browser
```

Use Playwright's bundled Chromium if `RULECRAFT_CHROMIUM` is omitted. Local validation passed on Chromium 156. The production baseline also passed 151 tests in 19 files, 19 browser tests, standalone type checks and its production build. Both investigations stop for owner review.
