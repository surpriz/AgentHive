import { test, expect } from '@playwright/test';

test('manifest tab shows yaml, agent card and install snippets', async ({ page }) => {
  await page.goto('/agents/pg-query-optimizer');
  await page.getByRole('tab', { name: /Manifest/ }).click();
  await expect(page.getByRole('tab', { name: /Manifest/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('apiVersion: agenthive.sh/v0')).toBeVisible();
  await expect(page.locator('pre', { hasText: 'agent-cli add pg-query-optimizer' }).first()).toBeVisible();
  await expect(page.locator('pre', { hasText: '"mcpServers"' })).toBeVisible();
});

test('sandbox runs the scripted chain to a final result and accrues tokens', async ({ page }) => {
  await page.goto('/agents/pg-query-optimizer');
  await page.getByRole('tab', { name: /Sandbox/ }).click();
  await page.getByLabel('Test prompt').fill('orders join customers is slow');
  await page.getByRole('button', { name: 'Execute Agent' }).click();
  await expect(page.getByRole('button', { name: 'Execute Agent' })).toBeDisabled();
  await expect(page.getByText('Final Result')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('orders join customers is slow').nth(1)).toBeVisible();
  await expect(page.getByText('done', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Execute Agent' })).toBeEnabled();
  const tokens = await page.locator('text=tokens').locator('..').innerText();
  expect(Number(tokens.replace(/\D/g, ''))).toBeGreaterThan(500);
});
