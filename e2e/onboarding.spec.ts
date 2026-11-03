import { test, expect } from '@playwright/test';

test('how it works opens from the navbar and lists the four steps', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /How it works|Help/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'How AgentHive works' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('1. Find an agent by goal')).toBeVisible();
  await expect(dialog.getByText('3. Get it into your tool')).toBeVisible();
  await expect(dialog.getByText('Not yet:')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('cards show a plain-language value line above the technical tagline', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('button', { name: 'Open secret-exposure-hunter' });
  await expect(card).toContainText('Finds real credentials leaked in your source');
  await expect(card).toContainText('Scans the working tree and git history');
});
