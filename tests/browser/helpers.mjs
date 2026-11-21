import { expect } from '@playwright/test';

export async function startVillage(page, mode = 'junior', track = 'campaign') {
  await page.goto('/');
  await page.getByLabel('Complexity').selectOption(mode);
  await page.getByLabel('Play option').selectOption(track);
  await page.getByRole('button', { name: 'Start village', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Village', exact: true })).toBeVisible();
}
