# Rulecraft

Rulecraft is a standalone, mobile-first game about governing an autonomous village through decrees. The mobile web trial uses the headless society simulation. Write a typed decree, advance a day, and investigate the records behind the result.

## Run locally

Use Node.js 24.22.3 (see `.nvmrc`) and npm. Run these commands from the repository root.

```sh
npm ci
npm test
npm run build
npm run dev
```

If the cloud shell cannot write to the default npm cache, use `npm ci --cache /tmp/rulecraft-npm-cache`.

Open the URL printed by Vite. Select Junior or Full, then start The Hungry Village or a 12-day Sandbox experiment. The campaign has a day-six evidence checkpoint and a day-12 debrief. Sandbox lets you choose a starting preset and seed. The Decree Book lets you confirm rules for the next day. Village advances the simulation, and the Gazette connects completed days to their Inquiry records. Reload the same origin and select **Resume village** to reopen the verified device save. Creating a new village requires confirmation before replacing the save.

The Gazette highlights incidents from verified simulation records and keeps the full action log. Open **Chronicle** to browse prior stories by day, topic or adviser, or open a story’s **Share card** for a local PNG or selectable text. Run `node tools/task-05-coverage.mjs` to reproduce the narrative coverage study. See the [Task 05 engineering report](docs/13_Task_05_Engineering.md) for results and screenshots.

For the built site, run `npm run preview` after building. For a phone on the same trusted network, run `npm run dev -- --host 0.0.0.0` and open the host machine’s LAN address and Vite port.

For the public, unpromoted HTTPS phone playtest, see the [GitHub Pages setup and physical QA guide](docs/20_Pages_Playtest.md).

### Browser tests

```sh
npx playwright install chromium
npm run build
npm run test:browser
```

Set `RULECRAFT_CHROMIUM=/usr/bin/chromium` to use a Linux system Chromium. See the [Task 06 engineering report](docs/19_Task_06_First_Playable_Engineering.md) for screenshots, storage measurements and device coverage.

## Run the headless village

```sh
npm run --silent simulate -- --seed 42 --timings
npm run --silent simulate -- --seed 42 --events > /tmp/rulecraft-events.json
```

The runner defaults to the provisional 40-citizen, 12-day fixture. Use `--fixture <path>` for a different JSON fixture. Use a fresh checkpoint path to save and resume a run.

```sh
npm run --silent simulate -- --until 6 --checkpoint /tmp/rulecraft-task01.json
npm run --silent simulate -- --resume /tmp/rulecraft-task01.json --checkpoint /tmp/rulecraft-task01.json
```

See the [Task 01 report](docs/05_Task_01_Kernel.md) for conservation, replay and recovery evidence.

Run the Task 02 headless decree example with `npm run --silent simulate:law`. It checks a durable confirmation before the first turn, compares known laws over matched seeds, and replays from a suspended law with stale citizen knowledge. See the [Task 02 report](docs/07_Task_02_Engine.md) for results and review points.

Run the Task 03 example with `npm run --silent simulate:society`. Run its predeclared 256-seed study with `npm run --silent study:society`. See the [Task 03 report](docs/09_Task_03_Engineering.md) for denominators, confidence intervals and replay evidence.

## Project layout

| Path | Purpose |
|---|---|
| `packages/simulation` | Headless TypeScript simulation, structured ledger, snapshot codec and tests. Its compiler configuration excludes DOM and ambient platform types. |
| `fixtures/`, `tools/` | Configurable village JSON, Node runner and local checkpoint adapter. |
| `apps/web` | React/Vite shell, typed decree composer, Inquiry, and IndexedDB save and draft adapters. |
| `tests/browser` | Playwright flows against the production preview, including touch emulation and storage faults. |
| `docs/` | Design specifications, decision register and Task 00 audit. |
| `tasks/` | Milestone work and acceptance criteria. |

For the stack trade-offs, unresolved decisions and mobile test plan, see the [Task 00 architecture report](docs/04_Task_00_Architecture.md) and [decision register](docs/DECISIONS.md). The [roadmap](ROADMAP.md) defines the milestone order.
