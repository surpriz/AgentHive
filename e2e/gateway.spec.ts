import { test, expect, type Page } from '@playwright/test';

// The upstream is the public echo endpoint of the production registry, so this spec needs network access
// and a deployed /api/v1/echo. Set GATEWAY_E2E=0 to skip it.
test.skip(process.env.GATEWAY_E2E === '0', 'gateway spec disabled');

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Account menu/ })).toBeVisible();
}

test('an agent with a real endpoint runs through the gateway from the Run tab and shows up in the dashboard', async ({ page }) => {
  await signIn(page);
  const name = `echo-probe-${Date.now().toString(36)}`;
  const res = await page.request.post('/api/v1/agents', {
    headers: { 'content-type': 'application/json', origin: new URL(page.url()).origin },
    data: {
      apiVersion: 'agenthive.sh/v1',
      metadata: { name, version: '0.1.0', category: 'DevOps', value: 'Echoes whatever it receives, to try the gateway.', tagline: 'Points at the public echo endpoint of the registry.' },
      spec: {
        framework: 'Custom A2A',
        transport: 'a2a/http+json',
        endpoint: 'https://agenthive.sh/api/v1/echo',
        permissions: { network: ['agenthive.sh'], filesystem: 'none', shell: false, env: [] },
        tests: [
          { name: 'echoes the task', input: { task: 'bench' }, expect: { contains: '"task":"bench"', jsonPath: { path: 'echo.task', equals: 'bench' } } },
          { name: 'wrong on purpose', input: { task: 'x' }, expect: { contains: 'never-there' } },
        ],
      },
    },
  });
  expect(res.status()).toBe(201);

  await page.goto(`/agents/${name}`);
  await page.getByRole('tab', { name: 'Run' }).click();
  await expect(page.getByText('Real run.')).toBeVisible();
  await page.getByLabel('JSON input').fill('{"task": "ping", "n": 3}');
  await page.getByRole('button', { name: 'Run agent' }).click();
  const status = page.getByRole('status');
  await expect(status).toContainText('upstream 200', { timeout: 30_000 });
  await expect(status).toContainText('"task": "ping"');
  // The echo lives on production and cannot know this local agent's secret, so it reports null here;
  // signature verification itself is covered by the server tests.
  await expect(status).toContainText('"caller": "testuser"');
  await expect(status).toContainText('"signatureValid"');

  // The publish queued a benchmark against the echo: 2 probes + 2 cases + latency, one case fails on purpose.
  await expect
    .poll(async () => ((await (await page.request.get(`/agents/${name}/benchmark.json`)).json()) as { benchmark: { passed?: number; total?: number } | null }).benchmark?.total ?? 0, { timeout: 30_000 })
    .toBe(5);
  await page.goto(`/agents/${name}`);
  const bench = page.getByTestId('benchmark-section');
  await expect(bench).toContainText('4/5 passed');
  await expect(bench).toContainText('wrong on purpose');

  await page.goto('/dashboard');
  await page.getByRole('button', { name: `Runs and gateway secret for ${name}` }).click();
  const ops = page.getByTestId(`ops-${name}`);
  await expect(ops).toContainText(/recent runs · \d+/);
  await expect(ops).toContainText('ok');
  await ops.getByRole('button', { name: 'reveal' }).click();
  await expect(ops.locator('code')).toContainText('ahgw_');
});

test('an async run returns a ticket and the Run tab polls it to completion', async ({ page }) => {
  await signIn(page);
  const name = `async-probe-${Date.now().toString(36)}`;
  const res = await page.request.post('/api/v1/agents', {
    headers: { 'content-type': 'application/json', origin: new URL(page.url()).origin },
    data: { apiVersion: 'agenthive.sh/v1', metadata: { name, version: '0.1.0', category: 'DevOps', value: 'Echoes whatever it receives, asynchronously this time.', tagline: 'Points at the public echo endpoint of the registry.' }, spec: { framework: 'Custom A2A', transport: 'a2a/http+json', endpoint: 'https://agenthive.sh/api/v1/echo' } },
  });
  expect(res.status()).toBe(201);
  await page.goto(`/agents/${name}`);
  await page.getByRole('tab', { name: 'Run' }).click();
  await page.getByRole('checkbox', { name: /async/ }).check();
  await page.getByLabel('JSON input').fill('{"task": "later"}');
  await page.getByRole('button', { name: 'Run agent' }).click();
  const ticket = page.getByTestId('async-run');
  await expect(ticket).toContainText(/run [0-9a-f-]{36}/);
  await expect(ticket).toContainText('ok', { timeout: 60_000 });
  await expect(ticket).toContainText('"task": "later"');
  const runId = (await ticket.innerText()).match(/run ([0-9a-f-]{36})/)![1];
  const view = (await (await page.request.get(`/api/v1/runs/${runId}`)).json()) as { status: string; mode: string };
  expect(view).toMatchObject({ status: 'ok', mode: 'async' });
  await page.goto('/dashboard');
  const ws = page.getByTestId('webhook-secret');
  await ws.getByRole('button', { name: 'reveal' }).click();
  await expect(ws.locator('code')).toContainText('ahwh_');
});

test('seeds and endpoint-less agents have no Run tab', async ({ page }) => {
  await page.goto('/agents/pg-query-optimizer');
  await expect(page.getByRole('tab', { name: 'Run' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Sandbox/ })).toBeVisible();
});
