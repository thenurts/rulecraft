import { expect, test } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { advanceSociety, confirmLaw, encodeSociety, societyDefaults } from '@rulecraft/simulation';
import { projectNarrative } from '../../apps/web/src/narrative/projection.ts';
import { completedCompetingDutiesDay } from '../fixtures/task-05-competing-duties.ts';
import { startVillage } from './helpers.mjs';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });

const button = (page, name) => page.getByRole('button', { name, exact: true });
const heading = (page, name) => page.getByRole('heading', { name, exact: true });
const story = (page) => page.locator('[data-incident-id]');
const screenshots = process.env.RULECRAFT_NARRATIVE_SCREENSHOTS;

async function capture(page, name) {
  if (screenshots) {
    await mkdir(screenshots, { recursive: true });
    await page.screenshot({ path: join(screenshots, name), animations: 'disabled' });
  }
}

async function advance(page, day) {
  await button(page, 'Village').tap();
  await button(page, 'Advance day').tap();
  await button(page, `Resolve day ${day}`).tap();
  await expect(heading(page, `Day ${day} results`)).toBeVisible();
}

function readGeneration(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('rulecraft-village', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('world').objectStore('world').get('village');
      request.onsuccess = () => { db.close(); resolve(request.result.current); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }));
}

test('Gazette and Chronicle show the same real stories and open decree and action evidence', async ({ page }) => {
  await startVillage(page, 'full', 'sandbox');
  await button(page, 'Chronicle').tap();
  await expect(page.getByText('No selected stories from this village yet.')).toBeVisible();
  await button(page, 'Decree Book').tap();
  await button(page, 'Compose decree').tap();
  await page.getByRole('combobox', { name: 'Who', exact: true }).selectOption('farmer');
  await page.getByRole('combobox', { name: 'Rule', exact: true }).selectOption('MUST_NOT');
  await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption('harvest-food');
  await button(page, 'Review decree').tap();
  await button(page, 'Confirm decree').tap();
  await expect(page.getByText('Decree saved. Confirmed for day 1.')).toBeVisible();
  await advance(page, 1);
  await expect(story(page)).toHaveCount(1);
  const leadingId = await story(page).getAttribute('data-incident-id');
  await button(page, 'Open Gazette').tap();
  await expect(story(page).first()).toHaveAttribute('data-incident-id', leadingId);
  await story(page).first().evaluate((card) => card.scrollIntoView({ block: 'start' }));
  await capture(page, 'gazette-390.png');
  await button(page, 'Show all action records').tap();
  await expect(button(page, 'Show highlights')).toBeVisible();

  const sourceCard = story(page).filter({ has: page.getByRole('button', { name: /Version 1 · Operative/ }) }).first();
  await sourceCard.getByText(/evidence · \d+ witnesses|circumstances · \d+ witnesses/).tap();
  const sourceId = await sourceCard.locator('.story-links code').first().textContent();
  await button(sourceCard, 'View evidence').tap();
  await expect(heading(page, 'Royal Inquiry')).toBeFocused();
  await expect(page.locator('.page-header code')).toHaveText(sourceId);
  await expect(page.getByText('Evidence unavailable for this record.')).toHaveCount(0);
  await button(page, 'Back').tap();
  await sourceCard.getByRole('button', { name: /Version 1 · Operative/ }).tap();
  await expect(heading(page, 'Decree 1 · Version 1')).toBeVisible();
  await expect(page.getByText('Farmers must not harvest food.', { exact: true })).toBeVisible();

  await button(page, 'Decree Book').tap();
  await button(page, 'Abolish').tap();
  await button(page, 'Confirm abolition').tap();
  await advance(page, 2);
  await button(page, 'Chronicle').tap();
  await page.getByRole('combobox', { name: 'Chronicle day' }).selectOption('1');
  await expect(story(page).first()).toHaveAttribute('data-incident-id', leadingId);
  await expect(story(page).filter({ has: page.getByRole('button', { name: /Version 1 · Historical/ }) }).first()).toBeVisible();
  await page.getByRole('combobox', { name: 'Topic' }).selectOption('EDUCATION');
  await page.getByRole('combobox', { name: 'Adviser' }).selectOption('noah');
  await expect(page.getByText('No selected stories match these filters.')).toBeVisible();

  await page.getByRole('combobox', { name: 'Topic' }).selectOption('');
  await page.getByRole('combobox', { name: 'Adviser' }).selectOption('');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const overflowingLabels = await page.locator('.chronicle-filters select').evaluateAll((selects) => selects.flatMap((select) => {
    const context = document.createElement('canvas').getContext('2d');
    const style = getComputedStyle(select);
    context.font = style.font;
    const available = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 16;
    return [...select.options].map((option) => option.textContent).filter((label) => context.measureText(label).width > available);
  }));
  expect(overflowingLabels).toEqual([]);
  expect((await button(story(page).first(), 'Open share card').boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('navigation', { name: 'Village navigation' })).toMatchAriaSnapshot(`
    - navigation "Village navigation":
      - button "Village"
      - button "Decree Book"
      - button "Gazette"
      - button "Chronicle"
  `);
  await expect(button(page, 'Chronicle')).toHaveAttribute('aria-current', 'page');
  await heading(page, 'Royal Chronicle').evaluate((title) => title.scrollIntoView({ block: 'start' }));
  await capture(page, 'chronicle-320-200-percent.png');
  await story(page).first().evaluate((card) => card.scrollIntoView({ block: 'start' }));
  await capture(page, 'chronicle-story-320-200-percent.png');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toHaveCount(1);
});

test('local share PNG matches the selectable evidence text and handles unavailable download', async ({ page }) => {
  const remote = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') remote.push(request.url());
  });
  await page.addInitScript(() => {
    window.pngRows = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      window.pngRows.push(text);
      return fill.call(this, text, ...rest);
    };
  });
  await startVillage(page, 'junior', 'sandbox');
  await advance(page, 1);
  const before = await readGeneration(page);
  await button(story(page), 'Open share card').tap();
  await expect(heading(page, 'Share card')).toBeFocused();
  await expect(heading(page, 'VILLAGE REPORT')).toBeVisible();
  await expect(page.getByText('No decree directly linked.', { exact: true })).toBeVisible();
  await page.getByText('Selectable card text').tap();
  const text = await page.getByRole('textbox', { name: 'Card text' }).inputValue();
  await capture(page, 'share-preview-390.png');

  const downloading = page.waitForEvent('download');
  await button(page, 'Download PNG').tap();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('rulecraft-village-day-1.png');
  expect(await download.failure()).toBeNull();
  const bytes = await readFile(await download.path());
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 1350]);
  expect(await page.evaluate(() => window.pngRows.join(' '))).toBe(text.replace(/\s+/g, ' '));
  expect(text).not.toContain(before.id);
  expect(bytes.includes(Buffer.from(before.id))).toBe(false);
  const pixels = await page.evaluate(async (encoded) => {
    const png = await (await fetch(`data:image/png;base64,${encoded}`)).blob();
    const image = await createImageBitmap(png);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return [10, 196].map((y) => [...context.getImageData(10, y, 1, 1).data]);
  }, bytes.toString('base64'));
  expect(pixels).toEqual([[132, 46, 37, 255], [246, 239, 223, 255]]);
  await expect(page.getByText(/PNG download requested/)).toBeVisible();
  if (screenshots) await download.saveAs(join(screenshots, 'example-day-1.png'));

  const measurement = await page.evaluate(() => {
    const entry = performance.getEntriesByName('rulecraft.share.png').at(-1);
    return { ms: entry.duration, ...entry.detail };
  });
  expect(measurement.bytes).toBe(bytes.length);
  console.log('Measured local PNG', JSON.stringify(measurement));

  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = undefined; });
  await button(page, 'Download PNG').tap();
  await expect(page.getByText(/The PNG could not be prepared/)).toBeVisible();
  await page.evaluate(() => { delete HTMLAnchorElement.prototype.download; });
  await button(page, 'Download PNG').tap();
  await expect(page.getByText(/does not offer local PNG downloads/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Card text' })).toHaveValue(text);
  expect(await readGeneration(page)).toEqual(before);
  expect(remote).toEqual([]);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect((await button(page, 'Download PNG').boundingBox()).height).toBeGreaterThanOrEqual(44);
});

test('a competing-duties card downloads with both evidenced decrees and exposes all text when PNG overflows', async ({ page }) => {
  // Keep the browser save a genuine Task 04-compatible legacy preview: the
  // research helper's 100% news setting is intentionally NOT a valid legacy
  // configuration. Find a natural competing-duty witness under real defaults.
  let dayOne;
  for (let seed = 0; seed < 256 && !dayOne; seed++) {
    const candidate = completedCompetingDutiesDay(societyDefaults.bulletinBp, seed);
    if (projectNarrative(candidate, 'full').incidents.some(({ turn, facts }) =>
      turn === 1 && facts.family === 'COMPETING_KNOWN_DUTIES')) dayOne = candidate;
  }
  expect(dayOne, 'Expected a natural competing-duty witness with historical settings').toBeDefined();
  const game = advanceSociety(confirmLaw(dayOne, {
    operation: 'ABOLISH', lawId: 'harvest-food', commandId: 'abolish-harvest',
  }).game);
  await page.addInitScript(() => {
    window.pngRows = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
      const bounds = this.measureText(text);
      window.pngRows.push({
        text, left: x - bounds.actualBoundingBoxLeft, right: x + bounds.actualBoundingBoxRight,
        top: y - bounds.actualBoundingBoxAscent, bottom: y + bounds.actualBoundingBoxDescent,
      });
      return fill.call(this, text, x, y);
    };
  });
  await startVillage(page, 'full', 'sandbox');
  await page.evaluate((payload) => new Promise((resolve, reject) => {
    const open = indexedDB.open('rulecraft-village', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('world', 'readwrite');
      tx.objectStore('world').put({
        revision: 1, previous: null, current: { id: 'test-village', at: 1, mode: 'full', track: 'sandbox', payload },
      }, 'village');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), encodeSociety(game));
  await page.reload();
  await button(page, 'Resume village').tap();
  await button(page, 'Chronicle').tap();
  await page.getByRole('combobox', { name: 'Chronicle day' }).selectOption('1');
  await page.getByRole('combobox', { name: 'Topic' }).selectOption('COMPETING_KNOWN_DUTIES');
  await button(story(page), 'Open share card').tap();

  const panel = heading(page, 'LINKED DECREES').locator('..');
  const decrees = [
    'Decree 1 · Version 1 (historic). Farmers must harvest food. Status on day 1 was active.',
    'Decree 2 · Version 1 (operative). Farmers must rest. Status on day 1 was active.',
  ];
  await expect(panel.locator('p')).toHaveText(decrees);
  await page.getByText('Selectable card text').tap();
  const fallback = page.getByRole('textbox', { name: 'Card text' });
  const text = await fallback.inputValue();
  expect(text.split('\n').slice(1, 4)).toEqual(['LINKED DECREES', ...decrees]);

  const downloading = page.waitForEvent('download');
  await button(page, 'Download PNG').tap();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  const bytes = await readFile(await download.path());
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 1350]);
  const rows = await page.evaluate(() => window.pngRows);
  expect(rows.map(({ text }) => text).join(' ')).toBe(text.replace(/\s+/g, ' '));
  expect(rows.every(({ left, right, top, bottom }) => left >= 0 && right <= 1080 && top >= 0 && bottom <= 1350)).toBe(true);
  if (screenshots) {
    await mkdir(screenshots, { recursive: true });
    await download.saveAs(join(screenshots, 'example-competing-duties.png'));
  }

  await page.getByText('Selectable card text').tap();
  await expect(fallback).toBeHidden();
  await page.evaluate(() => {
    CanvasRenderingContext2D.prototype.measureText = () => ({ width: 2000 });
  });
  await button(page, 'Download PNG').tap();
  await expect(page.getByRole('status')).toHaveText('This card is too long for a single PNG. The complete card text is below.');
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveValue(text);
  expect(await page.evaluate(() => window.pngRows)).toEqual(rows);
});
