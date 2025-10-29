import { SitefinityCrawler } from './crawler.mjs';

/**
 * Main entry point for the Sitefinity documentation crawler
 *
 * Usage:
 *   npm run crawl              # Crawl all pages (no limit)
 *   npm run crawl -- 100       # Crawl max 100 pages
 *   node src/index.mjs 50      # Crawl max 50 pages
 */

// Parse command-line arguments
const args = process.argv.slice(2);
const maxPages = args.length > 0 ? parseInt(args[0], 10) : Infinity;

if (args.length > 0 && isNaN(maxPages)) {
  console.error('Error: maxPages must be a number');
  console.error('Usage: npm run crawl -- <maxPages>');
  process.exit(1);
}

console.log(`Starting crawler with maxPages: ${maxPages === Infinity ? 'unlimited' : maxPages}`);

const crawler = new SitefinityCrawler({
  outputDir: './output',
  maxPages: maxPages
});

crawler.run();
