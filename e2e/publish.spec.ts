import { test, expect, type Page } from '@playwright/test';

/** The dev server runs on an in-memory database with a password test user; "Sign in" uses it when GitHub is not configured. */
async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Account menu/ })).toBeVisible();
}

test('publish asks to sign in first', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Push/ }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Sign in to publish' })).toBeVisible();
});

test('publish validates inline, grades the agent and serves it everywhere', async ({ page, request }) => {
  await signIn(page);
  const name = `redis-cache-advisor-${Date.now().toString(36)}`;
  await page.getByRole('button', { name: /Push/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Publish' }).click();
  await expect(dialog.getByText('Required')).toBeVisible();

  await dialog.getByPlaceholder('my-sql-agent', { exact: true }).fill(name);
  await dialog.getByPlaceholder(/Makes a slow Postgres query fast/).fill('Finds hot keys and proposes eviction policies for Redis clusters.');
  await dialog.getByPlaceholder(/Reads EXPLAIN ANALYZE output/).fill('Samples keyspace statistics and rewrites TTL and maxmemory policies.');
  await dialog.getByPlaceholder('Postgres, EXPLAIN Analyzer').fill('Redis, INFO parser');
  await dialog.getByRole('button', { name: 'Publish' }).click();
  await expect(dialog.getByText(`published ${name}@0.1.0`)).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole('button', { name: 'Open it' }).click();

  const card = page.getByRole('button', { name: `Open ${name}` });
  await expect(card).toBeVisible();
  await expect(card).toContainText('A');
  await expect(card).toContainText('—'); // no benchmark numbers yet

  const idx = (await (await request.get('/api/agents.json')).json()) as { agents: { name: string; grade: string; successRate: number | null }[] };
  const entry = idx.agents.find((a) => a.name === name);
  expect(entry?.grade).toBe('A');
  expect(entry?.successRate).toBeNull();
  expect((await request.get(`/agents/${name}/agent.yaml`)).ok()).toBeTruthy();
  const html = await (await request.get(`/agents/${name}`, { headers: { accept: 'text/html' } })).text();
  expect(html).toContain(`<title>${name} · agenthive.sh</title>`);
});

test('dashboard lists my agents and manages api keys that work with the cli endpoints', async ({ page, request }) => {
  await signIn(page);
  await page.getByRole('button', { name: /Account menu/ }).click();
  await page.getByRole('menuitem', { name: 'Dashboard' }).click();
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: '@testuser' })).toBeVisible();

  const keyName = `laptop-${Date.now().toString(36)}`;
  await page.getByLabel('New key name').fill(keyName);
  await page.getByRole('button', { name: 'create key' }).click();
  const status = page.getByRole('status');
  await expect(status).toContainText(`new key “${keyName}”`);
  const key = (await status.locator('code').first().innerText()).trim();
  expect(key.startsWith('ah_')).toBeTruthy();

  const me = await request.get('/api/v1/me', { headers: { authorization: `Bearer ${key}` } });
  expect(me.ok()).toBeTruthy();
  expect(((await me.json()) as { via: string }).via).toBe('api-key');

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: `Revoke ${keyName}` }).click();
  await expect(page.getByText(keyName, { exact: true })).toHaveCount(0);
  expect((await request.get('/api/v1/me', { headers: { authorization: `Bearer ${key}` } })).status()).toBe(401);
});

test('cli-style publish over an api key is rejected without one and accepted with one', async ({ request }) => {
  const yaml = `apiVersion: agenthive.sh/v1
kind: Agent
metadata:
  name: cli-pushed-${Date.now().toString(36)}
  version: 1.0.0
  category: Finance
  value: Reconciles invoices against bank statements and flags the gaps.
  tagline: Matches ledger entries to bank lines with fuzzy amounts and dates.
spec:
  framework: CrewAI
`;
  const anon = await request.post('/api/v1/agents', { headers: { 'content-type': 'application/yaml' }, data: yaml });
  expect(anon.status()).toBe(401);
});
