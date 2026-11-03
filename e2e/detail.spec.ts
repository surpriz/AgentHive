import { test, expect } from '@playwright/test';

test('a repository package shows its prompt, skills and the pull command', async ({ page }) => {
  await page.goto('/agents/secret-exposure-hunter');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'secret-exposure-hunter' })).toBeVisible();
  await expect(dialog.getByTestId('package-summary')).toContainText('code-audit');

  await dialog.getByRole('tab', { name: 'Package' }).click();
  await expect(dialog.getByRole('tab', { name: 'Package' })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByText('skills/secret-patterns/SKILL.md')).toBeVisible();

  await dialog.getByRole('tab', { name: 'Get it' }).click();
  await expect(dialog.locator('pre', { hasText: 'agent-cli pull secret-exposure-hunter --target claude' })).toBeVisible();
});

test('the checks tab lists what was verified and links to the criteria', async ({ page }) => {
  await page.goto('/agents/vibe-app-security-triage');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Checks' }).click();
  await expect(dialog.getByTestId('checks-note')).toContainText('checks passed');
  await expect(dialog.getByRole('link', { name: /how grades are computed/ })).toHaveAttribute('href', /grading|checks/);
});
