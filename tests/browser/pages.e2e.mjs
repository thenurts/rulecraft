import { expect, test } from '@playwright/test';
import { startVillage } from './helpers.mjs';

test('the Pages subpath serves the app, styles and save worker and resumes a seeded standard Sandbox', async ({ page, baseURL, request }) => {
  const allowed = new URL(baseURL);
  const responses = [];
  const failed = [];
  const errors = [];
  page.on('response', (response) => responses.push(response));
  page.on('requestfailed', (request) => failed.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  const worker = page.waitForEvent('worker', (worker) => /\/assets\/save-worker-.*\.js$/.test(worker.url()));

  await startVillage(page, 'full', 'sandbox', 42);
  expect(new URL((await worker).url()).pathname).toMatch(/^\/rulecraft\/assets\/save-worker-.*\.js$/);
  await expect(page).toHaveURL(baseURL);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
  await expect(page.getByText(/Scenario v1 · Profile v1 · Seed 42/)).toBeVisible();

  for (let day = 1; day <= 12; day++) {
    await page.getByRole('button', { name: 'Advance day', exact: true }).click();
    await page.getByRole('button', { name: `Resolve day ${day}`, exact: true }).click();
    await expect(page.getByRole('heading', { name: `Day ${day} results` })).toBeVisible();
    await page.getByRole('navigation').getByRole('button', { name: 'Village', exact: true }).click();
  }

  await page.reload();
  await page.getByRole('button', { name: 'Resume village', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Experiment complete' })).toBeVisible();
  await expect(page).toHaveURL(baseURL);

  for (const [name, type] of [[/index-.*\.js$/, /javascript/], [/index-.*\.css$/, /text\/css/], [/save-worker-.*\.js$/, /javascript/]]) {
    const asset = responses.find((response) => name.test(new URL(response.url()).pathname));
    expect(asset, `Missing built asset ${name}`).toBeDefined();
    const url = new URL(asset.url());
    expect(url.origin).toBe(allowed.origin);
    expect(url.pathname).toMatch(/^\/rulecraft\/assets\//);
    expect(asset.status()).toBe(200);
    expect(asset.headers()['content-type']).toMatch(type);
  }
  for (const source of ['src/main.tsx', 'package.json', 'assets/index.js.map']) {
    // Vite preview can return the app shell for HTML navigation to a missing route.
    const response = await request.get(new URL(source, baseURL).href, { headers: { accept: 'application/octet-stream' } });
    expect(response.status(), `Unexpectedly served ${source}`).toBe(404);
  }
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});
