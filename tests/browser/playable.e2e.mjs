import { expect, test } from '@playwright/test';

export async function startVillage(page, mode = 'junior', track = 'campaign') {
  await page.goto('/');
  await page.getByLabel('Complexity').selectOption(mode);
  await page.getByLabel('Play option').selectOption(track);
  await page.getByRole('button', { name: 'Start village', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Village', exact: true })).toBeVisible();
}

async function wording(page, target = 'farmer', rule = 'MUST', action = 'harvest-food') {
  await page.getByRole('combobox', { name: 'Who', exact: true }).selectOption(target);
  await page.getByRole('combobox', { name: 'Rule', exact: true }).selectOption(rule);
  await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption(action);
}

test('a confirmed decree survives reload before advancing and never commits an abandoned draft', async ({ page }) => {
  await startVillage(page);
  await page.getByRole('button', { name: 'Decree Book', exact: true }).click();
  await page.getByRole('button', { name: 'Compose decree' }).click();
  await wording(page);
  await expect(page.getByText('Draft saved separately on this device.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Resume village' }).click();
  await page.getByRole('button', { name: 'Decree Book', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No decrees yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume draft' }).click();
  await expect(page.getByText('Farmers must harvest food.').filter({ visible: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review decree' }).click();
  await page.getByRole('button', { name: 'Confirm decree', exact: true }).click();
  await expect(page.getByText('Decree saved. Confirmed for day 1.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Resume village' }).click();
  await expect(page.getByText('Day 0 of 12')).toBeVisible();
  await page.getByRole('button', { name: 'Decree Book', exact: true }).click();
  await expect(page.getByText('Farmers must harvest food.').filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/Confirmed for day 1/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume draft' })).toHaveCount(0);
});
