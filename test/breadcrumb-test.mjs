/**
 * Test breadcrumb extraction functionality
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { chromium } from 'playwright';
import { extractBreadcrumb } from '../src/crawler.mjs';

test('Breadcrumb extraction - nested page', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.progress.com/documentation/sitefinity-cms/renderer-proxy-logic', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  const breadcrumb = await extractBreadcrumb(page);

  await browser.close();

  assert.ok(Array.isArray(breadcrumb), 'Breadcrumb should be an array');
  assert.ok(breadcrumb.length > 0, 'Breadcrumb should not be empty');
  assert.strictEqual(breadcrumb[0], 'Home', 'First breadcrumb should be Home');
  assert.strictEqual(
    breadcrumb[breadcrumb.length - 1],
    'ASP.NET Core Renderer as a proxy',
    'Last breadcrumb should be current page'
  );
});

test('Breadcrumb extraction - top level page', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.progress.com/documentation/sitefinity-cms/architecture-renderer', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  const breadcrumb = await extractBreadcrumb(page);

  await browser.close();

  assert.ok(Array.isArray(breadcrumb), 'Breadcrumb should be an array');
  assert.ok(breadcrumb.length > 0, 'Breadcrumb should not be empty');
  assert.strictEqual(breadcrumb[0], 'Home', 'First breadcrumb should be Home');
  assert.strictEqual(
    breadcrumb[breadcrumb.length - 1],
    'Three-tier architecture',
    'Last breadcrumb should be current page'
  );
});
