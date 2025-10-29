import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractPageContent,
  contentToMarkdown,
  createTurndownService,
  DEFAULT_SELECTORS
} from '../src/crawler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sampler script to test the crawler's extraction logic on sample pages
 * Uses the same extraction functions as the main crawler
 * @returns {Promise<void>}
 */
async function sampleSelectors() {
  console.log('🔍 Sitefinity Documentation Selector Sampler\n');

  const outputDir = path.join(__dirname, '..', 'output');
  const progressDir = path.join(outputDir, 'progress');

  // Create output directories
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  if (!fs.existsSync(progressDir)) {
    fs.mkdirSync(progressDir, { recursive: true });
  }

  const turndownService = createTurndownService();
  /** @type {string[]} */
  let allMarkdownContent = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  const urls = [
    'https://www.progress.com/documentation/sitefinity-cms',
    'https://www.progress.com/documentation/sitefinity-cms/architecture-renderer',
    'https://www.progress.com/documentation/sitefinity-cms/renderer-proxy-logic'
  ];

  for (const url of urls) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing URL: ${url}`);
    console.log('='.repeat(80));

    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Use the crawler's extraction function
    const content = await extractPageContent(page, DEFAULT_SELECTORS.excludeSelectors);

    console.log(`\n✓ Title: ${content.title}`);
    console.log(`✓ Heading: ${content.heading}`);
    console.log(`✓ Text length: ${content.text.length} chars`);
    console.log(`✓ HTML length: ${content.html.length} chars`);

    // Convert to markdown using the crawler's function
    const markdownDoc = contentToMarkdown(content, turndownService);

    // Save individual markdown file in progress subdirectory
    const filename = urlToFilename(url);
    const mdFilepath = path.join(progressDir, filename.replace('.json', '.md'));
    fs.writeFileSync(mdFilepath, markdownDoc);
    console.log(`✓ Saved markdown: progress/${path.basename(mdFilepath)}`);

    // Collect for concatenated output
    allMarkdownContent.push(markdownDoc);

    // Preview
    console.log(`\nPreview (first 300 chars):\n${'─'.repeat(80)}`);
    console.log(content.text.substring(0, 300).replace(/\n+/g, '\n'));
    console.log('─'.repeat(80));

    await page.close();
  }

  // Save concatenated markdown file as llms-full.txt
  const markdownOutput = [
    '# Sitefinity CMS Documentation',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Total Pages:** ${urls.length}`,
    '',
    '---',
    '',
    ...allMarkdownContent.map((md, i) => `\n\n## Document ${i + 1}\n\n${md}`)
  ].join('\n');

  const outputFilepath = path.join(outputDir, 'llms-full.sample.txt');
  fs.writeFileSync(outputFilepath, markdownOutput);
  console.log(`\n✓ Concatenated output saved to: ${path.basename(outputFilepath)} (markdown format)`);

  await browser.close();

  console.log('\n✓ Sampling complete!');
  console.log(`✓ Output directory: ${outputDir}`);
  console.log(`✓ Individual MD files: ${outputDir}/progress/`);
  console.log(`✓ Concatenated file: ${outputDir}/llms-full.sample.txt`);
  console.log(`✓ The sampler uses the same extraction logic as the main crawler`);
}

/**
 * Convert URL to safe filename (same logic as crawler)
 * @param {string} url - Page URL
 * @returns {string} Safe filename
 */
function urlToFilename(url) {
  const urlObj = new URL(url);
  let filename = urlObj.pathname
    .replace(/^\/documentation\/sitefinity-cms\/?/, '')
    .replace(/\//g, '_')
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!filename || filename === '') {
    filename = 'index';
  }

  return `${filename}.json`;
}

// Run sampler
sampleSelectors().catch(console.error);
