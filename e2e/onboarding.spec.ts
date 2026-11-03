import { test, expect } from '@playwright/test';

test('how it works opens from the navbar and lists the four steps', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /How it works|Help/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'How AgentHive works' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('1. Find an agent by goal')).toBeVisible();
  await expect(dialog.getByText('3. Get it into your tool')).toBeVisible();
  await expect(dialog.getByText('Illustrative:')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('cards show a plain-language value line above the technical tagline', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('button', { name: 'Open pg-query-optimizer' });
  await expect(card).toContainText('Makes a slow Postgres query fast');
  await expect(card).toContainText('Reads EXPLAIN ANALYZE output');
});

test('sandbox is labelled simulated and try example runs without typing', async ({ page }) => {
  await page.goto('/agents/smart-contract-sentinel');
  await page.getByRole('tab', { name: /Sandbox/ }).click();
  await expect(page.getByText('Simulated run.')).toBeVisible();
  await page.getByRole('button', { name: 'try example' }).click();
  await expect(page.getByLabel('Test prompt')).toHaveValue(/ethereum mainnet/);
  await expect(page.getByRole('button', { name: 'try example' })).toHaveCount(0);
  await expect(page.getByText('Final Result')).toBeVisible({ timeout: 20_000 });
});
