# Task 06 fixture and persistence evidence

This is a design decision record for [PR #21](https://github.com/thenurts/rulecraft/pull/21). It follows the published [baseline report and acceptance matrix](15_Task_06_Preimplementation_Evidence.md). The studies use the existing v4 executor, typed decree API, prices, transfer rules, legal awareness and ledger. Candidate fixture IDs and persistence formats are for research only. No scenario or save format is installed in the game.

## Fixture-only sensitivity

The study keeps 40 residents, a twelve-day horizon and the existing prices, wages, recipes and law settings. Each policy is compared with a no-decree run at the same seed and with precisely the same opening fixture. Candidate IDs are versioned separately from the existing engine fixture schema. Every measured run reaches the horizon and passes the ledger audit. Junior and Full have the same simulation inputs for the policies tested. An initial 32-seed exploratory smoke run was contained within the exploratory range. A second exploratory batch isolated the effect of reallocating merchants to farming while keeping guard wages fixed. Neither exploratory batch used the holdout seeds.

The exploratory sweep uses seeds 20000–20255. It compares normal conditions, less opening market food, a tighter per-slot delivery cap, fewer merchants, reduced market cash, reduced household cash, and higher starting fatigue with smaller field reserves. For each fixture, the policy arms are no decree, harvest duty, morning-only harvest duty, delivery duty, delivery duty below 40 market units, and harvest plus delivery duties. The number 40 in the conditional decree is a legally observable trigger at slot opening, independent of the proposed campaign goal. Every command goes through `confirmLaw` before day one with a stable identifier. There are no forced notices or edited mid-game balances.

The selection prioritises a material, reproducible increase in fully fed resident-days, an early change a player can see and investigate, and lower supply shortages. It prefers the smallest opening change that leaves the original guard and household funding intact. Affordability, final stock and transfers are inspected separately for trade-offs. The reported 95% intervals are paired normal intervals for the mean seed difference. These are exploratory comparisons with multiple alternatives, so policy selection is followed by a holdout fixed at 41000–41255.

### Exploratory estimates

Values for policies are mean paired differences from the corresponding no-decree run, in fully fed resident-days.

| Fixture opening change | No-decree meals of 480 | Harvest Δ | Morning harvest Δ | Delivery Δ | Low-stock delivery Δ | Harvest + delivery Δ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Current opening fixture | 468.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| 10 starting market food | 459.89 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 |
| 10 market food, six deliveries per slot | 459.89 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 |
| Three merchants, freed positions to guards, 30 market food | 231.28 | 0.00 | 0.00 | 11.16 | 10.78 | 11.16 |
| Five merchants, freed positions to guards, 20 market food | 352.88 | 0.00 | 0.00 | 20.30 | 19.71 | 20.29 |
| 10 market food, 20 market coins | 456.27 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| 20 market food, 14 coins per household | 448.91 | 0.00 | 0.00 | 0.46 | 0.07 | 0.46 |
| 20 market food, 430 field food, fatigue 50–72 | 450.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| Five merchants, freed positions to farming | 375.47 | 0.00 | 0.00 | 21.93 | 21.30 | 21.92 |
| Five merchants, freed positions to farming, 20 market food | 350.88 | 0.00 | 0.00 | 21.78 | 21.54 | 21.78 |

Lowering household cash or market working capital alone did little to make constructive laws matter. A five-merchant opening created the main effect across two occupation allocations and two starting market stocks. Moving five merchant positions to farming kept eight guards and the original wage bill. That candidate changes just two population counts. It uses 21 farmers, six foresters, five merchants and eight guards. Its two delivery strategies performed better than the harvest strategy without requiring a smaller food reserve or a raised opening balance.

### Untouched holdout

The fixture, four arms and primary agency check were locked before running the holdout. Each cell shows the treatment minus no-decree paired mean with its 95% interval. The morning harvest arm changed work choices but rarely changed final meal access.

| Policy | Fully fed resident-days, total | Fully fed resident-days, days 1–6 | Market-shortfall units | Affordability-shortfall units | Seeds better / tied / worse on total feeding |
| --- | ---: | ---: | ---: | ---: | --- |
| Delivery duty | +21.09 [19.98, 22.19] | +11.23 [10.46, 12.01] | −22.61 [−23.78, −21.45] | +1.53 [1.32, 1.73] | 256 / 0 / 0 |
| Low-stock delivery duty | +20.84 [19.76, 21.93] | +10.70 [9.92, 11.48] | −22.35 [−23.51, −21.19] | +1.51 [1.29, 1.72] | 253 / 3 / 0 |
| Morning harvest duty | +0.004 [−0.004, 0.012] | 0 | +0.008 [−0.021, 0.036] | −0.012 [−0.041, 0.018] | 1 / 255 / 0 |

The unconditional delivery duty raised feeding from 376.88 to 397.97 of 480 resident-days (78.52% to 82.91%). Both arms harvested all 450 field units. The duty moved 21.33 more units into the market and left 21.33 fewer units with producers. It created 5.33 more successful delivery jobs, paid 5.33 extra merchant-fee coins and 21.33 extra producer coins through recorded market transfers, and led to 42.17 more coins in resident-to-market meal payments. Guard wages stayed at 192 coins and there were zero delivery funding barriers in both arms. This is a distribution effect. Closing market stock averaged 0.04 without a decree and 0.28 with the duty.

The affordability cost is real. Recorded affordability shortfalls rose from 3.09 to 4.62 per trial, and cases of insufficient funds while the market still held food rose from 2.17 to 3.70. Pairing every meal by seed, day and citizen shows that foresters accounted for 350 of the 391 additional affordability shortfall units across the holdout. All 407 forester meals with a funding shortfall only in the delivery arm occurred after that resident had bought more meals earlier in that arm. The opposite transition occurred 57 times. Foresters nevertheless ate 579 more meals in aggregate. In seed 41000, one forester had bought ten meals under the duty and nine without it by day 11. The treated resident was out of money while the market still held 23 units, and the matched control resident could buy that day's meal. Separately, 68 already-unaffordable forester meals in both arms also had stock present only in the delivery arm. This distinguishes earlier depletion of fixed household cash from cases where delivery exposed a pre-existing lack of funds. [Matched meal counts and witness](evidence/task-06/fixture-meal-pairs.json)

### Recorded choice and ledger witness

In exploratory seed 20000 on day 6, merchant `citizen.0030` faced the same morning draw, 3676871613, in the no-decree and delivery-duty runs. Delivery was feasible in both. The untreated actor rested (`event.6.34`) with work/rest weights 88/25. The treated actor knew `delivery-duty` version 1 from the dawn notice on day 4. Its actual and perceived duty were required, pressure was +60 and the work/rest weights were 153/25. The actor completed delivery (`event.6.22` → `tx.6.15`), moving four food units to the market and paying a producer and a merchant. The change in work weight includes the recorded utility terms as well as legal pressure.

That day, harvest was 24 units in both arms. Deliveries rose from 24 to 32 units and funded meals from 24 to 32. Producer receipts rose from 24 to 32 coins, merchant fees from 6 to 8 and meal payments from 48 to 64. The morning-harvest comparison fed 24 and delivered 24 despite known, feasible harvest duties. Individual meals consume fungible market stock. The paired day and its transactions establish the chain at the market-account level.

Evidence includes [exploratory summaries](evidence/task-06/fixture-explore.json), [occupation and stock isolation](evidence/task-06/fixture-isolated-explore.json), the [holdout protocol](evidence/task-06/Fixture_Holdout_Protocol.md), [holdout summaries](evidence/task-06/fixture-holdout.json) and the [paired witness and ledger trace](evidence/task-06/fixture-witness-seed20000.json). Each summary includes day-by-day means and per-policy variance.

## Campaign recommendation for review

Prototype a distribution mission where the primary measure is **fully fed resident-days, out of 480**, with separate visible counts for **market-stock and affordability shortfall units**. Use a clearly labelled day-6 teaching checkpoint to help players observe whether food reached the market and whether residents could buy it. Use a displayed same-seed no-decree comparison in evaluation, or calibrate a fixed target on another fresh seed set after the owner chooses the mission format. The measured deliveries support either unconditional or low-stock duties, and the morning harvest strategy is a useful failed hypothesis for teaching. The candidate still leaves more than 80 meals unmet on average even with the constructive delivery duty, so severity and Junior suitability require their own review.

Keep market stock as a diagnostic. Leave an end-stock floor out of this candidate because four extra meals can consume four otherwise-reserved units, and the benchmarked successful policies typically end almost empty. Show the affordability increase explicitly. An independent affordability victory condition would need a separately demonstrated lawful route that improves affordability, potentially a different fixture or a separately approved economy mechanism. Avoid presenting the two delivery variants as separate economic mechanisms. **The fixture clears the predeclared agency check. Hungry Village remains Not Balanced / Blocked for gameplay approval** until the candidate, objectives and difficulty have been reviewed.

## Independent 30-day persistence investigation

The published 40-resident, 25-law and 30-day browser run measured 1.22 s save p95 and 46.8 MB for the logical two-generation record. This study reuses that workload and separates full snapshot size, engine encoding and verifying, storage I/O and history retention. The storage proof uses a separate desktop Chromium origin and IndexedDB database fed by local Playwright routes. Its tasks cover storage and compression. The application still uses its original save worker and two-generation transaction.

| Completed day | Full canonical snapshot | Nested actual/perceived law-choice evidence | Node encode | Node verify and replay | Journal-only reconstruction and hash |
| --- | ---: | ---: | ---: | ---: | ---: |
| 12 | 9.41 MB | 5.74 MB | 412 ms | 940 ms | 478 ms |
| 20 | 14.48 MB | 9.96 MB | 804 ms | 1,951 ms | 728 ms |
| 30 | 20.78 MB | 15.24 MB | 812 ms | 1,764 ms | 1,149 ms |

Each row is a single sample, with desktop Node used for engine operations. The events section was 17.89 MB on day 30. Nested legal-choice evidence represented 73.3% of the full payload. The previous and current snapshots shared 19.86 MB in byte-identical prefixes of events, transactions, daily records, social records and the legal journal. That is a measured candidate for deduplication. It excludes other repeated fields and the overhead a new format would add. The production store rewrites both generations as one logical record and reads that record to check revision before committing. The current worker encodes the full snapshot and on load verifies it by replay from genesis. Storage, full canonicalisation, replay and worker copy are distinct work. The measurements do not establish worker-copy latency on its own.

### Lossless binary storage proof

Testing the same day-29/day-30 canonical payloads in an isolated Chromium IndexedDB reduced pair payloads from **40,924,745 to 1,148,001 bytes** (97.2%) using gzip. The production benchmark's larger 46.8 MB figure is the JSON representation of a record containing escaped snapshot strings. The prototype compares the raw payload byte sizes, excluding browser storage overhead.

| Isolated operation | p50 | p95 |
| --- | ---: | ---: |
| Plain two-generation IndexedDB write, including read-before-write | 192.5 ms | 400.3 ms |
| Gzip latest payload plus two-generation binary write, previous already compressed | 282.1 ms | 317.7 ms |
| Plain two-generation IndexedDB read | 114.3 ms | 225.1 ms |
| Binary read plus decompress latest payload | 74.5 ms | 106.3 ms |

Five samples per operation make p95 the maximum observed. These storage timings exclude engine snapshot encoding, replay verification and worker messages. Lossless gzip preserved both full payloads byte for byte but increased median write-plus-compression time in this test. It is a promising quota reduction, with end-to-end latency still an open question. An injected quota-style transaction abort retained both committed generations. Truncating the current gzip payload failed decompression. The untouched previous payload matched the original byte for byte and reopened through the existing Node loader as day 29. This is fault injection in a prototype, separate from real phone quota or kill/restart validation.

### Alternatives and retention

- **Lossless binary envelope first.** Test storing original canonical payloads as transferable compressed blobs in a versioned envelope. Keep current and previous generations and existing checksum/revision rules. Measure worker encode, transfer, IndexedDB, decode and verify separately on phones before proposing a migration. This addresses persisted size. The engine still reconstructs the full verified historical world.
- **Checkpoint plus immutable, indexed segments.** A manifest can reference one copy of completed-day event, legal and ledger chunks, with integrity-checked pointers and an atomic revision update for every new generation. Test chunk corruption, missing references, concurrent tabs, quota and rollback. Keep older law, notice, investigation and transaction witnesses retrievable by stable ID. This is the strongest longer-term candidate if full verification or payload cloning still dominates. The measured common prefix supports it. A chunked application store still needs implementation and measurement.
- **Journal-only reconstruction as a lower bound.** The day-30 research capsule was 10,277 bytes before any storage-envelope overhead and still took about 1.15 seconds to reconstruct and hash on desktop Node. The prototype reproduced the full v4 snapshot exactly and regenerated 71 identical Chronicle entries with 1,171 resolvable witness, context and decree-version references. Historical v3 and v4 seed-42 examples also reproduced their golden state and event hashes and 29/30 identical Chronicle entries, respectively. Long-lived deployment requires retaining historical executors and catalogue semantics or deliberately migrating them. Replay latency grows with the horizon. A journal-only current save would move risk from storage to reconstruction.
- **Bound the in-memory working set, keep the evidence archive.** Lazy reading of old evidence is worth measuring after the storage design is chosen. Evicting history outright would break factual Inquiry, checked narrative exports or repeatable Chronicles. Chronicle ranking and repetition depend on earlier witnesses and the content version, so any index must preserve their inputs or pin and verify the derived results.

[Raw persistence measurements and provenance checks](evidence/task-06/storage-followup.json).

## Reproduction and decision gate

The baseline regression rerun passed 151 unit and integration tests, 19 Chromium browser tests, standalone type checks and the production build. Both fixture cohorts passed ledger audits in every arm. The isolated storage fault-injection and provenance checks passed.

Extract the programs from the [research-runner appendix](evidence/task-06/Followup_Runners.md) into `tools/` from the repository root. Run with Node 24.22.3. The output directory is local.

```sh
node tools/task-06-fixture-research.mjs explore \
  baseline-v1,low-market-v1,tight-delivery-v1,three-merchants-v1,five-merchants-v1,low-capital-v1,low-household-coins-v1,tired-shallow-field-v1
node tools/task-06-fixture-research.mjs explore \
  five-merchants-farmers-v1,five-merchants-farmers-low-market-v1
node tools/task-06-fixture-research.mjs holdout five-merchants-farmers-v1 delivery
node tools/task-06-fixture-research.mjs trace five-merchants-farmers-v1 delivery 20000
node tools/task-06-meal-pairs.mjs
RULECRAFT_CHROMIUM=/usr/bin/chromium node tools/task-06-save-research.mjs
```

Keep the current 12-day Sandbox limit. Physical Android Chrome and iOS Safari save and load p50/p95, real-quota and OS interruption recovery, and complete historical Chronicle, Inquiry and PNG export under any proposed persistence adapter are **Not Yet Tested**. Existing accessibility and human-playtest gates still apply. The owner can review fixture and objective proposals separately from selecting a persistence design. The PR remains a design and evidence review.
