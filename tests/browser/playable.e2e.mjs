import { expect, test } from '@playwright/test';

import { startVillage } from './helpers.mjs';

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

test('advance saves one day before displaying actual results and an action ledger', async ({ page }) => {
  await startVillage(page, 'full', 'sandbox');
  await page.getByRole('button', { name: 'Advance day', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel advance' }).click();
  await expect(page.getByText('Day 0 of 12')).toBeVisible();
  await page.getByRole('button', { name: 'Advance day', exact: true }).click();
  await page.getByRole('button', { name: 'Resolve day 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Day 1 results' })).toBeVisible();
  await expect(page.getByText('Day 1 saved on this device.')).toBeVisible();
  await page.getByRole('button', { name: /Citizen \d+ · harvest food/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Royal Inquiry' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Resource ledger' })).toBeVisible();
  await expect(page.getByText(/tx\.1\./)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Resume village' }).click();
  await expect(page.getByText('Day 1 of 12')).toBeVisible();
});

for (const [mode, track, label] of [
  ['junior', 'campaign', 'Junior · The Hungry Village'],
  ['junior', 'sandbox', 'Junior · 12-day Sandbox experiment'],
  ['full', 'campaign', 'Full · The Hungry Village'],
  ['full', 'sandbox', 'Full · 12-day Sandbox experiment'],
]) {
  test(`${label} persists and resumes`, async ({ page }) => {
    await startVillage(page, mode, track);
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Saved on this device · Engine v4')).toBeVisible();
    await page.getByRole('button', { name: 'Resume village' }).click();
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  });
}

async function resolveDay(page, day) {
  await page.getByRole('navigation').getByRole('button', { name: 'Village' }).click();
  await page.getByRole('button', { name: 'Advance day', exact: true }).click();
  await page.getByRole('button', { name: `Resolve day ${day}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: `Day ${day} results`, exact: true })).toBeVisible();
}

test.describe('phone portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });

  test('touch flow covers all five operations, invalid reset, evidence and resume', async ({ page }) => {
    await startVillage(page, 'full');
    await page.getByRole('button', { name: 'Decree Book', exact: true }).tap();
    await page.getByRole('button', { name: 'Compose decree' }).tap();
    await wording(page);
    await page.getByRole('combobox', { name: 'Who', exact: true }).selectOption('guard');
    await expect(page.getByRole('combobox', { name: 'Action', exact: true })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Review decree' })).toBeDisabled();
    await expect(page.getByRole('option', { name: 'export food' })).toHaveCount(0);
    await wording(page, 'farmer', 'MUST_NOT', 'harvest-food');
    await page.getByRole('combobox', { name: 'When condition' }).selectOption('slot');
    await page.getByRole('combobox', { name: 'When comparison' }).selectOption('EQ');
    await page.getByRole('combobox', { name: 'When time' }).selectOption('morning');
    await page.getByRole('button', { name: 'Review decree' }).tap();
    await page.getByRole('button', { name: 'Confirm decree', exact: true }).tap();
    await expect(page.getByText('Decree saved. Confirmed for day 1.')).toBeVisible();
    await resolveDay(page, 1);
    await page.getByRole('button', { name: 'Open Gazette' }).tap();
    await page.getByRole('button', { name: /Citizen \d+ · harvest food/ }).first().tap();
    await expect(page.getByRole('heading', { name: 'Actual and perceived law' })).toBeVisible();
    await expect(page.getByText(/event\.1\./).first()).toBeVisible();

    await page.getByRole('button', { name: 'Decree Book', exact: true }).tap();
    await page.getByRole('button', { name: 'Amend', exact: true }).tap();
    await page.getByRole('combobox', { name: 'When time' }).selectOption('afternoon');
    await page.getByRole('button', { name: 'Review decree' }).tap();
    await page.getByRole('button', { name: 'Confirm amendment' }).tap();
    await expect(page.getByRole('heading', { name: 'Decree 1 · Version 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Suspend', exact: true }).tap();
    await page.getByRole('button', { name: 'Confirm suspension' }).tap();
    await expect(page.getByRole('heading', { name: 'Decree 1 · Version 3' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reinstate' })).toBeDisabled();
    await resolveDay(page, 2);

    await page.getByRole('button', { name: 'Decree Book', exact: true }).tap();
    await page.getByRole('button', { name: 'Reinstate', exact: true }).tap();
    await page.getByRole('button', { name: 'Confirm reinstatement' }).tap();
    await expect(page.getByRole('heading', { name: 'Decree 1 · Version 4' })).toBeVisible();
    await resolveDay(page, 3);
    await page.getByRole('button', { name: 'Decree Book', exact: true }).tap();
    await page.getByRole('button', { name: 'Abolish', exact: true }).tap();
    await expect(page.getByText(/Abolition is permanent/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirm abolition' }).tap();
    await expect(page.getByRole('heading', { name: 'Decree 1 · Version 5' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Resume village' }).tap();
    await expect(page.getByText('Day 3 of 12')).toBeVisible();
    await page.getByRole('button', { name: 'Decree Book', exact: true }).tap();
    await expect(page.getByText(/Confirmed for day 4 · abolished/)).toBeVisible();
    await page.getByText('Version history', { exact: true }).tap();
    await expect(page.getByText('Version 1 · active · Day 1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reinstate', exact: true })).toHaveCount(0);
  });
});
