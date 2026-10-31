// Renders scripts/og-template.html to public/og.png (1200×630) with the locally installed Chrome.
// Usage: node scripts/generate-og.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(here, 'og-template.html'));
await page.waitForLoadState('networkidle');
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(here, '..', 'public', 'og.png'), type: 'png' });
await browser.close();
console.log('public/og.png written');
