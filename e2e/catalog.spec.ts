import { test, expect } from '@playwright/test';

const cards = (page: import('@playwright/test').Page) => page.locator('button[aria-label^="Open "]');

test('renders the six seed agents without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(cards(page)).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('search and chip filters narrow the grid, reset restores it', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search agents').fill('SQL');
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText('pg-query-optimizer');
  await page.getByLabel('Search agents').fill('');
  await page.getByRole('button', { name: 'AAA', exact: true }).click();
  await expect(cards(page)).toHaveCount(3);
  await page.getByRole('button', { name: /reset filters/ }).first().click();
  await expect(cards(page)).toHaveCount(6);
});

test('deep link opens the drawer, unknown name shows 404 banner', async ({ page }) => {
  await page.goto('/agents/eu-ai-act-auditor');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'eu-ai-act-auditor' })).toBeVisible();
  await expect(page).toHaveTitle(/eu-ai-act-auditor/);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL('/');

  await page.goto('/agents/does-not-exist');
  await expect(page.getByRole('alert')).toContainText('404');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('card click pushes history and back button closes the drawer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open pg-query-optimizer' }).click();
  await expect(page).toHaveURL('/agents/pg-query-optimizer');
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL('/');
});

test('registry endpoints serve JSON consistent with the catalog', async ({ request }) => {
  const idx = await request.get('/api/agents.json');
  expect(idx.ok()).toBeTruthy();
  const body = (await idx.json()) as { count: number; agents: { name: string; agentCard: string }[] };
  expect(body.count).toBe(6);
  const card = await request.get('/agents/pg-query-optimizer/agent.json');
  expect(card.ok()).toBeTruthy();
  expect((await card.json()).name).toBe('pg-query-optimizer');
  const sitemap = await request.get('/sitemap.xml');
  expect(await sitemap.text()).toContain('/agents/pg-query-optimizer');
});

test('agent pages are pre-rendered with per-agent open graph tags', async ({ request }) => {
  const res = await request.get('/agents/pg-query-optimizer', { headers: { accept: 'text/html' } });
  expect(res.ok()).toBeTruthy();
  const html = await res.text();
  expect(html).toContain('<title>pg-query-optimizer · agenthive.sh</title>');
  expect(html).toContain('content="https://agenthive.sh/agents/pg-query-optimizer"');
  expect(html).toContain('"@type":"SoftwareApplication"');
  const home = await (await request.get('/')).text();
  expect(home).toContain('<title>agenthive.sh — The registry for interoperable AI agents</title>');
});
