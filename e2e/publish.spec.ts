import { test, expect } from '@playwright/test';

test('publish validates, simulates the push, adds the agent and persists it across reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Push/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Push' }).click();
  await expect(dialog.getByText('Required')).toBeVisible();

  await dialog.getByPlaceholder('my-sql-agent').fill('redis-cache-advisor');
  await dialog.getByPlaceholder('One line: what it does, for whom').fill('Finds hot keys and proposes eviction policies for Redis clusters.');
  await dialog.getByPlaceholder('You are an agent that…').fill('You are an agent that audits Redis usage patterns.');
  await dialog.getByRole('button', { name: 'Push' }).click();
  await expect(dialog.getByText(/pushed → agenthive.sh\/you\/redis-cache-advisor/)).toBeVisible({ timeout: 20_000 });
  await dialog.locator('button', { hasText: 'Close' }).click();

  const cards = page.locator('button[aria-label^="Open "]');
  await expect(cards).toHaveCount(7);
  await expect(cards.first()).toContainText('redis-cache-advisor');

  await page.reload();
  await expect(cards).toHaveCount(7);
  await page.goto('/agents/redis-cache-advisor');
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'redis-cache-advisor' })).toBeVisible();
});

test('rejects invalid manifest JSON inline', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Push/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('textarea').first().fill('{ not json');
  await dialog.getByRole('button', { name: 'Push' }).click();
  await expect(dialog.getByText(/Unexpected|JSON|token/i).first()).toBeVisible();
});
