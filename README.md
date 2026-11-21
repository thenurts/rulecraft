# Rulecraft

Rulecraft is a standalone, mobile-first game about governing an autonomous village through decrees. Task 00 provides a runnable portability scaffold. The page exercises a shared TypeScript fixture and browser draft storage. The game itself starts with the headless kernel in Task 01, after architecture review.

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

## Project layout

| Path | Purpose |
|---|---|
| `packages/simulation` | Headless TypeScript package and Vitest fixture tests. Its compiler configuration excludes DOM and ambient platform types. |
| `apps/web` | React/Vite page, mobile stylesheet and browser draft adapter. |
| `docs/` | Design specifications, decision register and Task 00 audit. |
| `tasks/` | Milestone work and acceptance criteria. |

For the stack trade-offs, unresolved decisions and mobile test plan, see the [Task 00 architecture report](docs/04_Task_00_Architecture.md) and [decision register](docs/DECISIONS.md). The [roadmap](ROADMAP.md) defines the milestone order.
