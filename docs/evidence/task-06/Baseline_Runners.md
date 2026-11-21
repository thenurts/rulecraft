# Reproducible baseline research runners

These programs were used against the merged Task 05 baseline. The snippets are research tools. The app and engine do not import them.

## Campaign study

Save as `tools/task-06-campaign-study.mjs` to run the commands in the report.

```js
import assert from 'node:assert/strict';
import { advanceSociety, auditSnapshot, confirmLaw, startSociety, villageScope } from '@rulecraft/simulation';
import fixture from '../fixtures/task-01-village.json' with { type: 'json' };

const objective = { fedPercent: 90, marketFood: 40 };
const plan = (targetSelector, modality, actionId, when) => ({
  ...villageScope, targetSelector, modality, actionId, ...(when && { when }),
});
const harvest = plan('farmer', 'MUST', 'harvest-food');
const delivery = plan('merchant', 'MUST', 'market-delivery');
const strategies = {
  'no-decree': [],
  'harvest-duty': [harvest],
  'morning-harvest-duty': [plan('farmer', 'MUST', 'harvest-food', { operand: 'slot', operator: 'EQ', value: 'morning' })],
  'delivery-duty': [delivery],
  'harvest-and-delivery-duties': [harvest, delivery],
  'harvest-ban': [plan('farmer', 'MUST_NOT', 'harvest-food')],
};

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const sd = (values, center = mean(values)) =>
  Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1));
const distribution = (values) => ({ mean: mean(values), sd: sd(values), min: Math.min(...values), max: Math.max(...values) });
function binomial(values) {
  const n = values.length;
  const hits = values.filter(Boolean).length;
  const p = hits / n;
  const z = 1.96;
  const scale = 1 + z ** 2 / n;
  const center = (p + z ** 2 / (2 * n)) / scale;
  const radius = z * Math.sqrt((p * (1 - p) + z ** 2 / (4 * n)) / n) / scale;
  return { hits, percent: p * 100, wilson95Percent: [Math.max(0, center - radius) * 100, Math.min(1, center + radius) * 100] };
}
function paired(values) {
  const center = mean(values);
  const radius = 1.96 * sd(values, center) / Math.sqrt(values.length);
  return { meanChange: center, confidence95: [center - radius, center + radius] };
}

function trial(seed, decrees) {
  let game = startSociety(fixture, seed);
  for (const ast of decrees) {
    const lawId = `${ast.actionId}-${ast.modality.toLowerCase()}${ast.when ? `-${ast.when.value}` : ''}`;
    game = confirmLaw(game, { operation: 'CREATE', lawId, commandId: `confirm-${lawId}`, ast }).game;
  }
  while (game.state.turn < fixture.days) game = advanceSociety(game);
  auditSnapshot(game);

  const total = (rows, measure) => rows.reduce((sum, row) => sum + measure(row), 0);
  const fed = total(game.days, ({ residentsFed }) => residentsFed);
  const opportunities = total(game.days, ({ residentsFed, residentsUnmet }) => residentsFed + residentsUnmet);
  const marketFood = game.days.at(-1).marketFood;
  const feedingTarget = fed * 100 >= opportunities * objective.fedPercent;
  const stockTarget = marketFood >= objective.marketFood;
  const poorWithStock = game.events.filter(({ foodAccess }) =>
    foodAccess && foodAccess.fundingShortfall > 0 && foodAccess.marketAvailableBefore > 0).length;
  const deliveryRecords = game.events.filter(({ action }) => action === 'market-delivery');
  const coinMoved = (reason) => total(game.transactions.filter((entry) => entry.reason === reason),
    ({ legs }) => total(legs.filter(({ resource }) => resource === 'coin'), ({ quantity }) => quantity));
  return {
    feedingTarget, stockTarget, wins: feedingTarget && stockTarget, fed, marketFood, poorWithStock,
    fedPercent: fed * 100 / opportunities,
    affordShort: total(game.societyDays, ({ metrics }) => metrics.food.unableToAffordUnits),
    supplyShort: total(game.societyDays, ({ metrics }) => metrics.food.unavailableMarketUnits),
    delivered: total(game.days, ({ foodDelivered }) => foodDelivered),
    guardsPaid: total(game.days, ({ guardsPaid }) => guardsPaid),
    guardWageCoins: coinMoved('guard-wage'),
    deliveryCoins: coinMoved('market-delivery'),
    paidMealCoins: coinMoved('resident-meal'),
    deliveryFundingBarriers: deliveryRecords.filter(({ reason }) => reason === 'insufficient-funds').length,
    knownFeasible: total(game.societyDays, ({ metrics }) => metrics.compliance.knownFeasibleDuties),
    completedDuties: total(game.societyDays, ({ metrics }) => metrics.compliance.completedDuties),
    infeasibleDuties: total(game.societyDays, ({ metrics }) => metrics.compliance.infeasibleDuties),
    unawareApplicable: total(game.societyDays, ({ metrics }) => metrics.compliance.unaware),
    performedProhibitions: total(game.societyDays, ({ metrics }) => metrics.compliance.performedProhibitions),
    firstNotice: game.book.notices.length ? Math.min(...game.book.notices.map(({ learnedAtTurn }) => learnedAtTurn)) : null,
    firstUnmetMeal: game.days.find(({ residentsUnmet }) => residentsUnmet)?.turn ?? null,
    days: game.days.map(({ residentsFed, marketFood: stock }) => [residentsFed, stock]),
  };
}

const numeric = ['fed', 'fedPercent', 'marketFood', 'poorWithStock', 'affordShort', 'supplyShort', 'delivered', 'guardsPaid',
  'guardWageCoins', 'deliveryCoins', 'paidMealCoins', 'deliveryFundingBarriers', 'knownFeasible', 'completedDuties',
  'infeasibleDuties', 'unawareApplicable', 'performedProhibitions'];
function study(firstSeed) {
  const seeds = Array.from({ length: 256 }, (_, i) => firstSeed + i);
  const arm = (name) => seeds.map((seed) => trial(seed, strategies[name]));
  const baseline = arm('no-decree');
  return {
    firstSeed, lastSeed: seeds.at(-1), seeds: seeds.length,
    arms: Object.fromEntries(Object.keys(strategies).map((name) => {
      const rows = name === 'no-decree' ? baseline : arm(name);
      const pairedChange = (select) => paired(rows.map((row, i) => select(row) - select(baseline[i])));
      const firstDivergence = rows.map((row, i) => {
        const day = row.days.findIndex(([fed, stock], d) => {
          const [controlFed, controlStock] = baseline[i].days[d];
          return fed !== controlFed || stock !== controlStock;
        });
        return day < 0 ? null : day + 1;
      });
      function dayCounts(values) {
        return Object.fromEntries([null, ...Array.from({ length: fixture.days }, (_, index) => index + 1)]
          .map((day) => [day ?? 'none', values.filter((value) => value === day).length]));
      }
      return [name, {
        fedTarget: binomial(rows.map(({ feedingTarget }) => feedingTarget)),
        stockTarget: binomial(rows.map(({ stockTarget }) => stockTarget)),
        jointWin: binomial(rows.map(({ wins }) => wins)),
        summaries: Object.fromEntries(numeric.map((key) => [key, distribution(rows.map((row) => row[key]))])),
        pairedVsNoDecree: {
          winPercentagePoints: pairedChange((row) => row.wins ? 100 : 0),
          fedPercentagePoints: pairedChange((row) => row.fedPercent),
          marketFood: pairedChange((row) => row.marketFood),
        },
        firstNotice: dayCounts(rows.map((row) => row.firstNotice)),
        firstUnmetMeal: dayCounts(rows.map((row) => row.firstUnmetMeal)),
        firstFeedingOrStockDivergence: dayCounts(firstDivergence),
      }];
    })),
  };
}

const selected = process.argv[2] ?? 'exploration';
assert.ok(['exploration', 'holdout'].includes(selected), 'Use exploration or holdout.');
console.log(JSON.stringify({
  study: selected, objective, fixture: 'task-01-village.json', engine: 'v4',
  profileAssumption: 'Existing Junior and Full previews share the same fixture, seed and law policy. Every tested AST uses shared grammar.',
  strategies, ...study(selected === 'exploration' ? 0 : 10_000),
}, null, 2));
```

## Browser persistence benchmark

Save as `tools/task-06-persistence-benchmark.mjs`. Start the local production preview first.

```js
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { advanceSociety, auditSnapshot, confirmLaw, encodeSociety, loadSociety, startSociety, villageScope } from '@rulecraft/simulation';
import fixture from '../fixtures/task-01-village.json' with { type: 'json' };

// An isolated benchmark world. Author all 25 rules before day one so every
// measured turn carries the full load. The policy override exists only here.
const benchmarkPolicy = { changesPerTurn: null, mustWeight: 60, mustNotWeight: 55 };
let initial = startSociety({ ...fixture, days: 30 }, 42, undefined, benchmarkPolicy);
for (const [targetSelector, actionId] of [
  ['farmer', 'harvest-food'], ['forester', 'cut-timber'], ['merchant', 'market-delivery'], ['guard', 'patrol'], ['all-citizens', 'rest'],
]) {
  for (const value of [0, 20, 40, 60, 80]) {
    const lawId = `benchmark-${actionId}-${value}`;
    initial = confirmLaw(initial, {
      operation: 'CREATE', lawId, commandId: `confirm-${lawId}`,
      ast: { ...villageScope, targetSelector, actionId, modality: 'MUST', when: { operand: 'fatigue', operator: 'GTE', value } },
    }).game;
  }
}

const browser = await chromium.launch({ executablePath: process.env.RULECRAFT_CHROMIUM || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.addInitScript(() => {
    window.longTasks = [];
    new PerformanceObserver((list) => window.longTasks.push(...list.getEntries().map(({ duration }) => duration)))
      .observe({ type: 'longtask', buffered: true });
  });
  await page.goto(process.env.RULECRAFT_BENCHMARK_URL ?? 'http://127.0.0.1:4176');
  await page.getByRole('button', { name: 'Start village', exact: true }).waitFor();
  await page.evaluate((payload) => new Promise((resolve, reject) => {
    const open = indexedDB.open('rulecraft-village', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('world', 'readwrite');
      tx.objectStore('world').put({
        revision: 1, previous: null,
        current: { id: 'task-06-benchmark', at: 1, mode: 'full', track: 'sandbox', payload },
      }, 'village');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), encodeSociety(initial));
  await page.reload();
  await page.getByRole('button', { name: 'Resume village' }).tap();
  const heapSamples = [];
  for (let day = 1; day <= initial.fixture.days; day++) {
    await page.getByRole('navigation').getByRole('button', { name: 'Village', exact: true }).tap();
    await page.getByRole('button', { name: 'Advance day', exact: true }).tap();
    await page.getByRole('button', { name: `Resolve day ${day}`, exact: true }).tap();
    await page.getByRole('heading', { name: `Day ${day} results`, exact: true }).waitFor();
    if ([1, 12, 30].includes(day)) heapSamples.push([day,
      await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null)]);
  }
  const timing = await page.evaluate(() => ({
    entries: performance.getEntriesByType('measure').map(({ name, duration, detail }) => ({ name, ms: duration, ...detail })),
    longTasks: window.longTasks,
  }));
  const head = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('rulecraft-village', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const read = db.transaction('world').objectStore('world').get('village');
      read.onerror = () => { db.close(); reject(read.error); };
      read.onsuccess = () => { db.close(); resolve(read.result); };
    };
  }));
  const restored = loadSociety(head.current.payload);
  assert.equal(restored.state.turn, 30);
  assert.equal(restored.book.versions.length, 25);
  let expected = initial;
  while (expected.state.turn < initial.fixture.days) expected = advanceSociety(expected);
  assert.equal(head.current.payload, encodeSociety(expected));
  const audit = auditSnapshot(restored);

  const loads = [];
  for (let sample = 0; sample < 5; sample++) {
    await page.reload();
    await page.getByRole('button', { name: 'Resume village' }).tap();
    await page.getByText('Day 30 of 30 · 0 days remaining', { exact: true }).waitFor();
    loads.push(await page.evaluate(() => performance.getEntriesByName('rulecraft.load')
      .filter((entry) => entry.detail?.day === 30).at(-1).duration));
  }
  await page.getByRole('button', { name: 'Chronicle', exact: true }).tap();
  await page.getByRole('button', { name: 'Open share card' }).first().tap();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).tap();
  const download = await downloading;
  assert.equal(await download.failure(), null);
  const png = await page.evaluate(() => performance.getEntriesByName('rulecraft.share.png')
    .map(({ duration, detail }) => ({ ms: duration, ...detail })).at(-1));
  function stats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const at = (p) => sorted[Math.ceil(sorted.length * p) - 1];
    return { samples: sorted.length, p50: at(0.50) ?? null, p95: at(0.95) ?? null, max: sorted.at(-1) ?? null };
  }
  const metrics = (name) => stats(timing.entries.filter((entry) => entry.name === name && entry.day > 0).map(({ ms }) => ms));
  console.log(JSON.stringify({
    browser: browser.version(), hostPlatform: process.platform, fixtureDays: initial.fixture.days,
    citizens: initial.state.citizens.length, laws: initial.book.versions.length,
    timingMs: { turn: metrics('rulecraft.turn'), save: metrics('rulecraft.save'), loadVerify: stats(loads),
      narrative: metrics('rulecraft.narrative'), longTasks: stats(timing.longTasks) },
    longTasksOverOneSecond: timing.longTasks.filter((ms) => ms > 1000).length,
    currentBytes: Buffer.byteLength(head.current.payload), twoGenerationLogicalBytes: Buffer.byteLength(JSON.stringify(head)),
    heapSamples, png, audit, matchesHeadlessReplay: true,
  }, null, 2));
} finally {
  await browser.close();
}
```
