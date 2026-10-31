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
});
