import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Account menu/ })).toBeVisible();
}

/** A bare prompt package: no MCP brick, so the checks need no network. */
const manifest = (name: string) => `apiVersion: agenthive.sh/v2
kind: Agent
metadata:
  name: ${name}
  version: 1.0.0
  license: MIT
  goal: code-audit
  value: Finds secrets committed in a vibe-coded app before they leak.
  tagline: Reads the repository with your tool and reports every credential with file and line.
  tags: [security]
spec:
  settings:
    - { name: max_findings, type: integer, min: 1, max: 50, default: 10 }
  bricks:
    skills: [secret-patterns]
    mcp: []
  io:
    input: { type: object, properties: { path: { type: string } } }
    output: { type: object, properties: { findings: { type: array } } }
readme: |
  ${'A README long enough for the completeness check to be happy about it. '.repeat(4)}
useCases: [before a first deploy]
`;

const files = {
  'prompt.md': 'You audit a repository for leaked secrets. Report at most {{max_findings}} findings, each with file and line. Read files with your tools, never guess.',
  'skills/secret-patterns/SKILL.md': '---\nname: secret-patterns\ndescription: What real credentials look like.\n---\n# Secret patterns\n\nAn AWS key id starts with AKIA followed by 16 uppercase characters.',
  'examples/app.json': '{"path":"."}',
};

test('a package publishes, shows its checks and is retrievable from the card', async ({ page }) => {
  await signIn(page);
  const name = `secret-hunter-${Date.now().toString(36)}`;
  const res = await page.request.post('/api/v1/packages', { data: { manifest: manifest(name), files } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { agent: { apiVersion: string }; audit: { engine: string; checks: { status: string }[] } };
  expect(body.agent.apiVersion).toBe('v2');
  expect(body.audit.engine).toBe('v2');
  expect(body.audit.checks.every((c) => c.status === 'ok')).toBe(true);

  await page.goto(`/agents/${name}`);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name })).toBeVisible();
  await expect(dialog.getByText('checks passed')).toBeVisible();
  await expect(dialog.getByTestId('package-summary')).toContainText('code-audit');

  await dialog.getByRole('tab', { name: 'Package' }).click();
  await expect(dialog.locator('pre', { hasText: 'Report at most {{max_findings}} findings' })).toBeVisible();
  await expect(dialog.getByText('{{max_findings}}', { exact: true })).toBeVisible();

  await dialog.getByRole('tab', { name: 'Checks' }).click();
  await expect(dialog.getByTestId('checks-note')).toContainText('6/6 checks passed');

  await dialog.getByRole('tab', { name: 'Get it' }).click();
  await expect(dialog.getByTestId('get-permissions')).toContainText(`.claude/agents/${name}.md`);
  await expect(dialog.getByTestId('get-permissions')).toContainText('nothing runs on your machine');
  await expect(dialog.locator('pre', { hasText: `agent-cli pull ${name} --target claude` })).toBeVisible();
  await expect(dialog.locator('pre', { hasText: `/agents/${name}/package.json` })).toBeVisible();
  await dialog.getByRole('radio', { name: 'Cursor' }).click();
  await expect(dialog.getByTestId('get-permissions')).toContainText(`.cursor/rules/${name}.mdc`);

  const pkg = (await (await page.request.get(`/agents/${name}/package.json`)).json()) as { layouts: { claude: { files: { path: string; content: string }[] } } };
  expect(pkg.layouts.claude.files[0].path).toBe(`.claude/agents/${name}.md`);
  expect(pkg.layouts.claude.files[0].content).toContain('Report at most 10 findings');
});
