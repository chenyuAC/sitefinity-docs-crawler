import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

export class SitefinityCrawler {
  constructor(options = {}) {
    this.baseUrl = 'https://www.progress.com/documentation/sitefinity-cms';
    this.outputDir = options.outputDir || './output';
    this.visited = new Set();
    this.maxPages = options.maxPages || 100;
    this.pageCount = 0;

    // Selectors for content extraction
    this.selectors = {
      // Main content area (excluding nav, sidebar, footer)
      mainContent: 'article, .main-content, [role="main"], .content-area',

      // Navigation to exclude
      excludeSelectors: [
        'nav',
        'header',
        'footer',
        '.navbar',
        '.sidebar',
        '#kendonav',
        '#navContainer',
        '#sfVersionSelector',
        '.breadcrumb',
        '.k-treeview',
        '[data-role="treeview"]'
      ],

      // Links to follow
      documentationLinks: 'a[href*="/documentation/sitefinity-cms"]',
    };
  }

  async initialize() {
    // Create output directory
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Launch browser
    this.browser = await chromium.launch({
      headless: true,
      timeout: 60000
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
  }

  async extractContent(page, url) {
    console.log(`\nExtracting content from: ${url}`);

    // Wait for main content to load
    try {
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch (e) {
      console.warn('Warning: Network idle timeout, proceeding anyway...');
    }

    // Remove unwanted elements
    for (const selector of this.selectors.excludeSelectors) {
      await page.evaluate((sel) => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      }, selector);
    }

    // Extract main content
    const content = await page.evaluate((mainSelector) => {
      const mainElement = document.querySelector(mainSelector) || document.body;

      return {
        title: document.title,
        heading: document.querySelector('h1')?.textContent?.trim() || '',
        text: mainElement.innerText?.trim() || '',
        html: mainElement.innerHTML || '',
        url: window.location.href
      };
    }, this.selectors.mainContent);

    return content;
  }

  async extractLinks(page) {
    const links = await page.evaluate((selector, baseUrl) => {
      const linkElements = document.querySelectorAll(selector);
      const urls = new Set();

      linkElements.forEach(link => {
        const href = link.href;
        if (href && href.startsWith(baseUrl)) {
          // Clean up URL (remove hash, query params for deduplication)
          const cleanUrl = href.split('#')[0].split('?')[0];
          urls.add(cleanUrl);
        }
      });

      return Array.from(urls);
    }, this.selectors.documentationLinks, this.baseUrl);

    return links;
  }

  async crawlPage(url) {
    if (this.visited.has(url) || this.pageCount >= this.maxPages) {
      return;
    }

    this.visited.add(url);
    this.pageCount++;

    console.log(`\n[${this.pageCount}/${this.maxPages}] Crawling: ${url}`);

    const page = await this.context.newPage();

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Extract content
      const content = await this.extractContent(page, url);

      // Save content
      this.saveContent(content);

      // Extract and queue links
      const links = await this.extractLinks(page);
      console.log(`Found ${links.length} documentation links`);

      await page.close();

      // Recursively crawl found links
      for (const link of links) {
        if (this.pageCount >= this.maxPages) {
          break;
        }
        await this.crawlPage(link);
      }

    } catch (error) {
      console.error(`Error crawling ${url}:`, error.message);
      await page.close();
    }
  }

  saveContent(content) {
    const filename = this.urlToFilename(content.url);
    const filepath = path.join(this.outputDir, filename);

    const data = {
      url: content.url,
      title: content.title,
      heading: content.heading,
      text: content.text,
      crawledAt: new Date().toISOString()
    };

    // Save as JSON
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`Saved: ${filename}`);

    // Optionally save HTML separately
    const htmlFilepath = filepath.replace('.json', '.html');
    fs.writeFileSync(htmlFilepath, content.html);
  }

  urlToFilename(url) {
    // Convert URL to safe filename
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

  async close() {
    if (this.browser) {
      await this.browser.close();
    }

    // Generate summary
    const summary = {
      totalPages: this.pageCount,
      crawledAt: new Date().toISOString(),
      baseUrl: this.baseUrl,
      pages: Array.from(this.visited)
    };

    fs.writeFileSync(
      path.join(this.outputDir, '_summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log(`\n✓ Crawling completed!`);
    console.log(`✓ Total pages crawled: ${this.pageCount}`);
    console.log(`✓ Output directory: ${this.outputDir}`);
  }

  async run() {
    try {
      await this.initialize();
      await this.crawlPage(this.baseUrl);
      await this.close();
    } catch (error) {
      console.error('Crawler error:', error);
      await this.close();
      process.exit(1);
    }
  }
}
