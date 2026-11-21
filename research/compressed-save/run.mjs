import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';

const mode = process.argv[2] ?? 'validate';
assert.ok(mode === 'validate' || mode === 'benchmark', 'Use validate or benchmark.');
const samples = Number(process.argv[3] ?? 5);
assert.ok(Number.isInteger(samples) && samples >= 2 && samples <= 30, 'Provide 2–30 trials per arm.');
const outDir = await mkdtemp(join(tmpdir(), 'rulecraft-save-research-'));
const configFile = fileURLToPath(new URL('./vite.config.mjs', import.meta.url));
let server;
let browser;
try {
  await build({ configFile, logLevel: 'error', build: { outDir, emptyOutDir: true } });
  server = await preview({ configFile, logLevel: 'error', build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
  browser = await chromium.launch({ executablePath: process.env.RULECRAFT_CHROMIUM || undefined });
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const context = await browser.newContext();
  const open = async () => {
    const page = await context.newPage();
    await page.goto(origin);
    await page.waitForFunction(() => !!globalThis.research);
    return page;
  };
  const page = await open();
  if (mode === 'validate') {
    const faults = await page.evaluate(() => research.faultChecks());
    const historical = await page.evaluate(() => research.provenance());
    assert.deepEqual(historical.versions.map(({ hashes }) => hashes), [
      { state: '375123c46edf3305', events: '75b6f979dc9dd357' },
      { state: 'f4c46dbfd1b05523', events: '076d885f324114cf' },
    ]);
    const peer = await open();
    const name = 'two-tabs';
    assert.equal(await page.evaluate((id) => research.tabOpen(id, 42), name), 1);
    assert.equal(await peer.evaluate((id) => research.tabOpen(id, 42), name), 1);
    const race = await Promise.all([page, peer].map((tab) => tab.evaluate((id) => research.tabAdvance(id), name)));
    assert.equal(race.filter(({ committed }) => committed).length, 1);
    assert.equal(race.find(({ committed }) => committed).revision, 2);
    assert.match(race.find(({ committed }) => !committed).error, /changed in another tab/);
    console.log(JSON.stringify({ browser: browser.version(), faults, historical, race }, null, 2));
  } else {
    const trials = [];
    for (const horizon of [12, 30]) trials.push(await page.evaluate(({ horizon, samples }) =>
      research.benchmark(horizon, samples), { horizon, samples }));
    const stats = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      const at = (p) => sorted[Math.ceil(sorted.length * p) - 1] ?? null;
      return { n: sorted.length, p50: at(0.5), p95: at(0.95), max: sorted.at(-1) ?? null };
    };
    for (const trial of trials) for (const arm of trial.arms) {
      arm.timingMs = Object.fromEntries(Object.entries(arm.samples).map(([kind, rows]) => [kind,
        Object.fromEntries(Object.keys(rows[0]).filter((key) => key !== 'bytes').map((key) =>
          [key, stats(rows.map((row) => row[key]))])),
      ]));
      if (arm.longTasksMs) arm.longTaskStatsMs = stats(arm.longTasksMs);
    }
    console.log(JSON.stringify({ browser: browser.version(), platform: process.platform, samples, trials }, null, 2));
  }
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.httpServer.close(resolve));
  await rm(outDir, { recursive: true, force: true });
}
