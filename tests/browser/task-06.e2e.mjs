import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { advanceSociety, encodeSociety, loadSociety, startSociety } from '@rulecraft/simulation';
import fixture from '../../fixtures/task-01-village.json' with { type: 'json' };
import { startVillage } from './helpers.mjs';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });

const button = (page, name) => page.getByRole('button', { name, exact: true });
const heading = (page, name) => page.getByRole('heading', { name, exact: true });

async function advance(page, day) {
  await page.getByRole('navigation').getByRole('button', { name: 'Village', exact: true }).tap();
  await button(page, 'Advance day').tap();
  await button(page, `Resolve day ${day}`).tap();
  await expect(heading(page, `Day ${day} results`)).toBeVisible();
}

async function readHead(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('rulecraft-village', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('world').objectStore('world').get('village');
      request.onerror = () => { db.close(); reject(request.error); };
      request.onsuccess = () => { db.close(); resolve(request.result); };
    };
  }));
}

async function capture(page, name) {
  const directory = process.env.RULECRAFT_TASK06_SCREENSHOTS;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${name}.png`), animations: 'disabled', fullPage: true });
}

test('Junior learns from the real day-six checkpoint, debrief and confirmed same-seed new run', async ({ page }) => {
  await startVillage(page);
  await expect(heading(page, 'The Hungry Village')).toBeVisible();
  await expect(page.getByText('0 of 480 resident-days fully fed')).toBeVisible();
  await capture(page, 'hungry-village-390');
  await button(page, 'Open Decree Book').tap();
  await button(page, 'Compose decree').tap();
  await page.getByRole('combobox', { name: 'Who', exact: true }).selectOption('merchant');
  await page.getByRole('combobox', { name: 'Rule', exact: true }).selectOption('MUST');
  await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption('market-delivery');
  await expect(page.getByRole('combobox', { name: 'When condition' })).toHaveCount(0);
  await button(page, 'Review decree').tap();
  await button(page, 'Confirm decree').tap();
  await expect(page.getByText('Decree saved. Confirmed for day 1.')).toBeVisible();

  for (let day = 1; day <= 6; day++) await advance(page, day);
  await expect(heading(page, 'Day-six checkpoint')).toBeVisible();
  const current = (await readHead(page)).current;
  const world = loadSociety(current.payload);
  const fed = world.days.reduce((sum, day) => sum + day.residentsFed, 0);
  await expect(page.getByText(`${fed} of 240 resident-days fully fed through day 6`, { exact: true })).toBeVisible();
  const checkpoint = page.locator('.mission-panel');
  await checkpoint.getByText('Follow the evidence', { exact: true }).tap();
  const delivery = checkpoint.getByRole('button', { name: /Inspect a delivery · day/ });
  const id = await delivery.getAttribute('data-witness-id');
  expect(world.events.find((event) => event.id === id).action).toBe('market-delivery');
  await capture(page, 'checkpoint-390');
  await delivery.tap();
  await expect(heading(page, 'Royal Inquiry')).toBeFocused();
  await expect(page.locator('.page-header code')).toHaveText(id);

  await button(page, 'Back').tap();
  await button(page, 'Keep or revise a decree').tap();
  await button(page, 'Amend').tap();
  await expect(page.getByRole('combobox', { name: 'When condition' })).toBeVisible();
  await page.getByRole('combobox', { name: 'When condition' }).selectOption('slot');
  await expect(page.getByRole('combobox', { name: 'Unless condition' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'When comparison' }).selectOption('EQ');
  await page.getByRole('combobox', { name: 'When time' }).selectOption('afternoon');
  await button(page, 'Review decree').tap();
  await button(page, 'Confirm amendment').tap();
  await expect(page.getByText('Decree saved. Confirmed for day 7.')).toBeVisible();

  for (let day = 7; day <= 12; day++) await advance(page, day);
  await expect(heading(page, 'Day-12 debrief')).toBeVisible();
  const completed = await readHead(page);
  const finished = loadSociety(completed.current.payload);
  const finalFed = finished.days.reduce((sum, day) => sum + day.residentsFed, 0);
  await expect(page.getByText(`${finalFed} of 480 resident-days fully fed through day 12`, { exact: true })).toBeVisible();
  await expect(page.getByText('Market supply shortfall', { exact: true })).toBeVisible();
  await expect(page.getByText('Affordability shortfall', { exact: true })).toBeVisible();
  await expect(page.getByText('Meals by occupation', { exact: true })).toBeVisible();
  await expect(page.getByText('Individual meal records', { exact: true })).toBeVisible();
  await expect(page.getByText(/provisional campaign targets/)).toHaveCount(0);
  console.log('Task 06 authored campaign', JSON.stringify({
    seed: finished.seed, fedAtCheckpoint: fed, fedAtDebrief: finalFed, decreeVersions: finished.book.versions.length,
    stockout: finished.societyDays.reduce((sum, day) => sum + day.metrics.food.unavailableMarketUnits, 0),
    affordability: finished.societyDays.reduce((sum, day) => sum + day.metrics.food.unableToAffordUnits, 0),
  }));
  await capture(page, 'debrief-390');

  await page.reload();
  await button(page, 'Resume village').tap();
  await button(page, 'Open day-six checkpoint').tap();
  await expect(page.getByText(`${fed} of 240 resident-days fully fed through day 6`, { exact: true })).toBeVisible();
  await button(page, 'Back').tap();
  await button(page, 'Open day-12 debrief').tap();
  await button(page, 'Retry same seed').tap();
  await expect(page.getByRole('group', { name: 'Replace current village' })).toBeFocused();
  await button(page, 'Cancel retry').tap();
  await expect(button(page, 'Retry same seed')).toBeFocused();
  expect(await readHead(page)).toEqual(completed);
  await button(page, 'Retry same seed').tap();
  await button(page, 'Replace and retry').tap();
  await expect(heading(page, 'Village')).toBeVisible();
  const retry = await readHead(page);
  expect(retry.current.setup).toEqual(completed.current.setup);
  expect(retry.current.id).not.toBe(completed.current.id);
  expect(retry.previous).toEqual(completed.current);
  expect(loadSociety(retry.current.payload).state.turn).toBe(0);
});

test('Sandbox records the preset and seed, stops at twelve days and confirms new experiments', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Complexity').selectOption('full');
  await page.getByLabel('Play option').selectOption('sandbox');
  await page.getByLabel('Starting preset').selectOption('five-merchants-farmers-v1');
  const seed = page.getByRole('textbox', { name: 'Seed', exact: true });
  await seed.fill('4294967296');
  await expect(button(page, 'Start village')).toBeDisabled();
  await expect(seed).toHaveAttribute('aria-invalid', 'true');
  await seed.fill('0');
  await capture(page, 'sandbox-setup-390');
  await button(page, 'Start village').tap();
  await expect(heading(page, 'Sandbox experiment')).toBeVisible();
  const first = await readHead(page);
  expect(first.current.setup).toMatchObject({ scenario: 'sandbox-experiment', preset: 'five-merchants-farmers-v1', seed: 0, profile: 'full' });
  expect(loadSociety(first.current.payload).fixture.population).toMatchObject({ merchant: 5, farmer: 21 });
  await expect(page.getByText('The Hungry Village', { exact: true })).toHaveCount(0);
  for (let day = 1; day <= 12; day++) await advance(page, day);
  await expect(heading(page, 'Experiment complete')).toBeVisible();
  await expect(page.getByText('Choose a decree to try and compare the recorded outcomes. This experiment has no victory target.')).toBeVisible();
  await expect(heading(page, 'Day-12 debrief')).toHaveCount(0);
  await page.getByText('Compare days', { exact: true }).tap();
  await capture(page, 'sandbox-complete-390');
  await button(page, 'Open Gazette for day 1').tap();
  await expect(heading(page, 'Gazette')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Report day' })).toHaveValue('1');

  await button(page, 'Village').tap();
  await expect(button(page, 'Advance day')).toHaveCount(0);
  await button(page, 'Retry same seed').tap();
  await button(page, 'Replace and retry').tap();
  await expect(page.getByText('Day 0 of 12 · 12 days remaining')).toBeVisible();
  const replay = await readHead(page);
  expect(replay.current.payload).toBe(first.current.payload);
  expect(replay.current.id).not.toBe(first.current.id);
  await button(page, 'Choose a new seed').tap();
  const next = page.getByRole('textbox', { name: 'New seed' });
  await next.fill('0');
  await expect(button(page, 'Replace and retry')).toBeDisabled();
  await next.fill('4294967295');
  await button(page, 'Cancel retry').tap();
  expect(await readHead(page)).toEqual(replay);
  await button(page, 'Choose a new seed').tap();
  await next.fill('4294967295');
  await button(page, 'Replace and retry').tap();
  await expect(page.getByText(/Scenario v1 · Profile v1 · Seed 4294967295/)).toBeVisible();
  const changed = await readHead(page);
  expect(changed.current.setup.seed).toBe(4294967295);
  expect(changed.current.payload).not.toBe(replay.current.payload);
  expect(changed.previous).toEqual(replay.current);
});

test('legacy v4 Campaign resumes its original preview and advances with the exact recorded engine', async ({ page }) => {
  const game = advanceSociety(startSociety(fixture, 42));
  await page.goto('/');
  await expect(button(page, 'Start village')).toBeEnabled();
  await page.evaluate((payload) => new Promise((resolve, reject) => {
    const open = indexedDB.open('rulecraft-village', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('world', 'readwrite');
      tx.objectStore('world').put({
        revision: 1, previous: null, current: { id: 'historic-preview', mode: 'junior', track: 'campaign', at: 1, payload },
      }, 'village');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), encodeSociety(game));
  await page.reload();
  await expect(page.getByText('Junior · Campaign preview · Day 1', { exact: true })).toBeVisible();
  await button(page, 'Resume village').tap();
  await expect(page.getByText(/Provisional targets by day 12/)).toBeVisible();
  await expect(page.getByText('Legacy preview · Seed 42')).toBeVisible();
  await advance(page, 2);
  const { current } = await readHead(page);
  expect(current).not.toHaveProperty('setup');
  expect(current.payload).toBe(encodeSociety(advanceSociety(game)));
});

test('complete composer words and native selections remain visible at 320 and 390 px with enlarged text', async ({ page }) => {
  await startVillage(page, 'full', 'campaign');
  await button(page, 'Decree Book').tap();
  await button(page, 'Compose decree').tap();
  const select = (label) => page.getByRole('combobox', { name: label, exact: true });
  await select('Who').selectOption('merchant');
  await select('Rule').selectOption('MUST_NOT');
  await select('Action').selectOption('market-delivery');
  await select('When condition').selectOption('fieldFood');
  await select('When comparison').selectOption('EQ');
  const threshold = page.getByRole('spinbutton', { name: 'When threshold in food units' });
  await threshold.fill('0');
  const values = [
    ['Who', 'Merchants'], ['Rule', 'Must not'], ['Action', 'deliver food to the market'],
    ['When condition', 'harvestable field stock'], ['When comparison', 'Equal to'],
  ];
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const scale of [100, 200]) {
      await page.evaluate((scale) => { document.documentElement.style.fontSize = scale + '%'; }, scale);
      for (const [field, text] of values) {
        const frame = select(field).locator('..');
        const label = frame.locator('.choice-value');
        await expect(label).toHaveText(text);
        await expect(label).toBeVisible();
        expect(await frame.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const select = element.querySelector('select');
          const target = select.getBoundingClientRect();
          const range = document.createRange();
          const textNode = element.querySelector('.choice-value').firstChild;
          range.selectNodeContents(textNode);
          const fits = [...range.getClientRects()].every((line) => line.left >= box.left && line.right <= box.right + 1 &&
            line.top >= box.top && line.bottom <= box.bottom + 1);
          const intactWords = [...textNode.textContent.matchAll(/\S+/g)].every((word) => {
            range.setStart(textNode, word.index);
            range.setEnd(textNode, word.index + word[0].length);
            return range.getClientRects().length === 1;
          });
          return fits && intactWords && target.width >= 44 && target.height >= 44;
        })).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth)).toBe(true);
      expect(await heading(page, 'Compose decree').evaluate((element) => {
        const range = document.createRange();
        range.setStart(element.firstChild, 0);
        range.setEnd(element.firstChild, 'Compose'.length);
        return range.getClientRects().length;
      })).toBe(1);
      if (scale === 200 && width === 320) await capture(page, 'composer-320-200-percent');
    }
  }
  // Tab onto the native picker to verify its wrapping presentation gains a visible keyboard focus ring.
  await select('Rule').focus();
  await page.keyboard.press('Tab');
  await expect(select('Action')).toBeFocused();
  expect(await select('Action').locator('..').evaluate((frame) => getComputedStyle(frame).outlineStyle)).toBe('solid');
  await expect(page.getByRole('group', { name: 'Decree wording' })).toMatchAriaSnapshot(`
    - group "Decree wording":
      - combobox "Who"
      - combobox "Rule"
      - combobox "Action"
  `);
  await threshold.fill('');
  await expect(button(page, 'Review decree')).toBeDisabled();
  await expect(page.getByText('Complete or remove the condition or exception.')).toBeVisible();
  await threshold.fill('0');
  await button(page, 'Review decree').tap();
  await expect(page.getByRole('group', { name: 'Final decree confirmation' })).toBeFocused();
  await button(page, 'Keep editing').tap();
  await expect(button(page, 'Review decree')).toBeFocused();
  await button(page, 'Review decree').tap();
  await button(page, 'Confirm decree').tap();
  await expect(page.getByText('Decree saved. Confirmed for day 1.')).toBeVisible();
});
