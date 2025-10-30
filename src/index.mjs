import { SitefinityCrawler } from './crawler.mjs';

/**
 * Main entry point for the Sitefinity documentation crawler
 *
 * Usage:
 *   npm run crawl                    # Crawl all pages (no limit), 1 day cache
 *   npm run crawl -- 100             # Crawl max 100 pages, 1 day cache
 *   npm run crawl -- 100 3600        # Crawl max 100 pages, 1 hour cache
 *   npm run crawl -- Infinity 0      # Crawl all pages, no cache (re-download all)
 *   node src/index.mjs 50 86400      # Crawl max 50 pages, 1 day cache
 */

// Parse command-line arguments
const args = process.argv.slice(2);
const maxPages = args.length > 0 ? parseInt(args[0], 10) : Infinity;
const staleThreshold = args.length > 1 ? parseInt(args[1], 10) : 86400; // Default: 1 day

if (args.length > 0 && isNaN(maxPages)) {
  console.error('Error: maxPages must be a number');
  console.error('Usage: npm run crawl -- <maxPages> [staleThreshold]');
  console.error('  maxPages: number of pages to crawl (default: Infinity)');
  console.error('  staleThreshold: seconds before cache is stale (default: 86400 = 1 day, 0 = no cache)');
  process.exit(1);
}

if (args.length > 1 && isNaN(staleThreshold)) {
  console.error('Error: staleThreshold must be a number (in seconds)');
  console.error('Usage: npm run crawl -- <maxPages> [staleThreshold]');
  console.error('  staleThreshold: 0 = always re-download, 86400 = 1 day (default), 604800 = 1 week');
  process.exit(1);
}

console.log(`Starting crawler with maxPages: ${maxPages === Infinity ? 'unlimited' : maxPages}`);
console.log(`Stale threshold: ${staleThreshold}s (${staleThreshold === 0 ? 'no cache' : `${Math.floor(staleThreshold / 3600)}h ${Math.floor((staleThreshold % 3600) / 60)}m`})`);

const crawler = new SitefinityCrawler({
  outputDir: './output',
  maxPages: maxPages,
  staleThreshold: staleThreshold
});

crawler.run();
