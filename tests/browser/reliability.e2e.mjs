import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { advanceSociety, auditSnapshot, encodeSociety, loadSociety, startSocietyV3 } from '@rulecraft/simulation';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/task-01-village.json', import.meta.url), 'utf8'));

async function start(page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Start village', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Village', exact: true })).toBeVisible();
}

async function mutateHead(page, operation, payload) {
  return page.evaluate(({ operation, payload }) => new Promise((resolve, reject) => {
    const open = indexedDB.open('rulecraft-village', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('world', operation === 'read' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('world');
      const read = store.get('village');
      let result;
      read.onsuccess = () => {
        const head = read.result;
        if (operation === 'read') result = head;
        else if (operation === 'seed') {
          store.put({ revision: 1, previous: null, current: { id: 'legacy', at: 1, mode: 'full', track: 'sandbox', payload } }, 'village');
        } else if (operation === 'remove-setup') {
          delete head.current.setup;
          delete head.current.sessionFormat;
          store.put(head, 'village');
          result = head;
        } else {
          store.put({ ...head, current: { ...head.current, payload } }, 'village');
        }
      };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), { operation, payload });
}

async function openAdvance(page, day) {
  await page.getByRole('button', { name: 'Advance day', exact: true }).click();
  return page.getByRole('button', { name: `Resolve day ${day}`, exact: true });
}

test('aborted and quota-failed writes leave the last good day; duplicate activation commits once', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'world' && window.saveFault === 'quota') throw new DOMException('Test quota', 'QuotaExceededError');
      if (this.name === 'world' && window.saveFault === 'abort') {
        this.transaction.abort();
        return undefined;
      }
      return original.apply(this, args);
    };
  });
  await start(page);
  let button = await openAdvance(page, 1);
  await page.evaluate(() => { window.saveFault = 'abort'; });
  await button.click();
  await expect(page.getByRole('alert')).toContainText('Changes were not saved');
  await expect(page.getByText('Day 0 of 12')).toBeVisible();
  expect((await mutateHead(page, 'read')).revision).toBe(1);
  await page.evaluate(() => { window.saveFault = 'quota'; });
  await button.click();
  await expect(page.getByRole('alert')).toContainText('Device storage is full');
  expect((await mutateHead(page, 'read')).revision).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Resume village' }).click();
  await expect(page.getByText('Day 0 of 12')).toBeVisible();
  button = await openAdvance(page, 1);
  await button.evaluate((element) => {
    element.click();
    element.click();
  });
  await expect(page.getByRole('heading', { name: 'Day 1 results' })).toBeVisible();
  expect((await mutateHead(page, 'read')).revision).toBe(2);
});

test('two browser tabs cannot overwrite the same committed revision', async ({ page, context }) => {
  await start(page);
  const other = await context.newPage();
  await other.goto('./');
  await other.getByRole('button', { name: 'Resume village' }).click();
  await (await openAdvance(page, 1)).click();
  await expect(page.getByRole('heading', { name: 'Day 1 results' })).toBeVisible();
  await (await openAdvance(other, 1)).click();
  await expect(other.getByRole('alert')).toContainText('changed in another tab');
  await expect(other.getByText('Day 0 of 12')).toBeVisible();
  await other.getByRole('button', { name: 'Reload saved village' }).click();
  await other.getByRole('button', { name: 'Resume village' }).click();
  await expect(other.getByText('Day 1 of 12')).toBeVisible();
});

test('a corrupted current generation recovers the prior one; unsupported saves fail explicitly', async ({ page }) => {
  await start(page);
  await (await openAdvance(page, 1)).click();
  await expect(page.getByRole('heading', { name: 'Day 1 results' })).toBeVisible();
  await mutateHead(page, 'corrupt', 'invalid');
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Recovered the previous complete save');
  await page.getByRole('button', { name: 'Resume village' }).click();
  await expect(page.getByText('Day 0 of 12')).toBeVisible();
  const payload = encodeSociety(startSocietyV3(fixture, 42)).replace('"schemaVersion":3', '"schemaVersion":300');
  await mutateHead(page, 'seed', payload);
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('unsupported engine version');
  await expect(page.getByRole('button', { name: 'Start village', exact: true })).toBeDisabled();
});

test('a valid modern world missing scenario setup recovers the previous Hungry Village', async ({ page }) => {
  await start(page);
  await (await openAdvance(page, 1)).click();
  await expect(page.getByRole('heading', { name: 'Day 1 results' })).toBeVisible();
  const damaged = await mutateHead(page, 'remove-setup');
  expect(loadSociety(damaged.current.payload).state.turn).toBe(1);

  await page.reload();
  await expect(page.getByRole('status')).toContainText('Recovered the previous complete save');
  await page.getByRole('button', { name: 'Resume village' }).click();
  await expect(page.getByText('Day 0 of 12')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Hungry Village' })).toBeVisible();
  await expect(page.getByText(/Provisional targets by day 12/)).toHaveCount(0);
  expect(await mutateHead(page, 'read')).toEqual(damaged);
});

test('unavailable device storage never reports a successful start', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(globalThis, 'indexedDB', { configurable: true,
    get() { throw new DOMException('Storage denied in test', 'SecurityError'); } }));
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('Storage denied in test');
  await expect(page.getByRole('button', { name: 'Start village', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Resume village' })).toHaveCount(0);
});

test('a historical v3 game resumes and advances using the original engine', async ({ page }) => {
  const previous = advanceSociety(startSocietyV3(fixture, 42));
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Start village', exact: true })).toBeEnabled();
  await mutateHead(page, 'seed', encodeSociety(previous));
  await page.reload();
  await page.getByRole('button', { name: 'Resume village' }).click();
  await expect(page.getByText(/Historical engine v3/)).toBeVisible();
  await (await openAdvance(page, 2)).click();
  await expect(page.getByRole('heading', { name: 'Day 2 results' })).toBeVisible();
  const head = await mutateHead(page, 'read');
  expect(head.current.payload).toBe(encodeSociety(advanceSociety(previous)));
});

test('a full 12-day village saves, replays and records actual browser timings', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    window.longTasks = [];
    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      new PerformanceObserver((records) => window.longTasks.push(...records.getEntries().map(({ duration }) => duration)))
        .observe({ type: 'longtask', buffered: true });
    }
  });
  await start(page);
  await page.getByRole('button', { name: 'Decree Book', exact: true }).click();
  await page.getByRole('button', { name: 'Compose decree' }).click();
  await page.getByRole('combobox', { name: 'Who', exact: true }).selectOption('farmer');
  await page.getByRole('combobox', { name: 'Rule', exact: true }).selectOption('MUST_NOT');
  await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption('harvest-food');
  await page.getByRole('button', { name: 'Review decree' }).click();
  await page.getByRole('button', { name: 'Confirm decree', exact: true }).click();
  await expect(page.getByText(/Decree saved/)).toBeVisible();
  for (let day = 1; day <= 12; day++) {
    await page.getByRole('navigation').getByRole('button', { name: 'Village' }).click();
    await (await openAdvance(page, day)).click();
    await expect(page.getByRole('heading', { name: `Day ${day} results`, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Day-12 debrief' })).toBeVisible();
  const timings = await page.evaluate(() => [...performance.getEntriesByName('rulecraft.turn'), ...performance.getEntriesByName('rulecraft.save')]
    .filter((entry) => entry.detail?.day > 0).map(({ name, duration, detail }) => ({ name, ms: duration, ...detail })));
  const head = await mutateHead(page, 'read');
  const audited = loadSociety(head.current.payload);
  expect(audited.state.turn).toBe(12);
  expect(auditSnapshot(audited).remaining.coin).toBe(1500);
  expect(head.current.payload.length).toBeGreaterThan(1_000_000);
  const narrativeTimings = await page.evaluate(() => performance.getEntriesByName('rulecraft.narrative')
    .filter((entry) => entry.detail?.day > 0).map(({ duration }) => duration));
  const catalogue = () => page.locator('[data-incident-id]').evaluateAll((cards) => cards.map((card) =>
    ({ id: card.dataset.incidentId, version: card.dataset.narrativeVersion, text: card.innerText })));
  await page.getByRole('button', { name: 'Chronicle', exact: true }).click();
  const originalChronicle = await catalogue();
  expect(originalChronicle.length).toBeGreaterThan(0);
  const longTasks = await page.evaluate(() => window.longTasks);
  const loads = [];
  for (let sample = 0; sample < 5; sample++) {
    await page.reload();
    await page.getByRole('button', { name: 'Resume village' }).click();
    await expect(page.getByText('Day 12 of 12')).toBeVisible();
    loads.push(await page.evaluate(() => performance.getEntriesByName('rulecraft.load')
      .filter((entry) => entry.detail?.day === 12).at(-1).duration));
  }
  await expect(page.getByRole('button', { name: 'Advance day', exact: true })).toHaveCount(0);
  const stats = (values) => {
    const ordered = [...values].sort((a, b) => a - b);
    const middle = Math.floor(ordered.length / 2);
    return { n: ordered.length, p50: ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2,
      p95: ordered[Math.ceil(ordered.length * 0.95) - 1] };
  };
  const summary = {
    turns: stats(timings.filter(({ name }) => name === 'rulecraft.turn').map(({ ms }) => ms)),
    saves: stats(timings.filter(({ name }) => name === 'rulecraft.save').map(({ ms }) => ms)),
    reloadVerify: stats(loads),
    longestMainThreadTaskMs: longTasks.length ? Math.max(...longTasks) : null,
    day12SaveMs: timings.find(({ day, name }) => day === 12 && name === 'rulecraft.save').ms,
    day12PayloadBytes: head.current.payload.length,
    twoGenerationBytes: JSON.stringify(head).length,
    audit: auditSnapshot(audited),
  };
  await page.getByRole('button', { name: 'Chronicle', exact: true }).click();
  expect(await catalogue()).toEqual(originalChronicle);
  expect(await mutateHead(page, 'read')).toEqual(head);
  const lastProjection = await page.evaluate(() => performance.getEntriesByName('rulecraft.narrative').at(-1)?.duration);
  expect(narrativeTimings.length).toBe(12);
  console.log('Measured browser narrative', JSON.stringify({
    projection: stats(narrativeTimings),
    day12ReloadProjectionMs: lastProjection, chronicleCards: originalChronicle.length,
  }));
  expect(summary.turns.n).toBe(12);
  console.log('Measured browser persistence', JSON.stringify(summary));
});


test('a failed decree confirmation leaves the draft intact and retry commits one version', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'world' && window.saveFault) throw new DOMException('Test quota', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await start(page);
  await page.getByRole('button', { name: 'Decree Book', exact: true }).click();
  await page.getByRole('button', { name: 'Compose decree' }).click();
  await page.getByRole('combobox', { name: 'Who', exact: true }).selectOption('farmer');
  await page.getByRole('combobox', { name: 'Rule', exact: true }).selectOption('MUST');
  await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption('harvest-food');
  await page.getByRole('button', { name: 'Review decree' }).click();
  await page.evaluate(() => { window.saveFault = true; });
  const confirm = page.getByRole('button', { name: 'Confirm decree', exact: true });
  await confirm.click();
  await expect(page.getByRole('alert')).toContainText('Device storage is full');
  await expect(page.getByRole('heading', { name: 'Compose decree' })).toBeVisible();
  expect(loadSociety((await mutateHead(page, 'read')).current.payload).book.versions).toHaveLength(0);
  await page.evaluate(() => { window.saveFault = false; });
  await confirm.evaluate((element) => { element.click(); element.click(); });
  await expect(page.getByText('Decree saved. Confirmed for day 1.')).toBeVisible();
  const saved = await mutateHead(page, 'read');
  expect(saved.revision).toBe(2);
  expect(loadSociety(saved.current.payload).book.versions).toHaveLength(1);
});
