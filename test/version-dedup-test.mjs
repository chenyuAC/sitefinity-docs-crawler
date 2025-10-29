/**
 * Test script to verify version deduplication logic
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { SitefinityCrawler } from '../src/crawler.mjs';

// Test URLs
const testUrls = {
  versioned152: 'https://www.progress.com/documentation/sitefinity-cms/152/renderer-proxy-logic',
  versioned133: 'https://www.progress.com/documentation/sitefinity-cms/133/renderer-proxy-logic',
  canonical: 'https://www.progress.com/documentation/sitefinity-cms/renderer-proxy-logic'
};

test('Version deduplication - extractVersion()', () => {
  const crawler = new SitefinityCrawler({ outputDir: './test-output', maxPages: 5 });

  assert.strictEqual(
    crawler.extractVersion(testUrls.versioned152),
    '152',
    'Should extract version 152'
  );

  assert.strictEqual(
    crawler.extractVersion(testUrls.versioned133),
    '133',
    'Should extract version 133'
  );

  assert.strictEqual(
    crawler.extractVersion(testUrls.canonical),
    null,
    'Should return null for canonical URL (no version)'
  );
});

test('Version deduplication - normalizeUrl()', () => {
  const crawler = new SitefinityCrawler({ outputDir: './test-output', maxPages: 5 });

  assert.strictEqual(
    crawler.normalizeUrl(testUrls.versioned152),
    testUrls.canonical,
    'Should normalize versioned152 URL to canonical'
  );

  assert.strictEqual(
    crawler.normalizeUrl(testUrls.versioned133),
    testUrls.canonical,
    'Should normalize versioned133 URL to canonical'
  );

  assert.strictEqual(
    crawler.normalizeUrl(testUrls.canonical),
    testUrls.canonical,
    'Should keep canonical URL unchanged'
  );
});

test('Version deduplication - getCanonicalUrl()', () => {
  const crawler = new SitefinityCrawler({ outputDir: './test-output', maxPages: 5 });

  assert.strictEqual(
    crawler.getCanonicalUrl(testUrls.versioned152),
    testUrls.canonical,
    'Should return canonical URL for versioned152'
  );

  assert.strictEqual(
    crawler.getCanonicalUrl(testUrls.versioned133),
    testUrls.canonical,
    'Should return canonical URL for versioned133'
  );

  assert.strictEqual(
    crawler.getCanonicalUrl(testUrls.canonical),
    testUrls.canonical,
    'Should return same URL for already canonical URL'
  );
});

test('Version deduplication - all versions map to same canonical', () => {
  const crawler = new SitefinityCrawler({ outputDir: './test-output', maxPages: 5 });

  const canonical152 = crawler.getCanonicalUrl(testUrls.versioned152);
  const canonical133 = crawler.getCanonicalUrl(testUrls.versioned133);
  const canonicalOriginal = crawler.getCanonicalUrl(testUrls.canonical);

  assert.strictEqual(
    canonical152,
    canonical133,
    'Different versions should map to same canonical URL'
  );

  assert.strictEqual(
    canonical152,
    canonicalOriginal,
    'Versioned and canonical URLs should map to same canonical URL'
  );
});
