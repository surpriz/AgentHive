import { test, expect, type Page } from '@playwright/test';

test('leaderboard page renders categories, the illustrative seeds and the formula link', async ({ page }) => {
  await page.goto('/leaderboard');
  await expect(page.getByRole('heading', { name: 'Ranked from measured numbers only.' })).toBeVisible();
  await expect(page.getByText('illustrative seeds · not ranked')).toBeVisible();
  await expect(page.getByText('pg-query-optimizer')).toBeVisible();
  await expect(page.getByRole('link', { name: /how ranks are computed/ })).toHaveAttribute('href', '/docs/leaderboard');
  await page.getByRole('button', { name: 'Marketing' }).click();
  await expect(page.getByText(/Nobody ranked in Marketing yet|board-Marketing/)).toBeVisible();
});

// Needs the production echo as upstream, like the gateway spec.
test.describe('ranked agent', () => {
  test.skip(process.env.GATEWAY_E2E === '0', 'gateway spec disabled');

  async function signIn(page: Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: /Account menu/ })).toBeVisible();
  }

  test('a benchmarked agent appears ranked in its category with a score', async ({ page }) => {
    await signIn(page);
    const name = `ranked-probe-${Date.now().toString(36)}`;
    const res = await page.request.post('/api/v1/agents', {
      headers: { 'content-type': 'application/json', origin: new URL(page.url()).origin },
      data: {
        apiVersion: 'agenthive.sh/v1',
        metadata: { name, version: '0.1.0', category: 'Security & Audit', value: 'Echoes whatever it receives, to appear on the leaderboard.', tagline: 'Points at the public echo endpoint of the registry.' },
        spec: { framework: 'Custom A2A', endpoint: 'https://agenthive.sh/api/v1/echo', permissions: { network: ['agenthive.sh'], filesystem: 'none', shell: false, env: [] }, tests: [{ name: 'echoes', input: { task: 'rank' }, expect: { jsonPath: { path: 'echo.task', equals: 'rank' } } }] },
      },
    });
    expect(res.status()).toBe(201);
    await expect
      .poll(async () => {
        const board = (await (await page.request.get('/api/leaderboard.json?category=Security%20%26%20Audit')).json()) as { categories: Record<string, { name: string; score: number }[]> };
        return board.categories['Security & Audit']?.find((e) => e.name === name)?.score ?? 0;
      }, { timeout: 30_000 })
      .toBeGreaterThan(0);
    await page.goto('/leaderboard');
    const section = page.getByTestId('board-Security & Audit');
    await expect(section).toContainText(name);
    await expect(section).toContainText('new');
    await section.getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name })).toBeVisible();
  });
});
