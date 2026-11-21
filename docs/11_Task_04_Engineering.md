# Task 04 · Playable web shell

The React/Vite shell runs the [approved play loop](10_Task_04_Playable_Shell.md) through the headless society engine. It offers a 40-resident, 12-day trial with Junior or Full authoring and either a Campaign preview or Sandbox trial. It makes no simulation changes. New villages use v4. The browser also opens an existing v3 snapshot and continues with its original engine. [Issue #11](https://github.com/thenurts/rulecraft/issues/11)

## Play and verify

Use the seeded opening in this order.

1. Start or resume a village. Inspect current resources and open an occupation and resident for actual balances, needs and trust.
2. Open the Decree Book. Compose a rule or choose an eligible lifecycle operation. Review and confirm it. The Book shows its effective day and distinguishes current and older learned versions, recorded attitudes and version history.
3. Return to the Village, choose **Advance day**, then resolve the requested day or cancel before it begins. A saved day shows recorded outcomes, separate food access measures and the Gazette.
4. Open a recorded action or investigation. Follow its actual and perceived law, notice origins, feasibility and choice weights, allocation or patrol evidence and ledger postings.
5. Reload and resume. At day 12 the shell ends the trial and shows the actual food metrics against the provisional targets for Campaign preview.

IndexedDB stores the two latest verified generations under one revisioned world record, with drafts in a separate object store. Each update compares the revision within the write transaction. A failed update keeps the displayed village at the prior committed generation. Decode and encode use a module worker. Command identifiers are stable on retry, and sequential decree IDs keep new-game awareness draws independent of browser-generated command identifiers.

## Test evidence

| Increment | Local results |
|---|---|
| 1 · Home and Village | 123 Vitest tests in 14 files. Production build passed. Includes four starts, real opening balances, empty initial results and navigation tests. |
| 2 · Composer, Book and saved generations | 128 tests in 15 files. Production build and 1 Chromium flow passed. The flow reloads an unconfirmed draft, then reloads the confirmed law before day one. Storage tests verify abort, prior-generation recovery, version errors, draft isolation and revision conflicts. |
| 3 · Advance, Gazette and Inquiry | 132 tests in 16 files. Production build and 2 Chromium flows passed. Cases cover actual/perceived divergence after repeal, no patrol/no investigation, no purchase without funds, distinct education and warning labels, and drill-down to the recorded ledger. |
| 4 · Reliability and phone-browser QA | Lockfile install, 132 tests, standalone type checks and production build passed. The complete 16-test Playwright suite passed against the production preview. |

The browser suite exercised all four preview starts, the five decree operations, incompatible action reset, allowance exhaustion, day-zero confirmation and draft recovery, cancel before advancing, historical v3 continuation, atomic one-day commits, addressable Inquiry records, and completing and resuming day 12. Fault injection covered aborted and quota-failed saves, unavailable IndexedDB, corrupt and unsupported snapshots, and competing tabs at the same revision. Duplicate activation of a turn or a decree produced one committed revision. The day-12 browser payload was loaded and audited in Node. The pre-existing v1–v4 golden regression suite passed.

Linux x86-64, Node 24.22.3, npm 11.19.1, Vitest 5.1.1, Playwright 1.65.1 and system Chromium 156.0.8078.79 were used for the local run.

```sh
npm ci --cache /tmp/rulecraft-npm-cache
npm test
npm run typecheck
npm run build
RULECRAFT_CHROMIUM=/usr/bin/chromium RULECRAFT_SCREENSHOTS=docs/screenshots/task-04 npm run test:browser
```

The PR workflow runs clean install, Vitest, standalone type checks, production build and the Playwright suite with its bundled Chromium.

## Browser measurements

One local production-preview trial through day 12, with an actual farmer harvest prohibition confirmed through the composer. Browser Performance entries measure turn resolution separately from worker encode plus IndexedDB commit, and measure reload from the start of reading the saved generation through verification.

| Measurement | Observed |
|---|---:|
| Median turn resolution, 12 days | 3.15 ms |
| Median save, 12 days | 62.8 ms |
| Day 12 encode and commit | 85.4 ms |
| Day 12 read and replay verification | 173.2 ms |
| Day 12 canonical world payload | 2,138,017 bytes |
| Latest plus previous logical storage record, JSON representation | 4,747,831 bytes |

The storage figure is a serialised record size. IndexedDB engine overhead, first page download time and phone performance are outside these timings.

## Mobile and accessibility

| Check | Result |
|---|---|
| Chromium portrait emulation, 320×640 and 390×844 | Pass. All checked interactive targets were at least 44×44 CSS px and the composer had no horizontal overflow. Touch activation and touch scrolling passed. |
| Chromium 768×900 tablet and 844×390 landscape | Pass for the same target and overflow checks. |
| Chromium at 320×640 with root text at 200%, reduced motion enabled | Pass for horizontal fit and core composer confirmation. Keyboard traversal, visible focus and accessible names were also checked. |
| Physical Android Chrome | Not yet tested. No device was available to measure touch, pause/resume, launch latency or storage interruptions. |
| Physical iOS Safari | Not yet tested. No device was available to test WebKit, safe areas, VoiceOver or real device storage. |

Browser accessibility checks cover the DOM accessibility tree and keyboard interaction. Live screen-reader and supervised Junior playtesting remain pending.

## Screenshots

Captured from the production preview. The Inquiry capture follows a recorded action under an enacted decree.

- [Home, 390 px](screenshots/task-04/home-390.png)
- [Village, 390 px](screenshots/task-04/village-390.png)
- [Typed composer, 390 px](screenshots/task-04/composer-390.png)
- [Composer, 320 px with 200% text](screenshots/task-04/composer-320-enlarged.png)
- [Day-one results, 390 px](screenshots/task-04/results-390.png)
- [Royal Inquiry, 390 px](screenshots/task-04/inquiry-390.png)

## Remaining limitations

The trial uses one local save per origin and the provisional food objectives. It provides no export, sync, offline app-shell cache, native lifecycle adapter or campaign progression. A fully unreadable save is reported and preserved. The current recovery path is a verified previous generation when one exists. The store retains the full history and needs different storage or retention planning for longer games. Findings from the Linux browser do not establish device performance or campaign balance.
