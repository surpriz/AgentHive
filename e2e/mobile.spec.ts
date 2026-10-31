import { test, expect } from '@playwright/test';

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile project only');

  test('no horizontal overflow and drawer goes full-screen', async ({ page }) => {
    await page.goto('/');
    const [scrollW, innerW] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scrollW).toBeLessThanOrEqual(innerW);
    await page.getByRole('button', { name: 'Open eu-ai-act-auditor' }).click();
    const box = await page.getByRole('dialog').boundingBox();
    expect(box?.width).toBe(innerW);
  });

  test('dashboard with a freshly created key does not overflow', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Account menu/ }).waitFor();
    await page.goto('/dashboard');
    await page.getByLabel('New key name').fill('phone');
    await page.getByRole('button', { name: 'create key' }).click();
    await page.getByRole('status').waitFor();
    const [scrollW, innerW] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(innerW).toBeLessThanOrEqual(430);
    expect(scrollW).toBeLessThanOrEqual(innerW);
  });
});
