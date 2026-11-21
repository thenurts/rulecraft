# Rulecraft

Rulecraft is a standalone, mobile-first game about governing an autonomous village through decrees. The Task 00 web page exercises a shared TypeScript fixture and browser draft storage. Task 01 adds the rule-free, headless village kernel and its replay runner.

## Run locally

Use Node.js 24.22.3 (see `.nvmrc`) and npm. Run these commands from the repository root.

```sh
npm ci
npm test
npm run build
npm run dev
```

If the cloud shell cannot write to the default npm cache, use `npm ci --cache /tmp/rulecraft-npm-cache`.

Open the URL printed by Vite. Select **Save fixture** and reload the same URL. The status should read **Fixture restored from this device.** For the built site, run `npm run preview` after building. To test from a phone on the same trusted network, run `npm run dev -- --host 0.0.0.0` and open the host machine's LAN address and Vite port on the phone.

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

## Project layout

| Path | Purpose |
|---|---|
| `packages/simulation` | Headless TypeScript simulation, structured ledger, snapshot codec and tests. Its compiler configuration excludes DOM and ambient platform types. |
| `fixtures/`, `tools/` | Configurable village JSON, Node runner and local checkpoint adapter. |
| `apps/web` | React/Vite page, mobile stylesheet and browser draft adapter. |
| `docs/` | Design specifications, decision register and Task 00 audit. |
| `tasks/` | Milestone work and acceptance criteria. |

For the stack trade-offs, unresolved decisions and mobile test plan, see the [Task 00 architecture report](docs/04_Task_00_Architecture.md) and [decision register](docs/DECISIONS.md). The [roadmap](ROADMAP.md) defines the milestone order.
