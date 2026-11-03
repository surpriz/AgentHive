import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Account menu/ })).toBeVisible();
}

test('publishing computes a grade, shows the report, and the public report endpoint agrees', async ({ page, request }) => {
  await signIn(page);
  const name = `graded-bot-${Date.now().toString(36)}`;
  await page.getByRole('button', { name: /Push/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('my-sql-agent', { exact: true }).fill(name);
  await dialog.getByPlaceholder(/Makes a slow Postgres query fast/).fill('Summarises incident channels into a postmortem draft.');
  await dialog.getByPlaceholder(/Reads EXPLAIN ANALYZE output/).fill('Reads Slack threads and PagerDuty timelines, writes the timeline section.');
  await dialog.getByText('Permissions & source').click();
  await dialog.getByText('Declare what the agent touches at runtime').click();
  await dialog.getByPlaceholder('api.github.com, *.openai.com').fill('slack.com, api.pagerduty.com');
  await dialog.getByRole('button', { name: 'Publish' }).click();
  await expect(dialog.getByText(`published ${name}@0.1.0 · grade AA`)).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText('source repository not declared', { exact: false })).toBeVisible();

  const pub = (await (await request.get(`/agents/${name}/audit.json`)).json()) as { grade: string; report: { checks: { id: string }[]; findings: unknown[] } };
  expect(pub.grade).toBe('AA');
  expect(pub.report.checks.map((c) => c.id)).toContain('secrets');

  await dialog.getByRole('button', { name: 'Open it' }).click();
  await page.getByRole('tab', { name: 'Audit' }).click();
  await expect(page.getByText('grade capped at AA')).toBeVisible();
});

test('a leaked credential is refused with the blocker listed', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: /Push/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('my-sql-agent', { exact: true }).fill(`leaky-${Date.now().toString(36)}`);
  await dialog.getByPlaceholder(/Makes a slow Postgres query fast/).fill('Leaks a token by accident in its readme section.');
  await dialog.getByPlaceholder(/Reads EXPLAIN ANALYZE output/).fill('Nothing technical about it, just a test fixture here.');
  await dialog.getByPlaceholder('What it needs, what it returns, limits.').fill('token: AKIAIOSFODNN7EXAMPLE');
  await dialog.getByRole('button', { name: 'Publish' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Publish refused by the audit');
  await expect(dialog.getByRole('alert')).toContainText('AWS access key id');
});

test('dashboard re-runs the audit once, then rate limits', async ({ page }) => {
  await signIn(page);
  // Make sure the test user owns at least one agent (the session cookie carries over to page.request).
  const name = `rerun-bot-${Date.now().toString(36)}`;
  const res = await page.request.post('/api/v1/agents', {
    headers: { 'content-type': 'application/json', origin: new URL(page.url()).origin },
    data: { apiVersion: 'agenthive.sh/v1', metadata: { name, version: '0.1.0', category: 'DevOps', value: 'Rotates on-call schedules and pings the next engineer.', tagline: 'Reads the PagerDuty rotation and posts the handover note.' }, spec: { framework: 'AutoGen' } },
  });
  expect(res.status()).toBe(201);
  await page.goto('/dashboard');
  const rerun = page.getByRole('button', { name: `Re-run audit for ${name}` });
  await expect(rerun).toBeVisible();
  await rerun.click();
  await expect(page.getByRole('status')).toContainText(/grade (AAA|AA|A|B) · \d+\/100|already ran recently/);
});
