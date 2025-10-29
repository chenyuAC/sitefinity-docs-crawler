import { SitefinityCrawler } from './crawler.js';

const crawler = new SitefinityCrawler({
  outputDir: './output',
  maxPages: 50 // Adjust as needed
});

crawler.run();
