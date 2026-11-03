import { test, expect } from '@playwright/test';

const cards = (page: import('@playwright/test').Page) => page.locator('button[aria-label^="Open "]');

/** The packages under agents/, published at boot on the in-memory database. */
const AGENTS = ['access-control-auditor', 'api-surface-reviewer', 'dependency-risk-triage', 'secret-exposure-hunter', 'vibe-app-security-triage'];

test('renders the repository agents without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  for (const name of AGENTS) await expect(page.getByRole('button', { name: `Open ${name}` })).toBeVisible();
  expect(errors).toEqual([]);
});

test('search and chip filters narrow the grid, reset restores it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open secret-exposure-hunter' })).toBeVisible();
  const total = await cards(page).count();
  await page.getByLabel('Search agents').fill('secret-exposure');
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText('secret-exposure-hunter');
  await page.getByLabel('Search agents').fill('');
  // other specs publish packages on the same server, so the count is a floor
  await page.getByRole('button', { name: 'Declarative', exact: true }).click();
  expect(await cards(page).count()).toBeGreaterThanOrEqual(AGENTS.length);
  await page.getByLabel('Search agents').fill('no-such-agent-anywhere');
  await expect(cards(page)).toHaveCount(0);
  await page.getByRole('button', { name: /reset filters/ }).first().click();
  await expect(cards(page)).toHaveCount(total);
});

test('deep link opens the drawer, unknown name shows 404 banner', async ({ page }) => {
  await page.goto('/agents/access-control-auditor');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'access-control-auditor' })).toBeVisible();
  await expect(page).toHaveTitle(/access-control-auditor/);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL('/');

  await page.goto('/agents/does-not-exist');
  await expect(page.getByRole('alert')).toContainText('404');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('card click pushes history and back button closes the drawer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open secret-exposure-hunter' }).click();
  await expect(page).toHaveURL('/agents/secret-exposure-hunter');
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL('/');
});

test('registry endpoints serve JSON consistent with the catalog', async ({ request }) => {
  const idx = await request.get('/api/agents.json');
  expect(idx.ok()).toBeTruthy();
  const body = (await idx.json()) as { apiVersion: string; count: number; agents: { name: string; agentCard: string }[] };
  expect(body.apiVersion).toBe('agenthive.sh/v1');
  expect(body.count).toBeGreaterThanOrEqual(AGENTS.length);
  expect(body.agents.map((a) => a.name)).toEqual(expect.arrayContaining(AGENTS));
  const card = await request.get('/agents/secret-exposure-hunter/agent.json');
  expect(card.ok()).toBeTruthy();
  expect((await card.json()).name).toBe('secret-exposure-hunter');
  const yaml = await (await request.get('/agents/secret-exposure-hunter/agent.yaml')).text();
  expect(yaml).toContain('apiVersion: agenthive.sh/v2');
  const sitemap = await request.get('/sitemap.xml');
  expect(await sitemap.text()).toContain('/agents/secret-exposure-hunter');
});

test('agent pages are pre-rendered with per-agent open graph tags', async ({ request }) => {
  const res = await request.get('/agents/secret-exposure-hunter', { headers: { accept: 'text/html' } });
  expect(res.ok()).toBeTruthy();
  const html = await res.text();
  expect(html).toContain('<title>secret-exposure-hunter · agenthive.sh</title>');
  expect(html).toMatch(/content="https?:\/\/[^"]+\/agents\/secret-exposure-hunter"/);
  expect(html).toContain('"@type":"SoftwareApplication"');
  const home = await (await request.get('/', { headers: { accept: 'text/html' } })).text();
  expect(home).toContain('<title>agenthive.sh — The proving ground for AI agents</title>');
  // readers without JavaScript get the catalog as plain links
  expect(home).toContain('href="/agents/secret-exposure-hunter"');
  const board = await (await request.get('/leaderboard', { headers: { accept: 'text/html' } })).text();
  expect(board).toContain('id="ssr"');
});

test('the app replaces the static snapshot once it boots', async ({ page }) => {
  await page.goto('/agents/secret-exposure-hunter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#ssr')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Find the agent that actually does the job.' })).toHaveCount(1);
});
