import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { startVillage } from './helpers.mjs';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });

async function capture(page, name) {
  const directory = process.env.RULECRAFT_SCREENSHOTS;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true, animations: 'disabled' });
}

async function layout(page) {
  const result = await page.evaluate(() => {
    const common = [...document.querySelectorAll('button, select, summary, input')].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return {
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      minTargetHeight: Math.min(...common.map((element) => element.getBoundingClientRect().height)),
      minTargetWidth: Math.min(...common.map((element) => element.getBoundingClientRect().width)),
    };
  });
  expect(result.scroll).toBeLessThanOrEqual(result.width);
  expect(result.minTargetHeight).toBeGreaterThanOrEqual(44);
  expect(result.minTargetWidth).toBeGreaterThanOrEqual(44);
}

test('composer fits narrow portrait, tablet and landscape and remains usable with enlarged text', async ({ page }) => {
  await startVillage(page, 'full', 'campaign');
  await capture(page, 'village-390');
  await page.getByRole('button', { name: 'Decree Book', exact: true }).tap();
  await page.getByRole('button', { name: 'Compose decree' }).tap();
  await page.getByRole('combobox', { name: 'Who', exact: true }).selectOption('farmer');
  await page.getByRole('combobox', { name: 'Rule', exact: true }).selectOption('MUST_NOT');
  await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption('harvest-food');
  await page.getByRole('combobox', { name: 'When condition' }).selectOption('slot');
  await page.getByRole('combobox', { name: 'When comparison' }).selectOption('EQ');
  await page.getByRole('combobox', { name: 'When time' }).selectOption('morning');
  await capture(page, 'composer-390');
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "Compose decree" [level=1]
    - group "Decree wording":
      - combobox "Who"
      - combobox "Rule"
      - combobox "Action"
    `);
  for (const [width, height] of [[320, 640], [390, 844], [768, 900], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await layout(page);
  }
  await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await layout(page);
  await capture(page, 'composer-320-enlarged');
  const review = page.getByRole('button', { name: 'Review decree' });
  await review.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(review).toBeFocused();
  expect(await review.evaluate((button) => getComputedStyle(button).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: 'Final decree confirmation' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm decree', exact: true }).tap();
  await expect(page.getByText(/Decree saved/)).toBeVisible();
});

test('touch scrolling and actual results and Inquiry screens', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Start village', exact: true })).toBeEnabled();
  await capture(page, 'home-390');
  await page.getByRole('button', { name: 'Start village', exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'Village', exact: true })).toBeVisible();
  const cdp = await context.newCDPSession(page);
  await expect(page.getByRole('heading', { name: 'Village', exact: true })).toBeFocused();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 170, y: 680 }] });
  for (const y of [640, 575, 510, 440, 360, 280]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 170, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(60);
  await page.getByRole('button', { name: 'Decree Book', exact: true }).tap();
  await page.getByRole('button', { name: 'Compose decree' }).tap();
  await page.getByRole('combobox', { name: 'Who', exact: true }).selectOption('farmer');
  await page.getByRole('combobox', { name: 'Rule', exact: true }).selectOption('MUST_NOT');
  await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption('harvest-food');
  await page.getByRole('button', { name: 'Review decree' }).tap();
  await page.getByRole('button', { name: 'Confirm decree', exact: true }).tap();
  await expect(page.getByText('Decree saved. Confirmed for day 1.')).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Village' }).tap();
  await page.getByRole('button', { name: 'Advance day', exact: true }).tap();
  await page.getByRole('button', { name: 'Resolve day 1', exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'Day 1 results' })).toBeVisible();
  await capture(page, 'results-390');
  await page.getByRole('button', { name: /Citizen \d+ · harvest food/ }).first().tap();
  await expect(page.getByRole('heading', { name: 'Royal Inquiry' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Actual ruling' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Perceived ruling' }).first()).toBeVisible();
  await capture(page, 'inquiry-390');
});
