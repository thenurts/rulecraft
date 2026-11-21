import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadSociety } from '@rulecraft/simulation';
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
  await capture(page, 'debrief-390');

  await page.reload();
  await button(page, 'Resume village').tap();
  await button(page, 'Open day-six checkpoint').tap();
  await expect(page.getByText(`${fed} of 240 resident-days fully fed through day 6`, { exact: true })).toBeVisible();
  await button(page, 'Back').tap();
  await button(page, 'Open day-12 debrief').tap();
  await button(page, 'Retry same seed').tap();
  await button(page, 'Cancel retry').tap();
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
