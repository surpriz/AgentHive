import { expect, test } from '@playwright/test';

test('trial page renders, with the methodology link and either rows or the empty state', async ({ page }) => {
  await page.goto('/trials/code-audit');
  await expect(page.getByRole('heading', { name: /Code audit of vibe-coded apps/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /how scores are computed/ })).toHaveAttribute('href', '#methodology');
  await expect(page.getByRole('link', { name: /full protocol on GitHub/ })).toHaveAttribute('href', /trials\/code-audit\/README\.md/);
  await expect(page.getByTestId('trial-methodology')).toBeVisible();
  const rows = page.getByTestId('trial-row');
  if ((await rows.count()) === 0) await expect(page.getByTestId('trial-empty')).toBeVisible();
});

test('a package card has a Trial tab with its recorded runs or an empty state', async ({ page }) => {
  await page.goto('/agents/vibe-app-security-triage');
  await page.getByRole('tab', { name: /Trial/ }).click();
  const rows = page.getByTestId('trial-run-row');
  if ((await rows.count()) === 0) await expect(page.getByTestId('trial-tab-empty')).toBeVisible();
  else await expect(page.getByTestId('trial-tab')).toBeVisible();
});

test('the navbar reaches the trial and the trial page is served with a snapshot', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Trial/ }).click();
  await expect(page).toHaveURL(/\/trials\/code-audit$/);
  const html = await (await request.get('/trials/code-audit', { headers: { accept: 'text/html' } })).text();
  expect(html).toContain('id="ssr"');
});
