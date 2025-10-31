import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SitefinityCrawler } from '../src/crawler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test redirect caching with individual JSON files
 */
describe('Redirect Cache', () => {
  it('should save and load redirect mappings from individual files', async () => {
    const outputDir = path.join(__dirname, '..', 'output');
    const progressDir = path.join(outputDir, 'progress');

    const crawler = new SitefinityCrawler({
      outputDir: outputDir,
      maxPages: 5,
      staleThreshold: 360000
    });

    // Create directories if needed
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    if (!fs.existsSync(progressDir)) {
      fs.mkdirSync(progressDir, { recursive: true });
    }

    const sourceUrl = 'https://www.progress.com/documentation/sitefinity-cms/configure-and-start-a-project';
    const targetUrl = 'https://www.progress.com/documentation/sitefinity-cms/set-up-the-project';

    // Test: Save redirect to cache
    crawler.saveRedirectToCache(sourceUrl, targetUrl);
    console.log('✓ Saved redirect to cache');

    // Test: Verify file was created
    const redirectFiles = fs.readdirSync(progressDir).filter(f => f.endsWith('.redirect.json'));
    assert.ok(redirectFiles.length > 0, 'Should create at least one redirect file');
    console.log(`✓ Found ${redirectFiles.length} redirect cache file(s)`);

    // Test: Load redirect from cache
    const loadedTarget = crawler.loadRedirectFromCache(sourceUrl);
    assert.strictEqual(loadedTarget, targetUrl, 'Should load the correct redirect target');
    console.log('✓ Loaded redirect from cache:', loadedTarget);

    // Test: Load all redirects into memory
    const crawler2 = new SitefinityCrawler({
      outputDir: outputDir,
      maxPages: 5,
      staleThreshold: 360000
    });

    crawler2.loadAllRedirects();
    assert.ok(crawler2.redirectCache.size > 0, 'Should load redirects into cache');
    assert.strictEqual(crawler2.redirectCache.get(sourceUrl), targetUrl, 'Should have correct mapping in cache');
    console.log(`✓ Loaded ${crawler2.redirectCache.size} redirect(s) into memory`);

    // Test: Verify file contents
    const redirectFile = path.join(progressDir, redirectFiles[0]);
    const data = JSON.parse(fs.readFileSync(redirectFile, 'utf-8'));
    assert.strictEqual(data.source, sourceUrl, 'File should contain source URL');
    assert.strictEqual(data.target, targetUrl, 'File should contain target URL');
    assert.ok(data.cachedAt, 'File should contain cachedAt timestamp');
    console.log('✓ Redirect file contents verified');

    console.log('\n✓ All redirect cache tests passed!');
  });
});
