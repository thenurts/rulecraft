# Reproducible fixture and persistence research programs

Extract the fenced programs to the paths below from the repository root. The production app and engine do not import these scripts.

## Fixture sensitivity

Save as `tools/task-06-fixture-research.mjs`. The study report lists the commands and fixed cohorts.

```js
import assert from 'node:assert/strict';
import { advanceSociety, auditSnapshot, citizenAccount, confirmLaw, startSociety, villageScope } from '@rulecraft/simulation';
import baseline from '../fixtures/task-01-village.json' with { type: 'json' };

// Research identities are distinct from the v1 engine fixture schema.
// Every arm uses the exact same starting fixture for its matched seed.
const fixtures = {
  'baseline-v1': {},
  'low-market-v1': { opening: { marketFood: 10 } },
  'tight-delivery-v1': { opening: { marketFood: 10 }, capacity: { deliveriesPerSlot: 6 } },
  'three-merchants-v1': { opening: { marketFood: 30 },
    population: { farmer: 16, forester: 6, merchant: 3, guard: 15 } },
  'five-merchants-v1': { opening: { marketFood: 20 },
    population: { farmer: 16, forester: 6, merchant: 5, guard: 13 } },
  'five-merchants-farmers-v1': { population: { farmer: 21, forester: 6, merchant: 5, guard: 8 } },
  'five-merchants-farmers-low-market-v1': { opening: { marketFood: 20 },
    population: { farmer: 21, forester: 6, merchant: 5, guard: 8 } },
  'low-capital-v1': { opening: { marketFood: 10, marketCoin: 20 } },
  'low-household-coins-v1': { opening: { marketFood: 20, citizenCoin: 14 } },
  'tired-shallow-field-v1': { opening: { marketFood: 20, fieldFood: 430 },
    behaviour: { startingFatigueMin: 50, startingFatigueMax: 72 } },
};

const strategies = {
  control: [],
  harvest: [['harvest-duty', 'farmer', 'harvest-food']],
  morningHarvest: [['morning-harvest-duty', 'farmer', 'harvest-food', { operand: 'slot', operator: 'EQ', value: 'morning' }]],
  delivery: [['delivery-duty', 'merchant', 'market-delivery']],
  lowStockDelivery: [['low-stock-delivery', 'merchant', 'market-delivery', { operand: 'marketFood', operator: 'LT', value: 40 }]],
  both: [['harvest-duty', 'farmer', 'harvest-food'], ['delivery-duty', 'merchant', 'market-delivery']],
};

function run(patch, seed, strategy, trace = false) {
  const fixture = Object.fromEntries(Object.entries(baseline).map(([key, value]) =>
    [key, patch[key] ? { ...value, ...patch[key] } : value]));
  let game = startSociety(fixture, seed);
  const commands = strategies[strategy].map(([lawId, targetSelector, actionId, when]) => ({
    operation: 'CREATE', lawId, commandId: `confirm-${lawId}`,
    ast: { ...villageScope, targetSelector, actionId, modality: 'MUST', ...(when && { when }) },
  }));
  for (const command of commands) game = confirmLaw(game, command).game;
  while (game.state.turn < fixture.days) game = advanceSociety(game);
  const audit = auditSnapshot(game);
  const daily = game.days.map((day, index) => ({
    fed: day.residentsFed, stock: day.marketFood, delivered: day.foodDelivered,
    harvested: 0, deliveryJobs: 0, harvestJobs: 0, poorWithStock: 0,
    merchantFees: 0, producerReceipts: 0, mealPayments: 0, deliveryFundsBarriers: 0, guardWages: 0,
    affordability: game.societyDays[index].metrics.food.unableToAffordUnits,
    stockout: game.societyDays[index].metrics.food.unavailableMarketUnits,
    producerStock: game.societyDays[index].metrics.food.undeliveredProducerUnits,
    awareFeasible: game.societyDays[index].metrics.compliance.knownFeasibleDuties,
    unawareApplicable: game.societyDays[index].metrics.compliance.unaware,
    completedDuties: game.societyDays[index].metrics.compliance.completedDuties,
    infeasibleDuties: game.societyDays[index].metrics.compliance.infeasibleDuties,
    notices: game.societyDays[index].news.filter(({ noticeId }) => noticeId).length,
  }));
  for (const event of game.events) {
    const row = daily[event.turn - 1];
    if (!row) continue;
    if (event.action === 'harvest-food' && event.quantity > 0) {
      row.harvested += event.quantity;
      row.harvestJobs++;
    }
    if (event.action === 'market-delivery') {
      if (event.quantity > 0) row.deliveryJobs++;
      if (event.reason === 'insufficient-funds') row.deliveryFundsBarriers++;
    }
    if (event.foodAccess?.fundingShortfall > 0 && event.foodAccess.marketAvailableBefore > 0) row.poorWithStock++;
  }
  for (const tx of game.transactions) {
    const row = daily[tx.turn - 1];
    if (!row) continue;
    for (const leg of tx.legs) {
      if (leg.resource !== 'coin') continue;
      if (tx.reason === 'resident-meal') row.mealPayments += leg.quantity;
      if (tx.reason === 'guard-wage') row.guardWages += leg.quantity;
      if (tx.reason === 'market-delivery') {
        if (leg.to?.accountId === citizenAccount(tx.actorId, 'coin')) row.merchantFees += leg.quantity;
        else row.producerReceipts += leg.quantity;
      }
    }
  }
  const total = (key, days = daily) => days.reduce((sum, value) => sum + value[key], 0);
  return { seed, daily, totals: {
    ...Object.fromEntries(Object.keys(daily[0]).filter((key) => !['stock', 'producerStock'].includes(key))
      .map((key) => [key, total(key)])),
    earlyFed: total('fed', daily.slice(0, 6)), endStock: daily.at(-1).stock, endProducerStock: daily.at(-1).producerStock,
  }, ...(trace && { game, audit, commands }) };
}

function dist(values) {
  const mean = values.reduce((sum, x) => sum + x, 0) / values.length;
  const sd = Math.sqrt(values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (values.length - 1));
  const radius = 1.96 * sd / Math.sqrt(values.length);
  return { mean, sd, confidence95: [mean - radius, mean + radius], min: Math.min(...values), max: Math.max(...values) };
}
function aggregate(rows, control) {
  const delta = (key) => rows.map((row, i) => row.totals[key] - control[i].totals[key]);
  const improved = delta('fed');
  return {
    results: Object.fromEntries(Object.keys(rows[0].totals).map((key) => [key, dist(rows.map(({ totals }) => totals[key]))])),
    paired: Object.fromEntries(Object.keys(rows[0].totals).map((key) => [key, dist(delta(key))])),
    fedPairs: { improved: improved.filter((v) => v > 0).length, tied: improved.filter((v) => v === 0).length,
      worsened: improved.filter((v) => v < 0).length },
    daily: rows[0].daily.map((day, i) => Object.fromEntries(Object.keys(day).map((key) =>
      [key, rows.reduce((sum, row) => sum + row.daily[i][key], 0) / rows.length]))),
  };
}

const [phase, selected, policy, optional] = process.argv.slice(2);
const first = phase === 'explore' ? 20_000 : 41_000;
if (phase === 'trace') {
  assert.ok(Object.hasOwn(fixtures, selected) && Object.hasOwn(strategies, policy));
  const seed = Number(optional);
  const control = run(fixtures[selected], seed, 'control', true);
  const treatment = run(fixtures[selected], seed, policy, true);
  const alternative = run(fixtures[selected], seed, 'morningHarvest', true);
  const controlChoices = new Map(control.game.events.filter(({ choice }) => choice)
    .map((event) => [`${event.turn}|${event.phase}|${event.actorId}`, event]));
  const witnesses = treatment.game.events.filter((event) => {
    const from = controlChoices.get(`${event.turn}|${event.phase}|${event.actorId}`);
    return event.action === 'market-delivery' && event.transactionId && from?.action === 'rest' &&
      from.choice.draw === event.choice?.draw &&
      from.choice.candidates.some((choice) => choice.actionId === event.action && choice.selectionBarrier === null) &&
      event.legalChoice?.some((choice) => choice.actionId === event.action && choice.perceived.status === 'required' &&
        choice.perceivedDutyOutcome === 'completed' && choice.actual.status === 'required') &&
      treatment.daily[event.turn - 1].fed > control.daily[event.turn - 1].fed;
  });
  assert.ok(witnesses.length, 'Find a paired seed with a feasible choice switch and a feeding difference.');
  const changed = witnesses[0];
  function evidence(row) {
    const events = row.game.events.filter((event) => event.turn === changed.turn);
    const meals = events.filter(({ foodAccess }) => foodAccess);
    const choice = events.find(({ actorId, phase, choice }) => choice && actorId === changed.actorId && phase === changed.phase);
    const harvest = events.find(({ action, transactionId }) => action === 'harvest-food' && transactionId);
    const meal = meals.find(({ transactionId }) => transactionId);
    const txIds = [choice, harvest, meal].map((event) => event?.transactionId).filter(Boolean);
    return {
      commands: row.commands, laws: row.game.book.versions, daily: row.daily, totals: row.totals, audit: row.audit,
      choice, harvest, meal, missedMealExamples: meals.filter(({ quantity }) => quantity === 0).slice(0, 2),
      chosenActorNotices: row.game.book.notices.filter(({ citizenId }) => citizenId === changed.actorId),
      transactions: row.game.transactions.filter(({ id }) => txIds.includes(id)),
    };
  }
  console.log(JSON.stringify({ phase, selected, policy, seed, day: changed.turn,
    control: evidence(control), treatment: evidence(treatment), morningHarvest: evidence(alternative) }, null, 2));
} else {
  assert.ok(['explore', 'holdout'].includes(phase));
  if (phase === 'holdout') assert.ok(Object.hasOwn(fixtures, selected) && Object.hasOwn(strategies, policy) && policy !== 'control');
  const ids = phase === 'explore' ? (selected ? selected.split(',') : Object.keys(fixtures)) : [selected];
  assert.ok(ids.every((id) => Object.hasOwn(fixtures, id)));
  const arms = phase === 'explore' ? Object.keys(strategies) : ['control', policy, 'morningHarvest', 'lowStockDelivery'];
  const count = phase === 'explore' && optional === 'quick' ? 32 : 256;
  const seeds = Array.from({ length: count }, (_, index) => first + index);
  const study = {};
  for (const id of ids) {
    const control = seeds.map((seed) => run(fixtures[id], seed, 'control'));
    study[id] = Object.fromEntries([...new Set(arms)].map((name) => [name,
      aggregate(name === 'control' ? control : seeds.map((seed) => run(fixtures[id], seed, name)), control)]));
    console.error(id);
  }
  console.log(JSON.stringify({ phase, firstSeed: seeds[0], lastSeed: seeds.at(-1), patches: fixtures, strategies, study }));
}
```

## Persistence research

Save as `tools/task-06-save-research.mjs`. The Playwright routes are supplied from local data.

```js
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import {
  advanceSociety, auditSnapshot, canonicalJson, confirmLaw, encodeSociety, loadSociety,
  notifyLaw, societyHashes, startSociety, startSocietyV3, villageScope,
} from '@rulecraft/simulation';
import fixture from '../fixtures/task-01-village.json' with { type: 'json' };
import { projectNarrative } from '../apps/web/src/narrative/projection.ts';

const policy = { changesPerTurn: null, mustWeight: 60, mustNotWeight: 55 };
let game = startSociety({ ...fixture, days: 30 }, 42, undefined, policy);
for (const [targetSelector, actionId] of [
  ['farmer', 'harvest-food'], ['forester', 'cut-timber'], ['merchant', 'market-delivery'],
  ['guard', 'patrol'], ['all-citizens', 'rest'],
]) {
  for (const value of [0, 20, 40, 60, 80]) {
    const lawId = `benchmark-${actionId}-${value}`;
    game = confirmLaw(game, {
      operation: 'CREATE', lawId, commandId: `confirm-${lawId}`,
      ast: { ...villageScope, targetSelector, actionId, modality: 'MUST', when: { operand: 'fatigue', operator: 'GTE', value } },
    }).game;
  }
}
const saved = new Map();
const sampleDays = [12, 20, 29, 30];
const days = {};
const bytes = (value) => Buffer.byteLength(canonicalJson(value));
const since = (start) => performance.now() - start;
function measure(action) {
  const start = performance.now();
  const value = action();
  return { value, ms: since(start) };
}
function journal(game) {
  const { fixture, seed, config, policy, versions, journal, state: { turn } } = game;
  return { fixture, seed, config, policy, versions, journal, turn, expected: societyHashes(game) };
}
function replay(capsule) {
  const start = capsule.versions.schemaVersion === 3 ? startSocietyV3 : startSociety;
  let game = start(capsule.fixture, capsule.seed, capsule.config, capsule.policy);
  let cursor = 0;
  for (let turn = 0; turn <= capsule.turn; turn++) {
    while (capsule.journal[cursor]?.turn === turn) {
      const input = capsule.journal[cursor++];
      game = input.kind === 'command' ? confirmLaw(game, input.command).game
        : notifyLaw(game, input.citizenId, input.lawId, input.version);
    }
    if (turn < capsule.turn) game = advanceSociety(game);
  }
  assert.equal(cursor, capsule.journal.length);
  assert.deepEqual(societyHashes(game), capsule.expected);
  return game;
}
function witnessCheck(original, reconstructed) {
  const before = projectNarrative(original, 'full');
  assert.deepEqual(projectNarrative(reconstructed, 'full'), before);
  const records = new Set([
    ...reconstructed.events.map(({ id }) => id),
    ...reconstructed.book.versions.map(({ eventId }) => eventId),
    ...reconstructed.book.notices.map(({ eventId }) => eventId),
    ...reconstructed.societyDays.flatMap(({ news, patrol }) => [...news, ...patrol.investigations].map(({ id }) => id)),
  ]);
  let references = 0;
  for (const item of before.incidents) {
    for (const id of [...item.witnessEventIds, ...item.relatedEventIds]) { assert.ok(records.has(id), id); references++; }
    for (const { lawId, version } of item.lawVersionRefs) {
      assert.ok(reconstructed.book.versions.some((entry) => entry.lawId === lawId && entry.version === version));
      references++;
    }
  }
  return { incidents: before.incidents.length, references };
}
for (let day = 1; day <= 30; day++) {
  game = advanceSociety(game);
  if (!sampleDays.includes(day)) continue;
  const full = measure(() => encodeSociety(game));
  const decoded = measure(() => loadSociety(full.value));
  assert.deepEqual(auditSnapshot(decoded.value), auditSnapshot(game));
  saved.set(day, full.value);
  const snapshot = JSON.parse(full.value).snapshot;
  const capsule = journal(game);
  const replayed = measure(() => replay(capsule));
  assert.equal(encodeSociety(replayed.value), full.value);
  days[day] = {
    fullBytes: Buffer.byteLength(full.value), nodeEncodeMs: full.ms, nodeFullVerifyMs: decoded.ms, capsuleBytes: bytes(capsule),
    nodeCapsuleReplayAndHashMs: replayed.ms, topLevelBytes: Object.fromEntries(Object.entries(snapshot)
      .map(([key, value]) => [key, bytes(value)])),
    choiceNestedBytes: snapshot.events.reduce((sum, event) => sum + (event.choice ? bytes(event.choice) : 0), 0),
    legalChoiceNestedBytes: snapshot.events.reduce((sum, event) => sum + (event.legalChoice ? bytes(event.legalChoice) : 0), 0),
    ...witnessCheck(game, replayed.value),
  };
}
const earlier = JSON.parse(saved.get(29)).snapshot;
const later = JSON.parse(saved.get(30)).snapshot;
const sharedAppendOnlyBytes = {};
for (const key of ['events', 'transactions', 'days', 'societyDays', 'journal']) {
  assert.ok(earlier[key].length <= later[key].length);
  assert.equal(canonicalJson(earlier[key]), canonicalJson(later[key].slice(0, earlier[key].length)));
  sharedAppendOnlyBytes[key] = bytes(earlier[key]);
}

const history = [];
for (const start of [startSocietyV3, startSociety]) {
  let old = start(fixture, 42);
  old = confirmLaw(old, {
    operation: 'CREATE', lawId: 'morning-harvest-ban', commandId: 'create-harvest-ban',
    ast: { ...villageScope, targetSelector: 'farmer', actionId: 'harvest-food', modality: 'MUST_NOT',
      when: { operand: 'slot', operator: 'EQ', value: 'morning' } },
  }).game;
  old = confirmLaw(old, {
    operation: 'CREATE', lawId: 'village-patrol', commandId: 'create-village-patrol',
    ast: { ...villageScope, targetSelector: 'guard', actionId: 'patrol', modality: 'MUST' },
  }).game;
  while (old.state.turn < 12) old = advanceSociety(old);
  const reconstructed = replay(journal(old));
  assert.equal(encodeSociety(reconstructed), encodeSociety(old));
  history.push({ version: old.versions.schemaVersion, bytes: bytes(journal(old)), hashes: societyHashes(old),
    ...witnessCheck(old, reconstructed) });
}

const browser = await chromium.launch({ executablePath: process.env.RULECRAFT_CHROMIUM || undefined });
try {
  const page = await browser.newPage();
  const origin = 'http://rulecraft-save-research.invalid';
  await page.route(`${origin}/**`, (route) => {
    const day = Number(new URL(route.request().url()).pathname.slice(1));
    const payload = saved.get(day);
    return route.fulfill({ status: 200, body: payload ?? '<!doctype html><title>Isolated storage benchmark</title>',
      contentType: payload ? 'application/json' : 'text/html' });
  });
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const current = await (await fetch('/30')).text();
    const previous = await (await fetch('/29')).text();
    const encoder = new TextEncoder();
    const toGzip = (value) => new Response(new Blob([value]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    const fromGzip = (value) => new Response(new Blob([value]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const measure = async (action) => {
      const start = performance.now();
      const value = await action();
      return { value, ms: performance.now() - start };
    };
    const compressed = { current: await toGzip(current), previous: await toGzip(previous) };
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open('evidence-isolated', 1);
      open.onerror = () => reject(open.error);
      open.onupgradeneeded = () => open.result.createObjectStore('world');
      open.onsuccess = () => resolve(open.result);
    });
    function read(key) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('world');
        const req = tx.objectStore('world').get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    function write(key, value, injectQuota = false) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('world', 'readwrite', { durability: 'strict' });
        const store = tx.objectStore('world');
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(injectQuota ? new DOMException('Injected quota failure', 'QuotaExceededError') : tx.error);
        store.get(key).onsuccess = () => {
          store.put(value, key);
          if (injectQuota) tx.abort();
        };
      });
    }
    const timings = { plainWrite: [], plainRead: [], compressLatest: [], gzipWrite: [], gzipRead: [], decompressLatest: [] };
    for (let index = 0; index < 5; index++) {
      timings.plainWrite.push((await measure(() => write('plain', { current, previous }))).ms);
      const plain = await measure(() => read('plain'));
      timings.plainRead.push(plain.ms);
      if (plain.value.current !== current || plain.value.previous !== previous) throw Error('Plain bytes differed.');
      const encoded = await measure(() => toGzip(current));
      timings.compressLatest.push(encoded.ms);
      timings.gzipWrite.push((await measure(() => write('gz', { current: encoded.value, previous: compressed.previous }))).ms);
      const stored = await measure(() => read('gz'));
      timings.gzipRead.push(stored.ms);
      const decoded = await measure(() => fromGzip(stored.value.current));
      timings.decompressLatest.push(decoded.ms);
      if (decoded.value !== current || await fromGzip(stored.value.previous) !== previous) throw Error('Gzip bytes differed.');
    }
    let rollbackRetained = false;
    try { await write('gz', { current: compressed.previous }, true); }
    catch (error) {
      const retained = await read('gz');
      rollbackRetained = error.name === 'QuotaExceededError' &&
        await fromGzip(retained.current) === current && await fromGzip(retained.previous) === previous;
    }
    await write('gz', { current: compressed.current.slice(0, 10), previous: compressed.previous });
    const corrupt = await read('gz');
    let corruptionDetected = false;
    try { await fromGzip(corrupt.current); }
    catch { corruptionDetected = true; }
    const fallback = await fromGzip(corrupt.previous);
    db.close();
    if (fallback !== previous) throw Error('Previous generation differed.');
    return { timings, rollbackRetained, corruptionDetected, fallback,
      plainPairPayloadBytes: encoder.encode(current).byteLength + encoder.encode(previous).byteLength,
      gzipPairPayloadBytes: compressed.current.byteLength + compressed.previous.byteLength,
    };
  });
  assert.equal(result.rollbackRetained, true);
  assert.equal(result.corruptionDetected, true);
  assert.equal(loadSociety(result.fallback).state.turn, 29);
  assert.equal(result.fallback, saved.get(29));
  delete result.fallback;
  console.log(JSON.stringify({ days, history, sharedAppendOnlyBytes, browser: browser.version(), isolatedStorage: result }, null, 2));
} finally {
  await browser.close();
}
```

## Matched meal and affordability follow-up

Save as `tools/task-06-meal-pairs.mjs`. It pairs each resident meal by seed, day and citizen within the selected fixture. Run it with Node and capture standard output.

```js
import assert from 'node:assert/strict';
import { advanceSociety, auditSnapshot, confirmLaw, startSociety, villageScope } from '@rulecraft/simulation';
import baseline from '../fixtures/task-01-village.json' with { type: 'json' };
const fixture = { ...baseline, population: { farmer: 21, forester: 6, merchant: 5, guard: 8 } };
const groups = Object.fromEntries(Object.keys(fixture.population).map((role) =>
  [role, { baselineFed: 0, deliveryFed: 0, baselineFundsShort: 0, deliveryFundsShort: 0, gainedFundsShortAfterMorePriorMeals: 0,
    treatmentOnlyFundsShort: 0, controlOnlyFundsShort: 0, treatmentOnlyFundsShortWithStock: 0,
    sameFundsShortWithAdditionalStock: 0 }]));
let example = null;
function simulate(seed, delivery) {
  let game = startSociety(fixture, seed);
  if (delivery) game = confirmLaw(game, { operation: 'CREATE', lawId: 'delivery-duty', commandId: 'confirm-delivery-duty',
    ast: { ...villageScope, targetSelector: 'merchant', actionId: 'market-delivery', modality: 'MUST' } }).game;
  while (game.state.turn < fixture.days) game = advanceSociety(game);
  auditSnapshot(game);
  return game;
}
for (let seed = 41000; seed <= 41255; seed++) {
  const control = simulate(seed, false);
  const delivery = simulate(seed, true);
  const key = ({ turn, actorId }) => `${turn}:${actorId}`;
  const treatedMeals = new Map(delivery.events.filter(({ foodAccess }) => foodAccess).map((event) => [key(event), event]));
  const citizens = new Map(control.state.citizens.map(({ id, occupation }) => [id, occupation]));
  const histories = new Map();
  for (const before of control.events.filter(({ foodAccess }) => foodAccess)) {
    const after = treatedMeals.get(key(before));
    assert.ok(after);
    const role = citizens.get(before.actorId);
    const group = groups[role];
    const history = histories.get(before.actorId) ?? { controlBought: 0, deliveryBought: 0 };
    group.baselineFed += before.quantity;
    group.deliveryFed += after.quantity;
    group.baselineFundsShort += before.foodAccess.fundingShortfall;
    group.deliveryFundsShort += after.foodAccess.fundingShortfall;
    if (after.foodAccess.fundingShortfall > 0 && before.foodAccess.fundingShortfall === 0) {
      group.treatmentOnlyFundsShort++;
      if (after.foodAccess.marketAvailableBefore > 0) group.treatmentOnlyFundsShortWithStock++;
      if (history.deliveryBought > history.controlBought) {
        group.gainedFundsShortAfterMorePriorMeals++;
        if (!example && role === 'forester') example = { seed, history: { ...history }, control: before, delivery: after };
      }
    }
    if (before.foodAccess.fundingShortfall > 0 && after.foodAccess.fundingShortfall === 0) group.controlOnlyFundsShort++;
    if (before.foodAccess.fundingShortfall > 0 && after.foodAccess.fundingShortfall > 0 &&
        before.foodAccess.marketAvailableBefore === 0 && after.foodAccess.marketAvailableBefore > 0) {
      group.sameFundsShortWithAdditionalStock++;
    }
    history.controlBought += before.quantity;
    history.deliveryBought += after.quantity;
    histories.set(before.actorId, history);
  }
}
console.log(JSON.stringify({ seeds: 256, groups, example }, null, 2));
```
