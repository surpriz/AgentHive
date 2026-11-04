import { test, expect } from '@playwright/test';

test('anyone can report an agent from its card', async ({ page }) => {
  await page.goto('/agents/vibe-app-security-triage');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Report this agent' }).click();
  const form = page.getByTestId('report-form');
  await form.getByLabel('Report as').selectOption('rights');
  await form.getByLabel('Report details').fill('The prompt copies a paragraph from a licensed book without credit.');
  await form.getByRole('button', { name: 'send report' }).click();
  await expect(page.getByTestId('report-sent')).toBeVisible();
});

test('an unknown name still answers 404, not a tombstone', async ({ request }) => {
  const res = await request.get('/agents/no-such-agent-ever/package.json');
  expect(res.status()).toBe(404);
});
