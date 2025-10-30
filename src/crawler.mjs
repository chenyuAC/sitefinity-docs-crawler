import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';

/**
 * @typedef {Object} CrawlerOptions
 * @property {string} [outputDir] - Directory to save crawled content
 * @property {number} [maxPages] - Maximum number of pages to crawl
 * @property {number} [staleThreshold] - Time in seconds before cached data is considered stale (default: 86400 = 1 day, 0 = always re-download)
 */

/**
 * @typedef {Object} ExtractedContent
 * @property {string} title - Page title
 * @property {string} heading - Main heading (H1)
 * @property {string} text - Extracted text content
 * @property {string} html - Extracted HTML content
 * @property {string} url - Page URL
 * @property {string[]} [breadcrumb] - Breadcrumb navigation items
 */

/**
 * @typedef {Object} CachedPageData
 * @property {Object} json - JSON metadata
 * @property {string} html - Cached HTML content
 * @property {string} md - Cached Markdown content
 * @property {string} crawledAt - ISO timestamp when page was crawled
 */

/**
 * Default selectors for content extraction
 */
export const DEFAULT_SELECTORS = {
  // Main content area (excluding nav, sidebar, footer)
  mainContent: 'article, .main-content, [role="main"], .content-area',

  // Elements to exclude from content extraction
  excludeSelectors: [
    // Navigation and structure
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
    '[data-role="treeview"]',

    // Promotional and CTA sections
    '.promo',
    '.cta',
    '.call-to-action',
    '[class*="promo"]',
    '[class*="banner"]',

    // Feedback and rating widgets
    '.feedback',
    '.rating',
    '.article-feedback',
    '[class*="feedback"]',
    '[class*="rating"]',
    '[class*="helpful"]',

    // Training and learning sections
    '.training',
    '.courses',
    '.learn-more',
    '[class*="training"]',
    '[class*="course"]',

    // Cookie consent and privacy
    '.cookie',
    '.consent',
    '[class*="cookie"]',
    '[class*="consent"]',
    '[class*="privacy"]',

    // Tracking pixels and analytics
    'img[src*="bat.bing.com"]',
    'img[src*="analytics"]',
    'img[src*="adsct"]',
    'img[src*="tracking"]',

    // Social media widgets
    '.social',
    '.share',
    '[class*="social"]',
    '[class*="share"]',

    // Related content and next article navigation
    '.related',
    '.next-article',
    '[class*="related"]',
    '[class*="next"]'
  ],

  // Links to follow
  documentationLinks: 'a[href*="/documentation/sitefinity-cms"]',
};

/**
 * Create a configured TurndownService instance
 * @returns {TurndownService}
 */
export function createTurndownService() {
  return new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  });
}

/**
 * Extracts breadcrumb navigation from the page
 * @param {import('playwright').Page} page - Playwright page object
 * @returns {Promise<string[]>} Array of breadcrumb items
 */
export async function extractBreadcrumb(page) {
  return await page.evaluate(() => {
    const breadcrumbNav = document.querySelector('.sf-breadcrumb, nav[aria-label*="breadcrumb"]');
    if (!breadcrumbNav) {
      return /** @type {string[]} */ ([]);
    }

    /** @type {string[]} */
    const breadcrumbs = [];
    
    // Extract text from links and current page
    breadcrumbNav.querySelectorAll('a, span[aria-current="page"]').forEach(element => {
      const text = element.textContent?.trim();
      if (text) {
        breadcrumbs.push(text);
      }
    });

    return breadcrumbs;
  });
}

/**
 * Extract content from a page using the provided selectors
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string[]} [excludeSelectors] - Selectors for elements to exclude
 * @returns {Promise<ExtractedContent>}
 */
export async function extractPageContent(page, excludeSelectors = DEFAULT_SELECTORS.excludeSelectors) {
  // Extract breadcrumb first (before content extraction that may remove it)
  const breadcrumb = await extractBreadcrumb(page);

  // Wait for main content to load
  try {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
  } catch (e) {
    console.warn('Warning: Network idle timeout, proceeding anyway...');
  }

  // Extract main content with improved cleaning
  const content = await page.evaluate((/** @type {string[]} */ excludeSels) => {
    // Clone body to avoid modifying the actual page
    const bodyClone = /** @type {HTMLElement} */ (document.body.cloneNode(true));

    // Remove unwanted elements by selector
    excludeSels.forEach(sel => {
      bodyClone.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Remove script and style tags
    bodyClone.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());

    // Remove elements by text content (repeating sections across pages)
    // These patterns identify promotional/noise sections that repeat across pages
    const removalPatterns = [
      { pattern: /^NEW TO SITEFINITY\?/i, heading: true },
      { pattern: /^Want to learn more\?/i, heading: true },
      { pattern: /^Was this article helpful\?/i, heading: true },
      { pattern: /^Would you like to submit additional feedback\?/i, heading: true },
      { pattern: /^Next article$/i, heading: true },
      { pattern: /We use cookies to personalize content/i, heading: false },
      { pattern: /Cookie Settings/i, heading: false },
      { pattern: /Cookies Settings Accept Cookies/i, heading: false }
    ];

    // Find and remove heading-based sections (h2, h3, h4, h5 that start these sections)
    bodyClone.querySelectorAll('h2, h3, h4, h5').forEach(heading => {
      const headingText = heading.textContent?.trim() || '';

      // Check if this heading matches our removal patterns
      const matchesPattern = removalPatterns
        .filter(p => p.heading)
        .some(p => p.pattern.test(headingText));

      if (matchesPattern) {
        // Remove the heading and all following siblings until the next heading of same or higher level
        const headingLevel = parseInt(heading.tagName.charAt(1)); // Get the number from H2, H3, etc.

        // Collect elements to remove
        const toRemove = [heading];
        let sibling = heading.nextElementSibling;

        while (sibling) {
          const siblingTag = sibling.tagName;

          // Stop if we hit a heading of same or higher level
          if (/^H[1-6]$/.test(siblingTag)) {
            const siblingLevel = parseInt(siblingTag.charAt(1));
            if (siblingLevel <= headingLevel) {
              break;
            }
          }

          toRemove.push(sibling);
          sibling = sibling.nextElementSibling;
        }

        // Remove all collected elements
        toRemove.forEach(el => el.remove());
      }
    });

    // Remove non-heading noise elements
    const nonHeadingPatterns = removalPatterns.filter(p => !p.heading);
    bodyClone.querySelectorAll('div, p, section').forEach(el => {
      const text = el.textContent?.trim() || '';
      if (nonHeadingPatterns.some(p => p.pattern.test(text))) {
        el.remove();
      }
    });

    // Remove training course listings (these appear after the main content)
    // Look for elements with course-related content patterns
    bodyClone.querySelectorAll('a').forEach(link => {
      const href = link.getAttribute('href') || '';
      const text = link.textContent || '';

      // Remove links to Progress education/training
      if (href.includes('/services/education/') ||
          text.includes('free lesson') ||
          text.includes('free on-demand video course')) {
        // Remove the link and nearby course description elements
        let parent = link.parentElement;
        while (parent && parent !== bodyClone) {
          const parentText = parent.textContent || '';
          if (parentText.includes('This free lesson') ||
              parentText.includes('free on-demand video course')) {
            parent.remove();
            break;
          }
          parent = parent.parentElement;
        }
      }
    });

    // Remove orphaned course icon images
    bodyClone.querySelectorAll('img[src*="course_book"]').forEach(img => img.remove());

    // Remove "Thank you for your feedback!" text nodes
    bodyClone.querySelectorAll('*').forEach(el => {
      if (el.textContent?.trim() === 'Thank you for your feedback!') {
        el.remove();
      }
    });

    // Remove elements with tracking/analytics attributes
    bodyClone.querySelectorAll('[onclick*="__doPostBack"]').forEach(el => el.remove());
    bodyClone.querySelectorAll('a[href^="javascript:"]').forEach(el => el.remove());

    // Get clean text
    const text = bodyClone.innerText?.trim() || '';

    return {
      title: document.title,
      heading: document.querySelector('h1')?.textContent?.trim() || '',
      text: text,
      html: bodyClone.innerHTML || '',
      url: window.location.href
    };
  }, excludeSelectors);

  // Add breadcrumb to the content object
  return {
    ...content,
    breadcrumb: breadcrumb
  };
}

/**
 * Normalizes whitespace in markdown content
 * - Trims excessive blank lines (max 2 consecutive newlines)
 * - Trims trailing whitespace from each line
 * - Ensures consistent line endings
 * @param {string} markdown - Raw markdown content
 * @returns {string} Normalized markdown
 */
export function normalizeMarkdownWhitespace(markdown) {
  return markdown
    // Remove trailing whitespace from each line
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    // Replace 3+ consecutive newlines with max 2 newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim leading/trailing whitespace from entire document
    .trim();
}

/**
 * Convert extracted content to markdown document with frontmatter
 * @param {ExtractedContent} content - Extracted page content
 * @param {TurndownService} turndownService - Turndown service instance
 * @returns {string} Markdown document
 */
export function contentToMarkdown(content, turndownService) {
  const markdown = turndownService.turndown(content.html);
  
  // Normalize whitespace in the converted markdown
  const normalizedMarkdown = normalizeMarkdownWhitespace(markdown);

  // Build breadcrumb trail if available
  const breadcrumbLine = content.breadcrumb && content.breadcrumb.length > 0
    ? `**Breadcrumb:** ${content.breadcrumb.join(' > ')}`
    : '';

  const frontmatter = [
    `# ${content.heading || content.title}`,
    '',
    `**URL:** ${content.url}`,
    breadcrumbLine,
    `**Crawled:** ${new Date().toISOString()}`,
    '',
    '---',
    ''
  ].filter(line => line !== ''); // Remove empty breadcrumb line if not present

  return [
    ...frontmatter,
    normalizedMarkdown
  ].join('\n');
}

/**
 * Convert URL to safe filename
 * @param {string} url - Page URL
 * @returns {string} Safe filename with .json extension
 */
export function urlToFilename(url) {
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

/**
 * Save extracted content to JSON, HTML, and Markdown files
 * @param {ExtractedContent} content - Extracted page content
 * @param {string} progressDir - Directory to save files
 * @param {TurndownService} turndownService - Turndown service instance
 * @param {string[]} allMarkdownContent - Array to collect markdown for concatenation
 */
export function savePageContent(content, progressDir, turndownService, allMarkdownContent) {
  const filename = urlToFilename(content.url);

  const data = {
    url: content.url,
    title: content.title,
    heading: content.heading,
    breadcrumb: content.breadcrumb || [],
    text: content.text,
    crawledAt: new Date().toISOString()
  };

  // Save JSON in progress subdirectory
  const jsonFilepath = path.join(progressDir, filename);
  fs.writeFileSync(jsonFilepath, JSON.stringify(data, null, 2));

  // Save HTML in progress subdirectory
  const htmlFilepath = path.join(progressDir, filename.replace('.json', '.html'));
  fs.writeFileSync(htmlFilepath, content.html);

  // Convert to Markdown and save in progress subdirectory
  const markdownDoc = contentToMarkdown(content, turndownService);
  const mdFilepath = path.join(progressDir, filename.replace('.json', '.md'));
  fs.writeFileSync(mdFilepath, markdownDoc);

  // Collect for concatenated output
  allMarkdownContent.push(markdownDoc);

  return filename;
}

export class SitefinityCrawler {
  /**
   * Create a new Sitefinity documentation crawler
   * @param {CrawlerOptions} options - Crawler configuration options
   */
  constructor(options = {}) {
    this.baseUrl = 'https://www.progress.com/documentation/sitefinity-cms';
    /** @type {string} */
    this.outputDir = options.outputDir || './output';
    /** @type {string} */
    this.progressDir = path.join(this.outputDir, 'progress');
    /** @type {Set<string>} */
    this.visited = new Set();
    /** @type {Set<string>} - Tracks canonical (non-versioned) URLs to prevent crawling different versions of the same page */
    this.visitedCanonical = new Set();
    /** @type {number} */
    this.maxPages = options.maxPages !== undefined ? options.maxPages : 100;
    /** @type {number} - Stale threshold in seconds (default: 86400 = 1 day) */
    this.staleThreshold = options.staleThreshold !== undefined ? options.staleThreshold : 86400;
    /** @type {number} */
    this.pageCount = 0;
    /** @type {number} */
    this.cachedCount = 0;
    /** @type {import('playwright').Browser | undefined} */
    this.browser = undefined;
    /** @type {import('playwright').BrowserContext | undefined} */
    this.context = undefined;
    /** @type {TurndownService} */
    this.turndownService = createTurndownService();
    /** @type {string[]} */
    this.allMarkdownContent = [];
    /** @type {Map<string, CachedPageData>} - Cache of fresh page data indexed by URL */
    this.cachedPages = new Map();

    // Selectors for content extraction
    this.selectors = DEFAULT_SELECTORS;
  }

  /**
   * Load existing progress files and check for fresh cached data
   * @returns {Promise<Set<string>>} Set of URLs to crawl from cached pages
   */
  async loadCachedProgress() {
    const urlsToCrawl = new Set();

    if (!fs.existsSync(this.progressDir)) {
      console.log('No existing progress directory found, starting fresh crawl');
      return urlsToCrawl;
    }

    console.log('Checking for cached progress files...');
    const files = fs.readdirSync(this.progressDir).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
      console.log('No cached progress files found, starting fresh crawl');
      return urlsToCrawl;
    }

    const now = Date.now();
    const staleThresholdMs = this.staleThreshold * 1000;
    let freshCount = 0;
    let staleCount = 0;

    // If staleThreshold is 0, skip all cached data
    if (this.staleThreshold === 0) {
      console.log(`Stale threshold is 0, re-downloading all ${files.length} pages`);
      return urlsToCrawl;
    }

    for (const file of files) {
      try {
        const jsonPath = path.join(this.progressDir, file);
        const htmlPath = jsonPath.replace('.json', '.html');
        const mdPath = jsonPath.replace('.json', '.md');

        // Check if all required files exist
        if (!fs.existsSync(htmlPath) || !fs.existsSync(mdPath)) {
          staleCount++;
          continue;
        }

        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        const mdContent = fs.readFileSync(mdPath, 'utf-8');

        // Check if data is fresh
        const crawledAt = new Date(jsonData.crawledAt).getTime();
        const age = now - crawledAt;
        const isFresh = age < staleThresholdMs;

        if (isFresh) {
          // Store cached data
          this.cachedPages.set(jsonData.url, {
            json: jsonData,
            html: htmlContent,
            md: mdContent,
            crawledAt: jsonData.crawledAt
          });

          // Mark as visited
          this.visited.add(jsonData.url);
          const canonical = this.getCanonicalUrl(jsonData.url);
          this.visitedCanonical.add(canonical);

          // Add to markdown collection
          this.allMarkdownContent.push(mdContent);

          // Extract links from cached HTML to find new pages to crawl
          const links = this.extractLinksFromHtml(htmlContent, jsonData.url);
          links.forEach(link => urlsToCrawl.add(link));

          freshCount++;
        } else {
          staleCount++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error loading cached file ${file}:`, errorMessage);
        staleCount++;
      }
    }

    console.log(`Loaded ${freshCount} fresh cached pages (threshold: ${this.staleThreshold}s)`);
    console.log(`Found ${staleCount} stale/missing pages to re-crawl`);
    console.log(`Extracted ${urlsToCrawl.size} URLs from cached HTML to check`);
    this.cachedCount = freshCount;

    return urlsToCrawl;
  }

  /**
   * Extract links from cached HTML without making a network request
   * @param {string} htmlContent - Cached HTML content
   * @param {string} baseUrl - Base URL for resolving relative links
   * @returns {string[]} - Array of documentation links
   */
  extractLinksFromHtml(htmlContent, baseUrl) {
    // Use cheerio-like approach with regex for simple link extraction
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    const urls = new Set();
    let match;

    while ((match = linkRegex.exec(htmlContent)) !== null) {
      const href = match[1];

      // Check if it's a documentation link
      if (href && href.includes('/documentation/sitefinity-cms')) {
        try {
          // Handle both absolute and relative URLs
          const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
          // Clean up URL (remove hash, query params)
          const cleanUrl = fullUrl.split('#')[0].split('?')[0];

          if (cleanUrl.startsWith(this.baseUrl)) {
            urls.add(cleanUrl);
          }
        } catch (error) {
          // Skip invalid URLs
        }
      }
    }

    return Array.from(urls);
  }

  /**
   * Initialize the crawler by creating output directory and launching browser
   * @returns {Promise<Set<string>>} URLs to crawl from cached pages
   */
  async initialize() {
    // Create output directories
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.progressDir)) {
      fs.mkdirSync(this.progressDir, { recursive: true });
    }

    // Load cached progress and get URLs to crawl
    const urlsToCrawl = await this.loadCachedProgress();

    // Launch browser
    this.browser = await chromium.launch({
      headless: true,
      timeout: 60000
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });

    return urlsToCrawl;
  }

  /**
   * Extract content from a page
   * @param {import('playwright').Page} page - Playwright page object
   * @param {string} url - Page URL
   * @returns {Promise<ExtractedContent>}
   */
  async extractContent(page, url) {
    console.log(`\nExtracting content from: ${url}`);
    return extractPageContent(page, this.selectors.excludeSelectors);
  }

  /**
   * Extract documentation links from a page
   * @param {import('playwright').Page} page - Playwright page object
   * @returns {Promise<string[]>}
   */
  async extractLinks(page) {
    const selector = this.selectors.documentationLinks;
    const baseUrl = this.baseUrl;

    const links = await page.evaluate(
      /**
       * @param {{selector: string, baseUrl: string}} args
       * @returns {string[]}
       */
      (args) => {
        const linkElements = document.querySelectorAll(args.selector);
        const urls = new Set();

        linkElements.forEach(link => {
          const href = /** @type {HTMLAnchorElement} */ (link).href;
          if (href && href.startsWith(args.baseUrl)) {
            // Clean up URL (remove hash, query params for deduplication)
            const cleanUrl = href.split('#')[0].split('?')[0];
            urls.add(cleanUrl);
          }
        });

        return Array.from(urls);
      },
      { selector, baseUrl }
    );

    return links;
  }

  /**
   * Crawl a single page and recursively crawl linked pages
   * @param {string} url - URL to crawl
   * @returns {Promise<void>}
   */
  async crawlPage(url) {
    if (this.visited.has(url) || this.pageCount >= this.maxPages) {
      return;
    }

    // Check if we've already crawled this page's canonical version
    const canonicalUrl = this.getCanonicalUrl(url);
    const hasVersion = this.extractVersion(url);

    if (hasVersion && this.visitedCanonical.has(canonicalUrl)) {
      console.log(`Skipping versioned URL (already crawled canonical): ${url}`);
      return;
    }

    // If this is a versioned URL, try to crawl the non-versioned (latest) version first
    if (hasVersion && !this.visitedCanonical.has(canonicalUrl)) {
      console.log(`Found versioned URL: ${url} (version ${hasVersion})`);
      console.log(`Attempting to crawl canonical (latest) version first: ${canonicalUrl}`);

      // Try to crawl the canonical URL first
      if (!this.context) {
        throw new Error('Browser context not initialized');
      }

      const testPage = await this.context.newPage();
      let canonicalExists = false;

      try {
        const response = await testPage.goto(canonicalUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        // Check if the page loaded successfully (not 404)
        canonicalExists = response ? response.ok() : false;
        await testPage.close();

        if (canonicalExists) {
          console.log(`Canonical version exists, crawling: ${canonicalUrl}`);
          // Recursively crawl the canonical version
          await this.crawlPage(canonicalUrl);
          return; // Skip the versioned URL since we crawled the canonical
        } else {
          console.log(`Canonical version doesn't exist (${response?.status()}), crawling versioned URL as exception`);
        }
      } catch (error) {
        console.log(`Canonical version failed to load, crawling versioned URL as exception`);
        await testPage.close();
      }
    }

    // Check if we have fresh cached data for this URL
    const cachedData = this.cachedPages.get(url);
    if (cachedData) {
      // We already loaded this page from cache - skip it
      return;
    }

    // No cached data or data is stale, fetch from network
    // Mark both the actual URL and canonical URL as visited
    this.visited.add(url);
    this.visitedCanonical.add(canonicalUrl);
    this.pageCount++;

    console.log(`\n[${this.pageCount}/${this.maxPages}] Crawling: ${url}`);

    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const page = await this.context.newPage();

    try {
      // Retry logic with progressive timeout
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const timeout = 10000 * attempt; // 10s, 20s, 30s

        try {
          if (attempt > 1) {
            console.log(`Re-attempt ${attempt}/${maxRetries} (timeout: ${timeout / 1000}s)`);
          }
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: timeout
          });

          // Success - break out of retry loop
          break;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          if (attempt < maxRetries) {
            console.log(`Attempt ${attempt} failed: ${errorMessage}`);
          } else {
            // Final attempt failed
            throw error;
          }
        }
      }

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error crawling ${url}:`, errorMessage);
      await page.close();
    }
  }

  /**
   * Save extracted content to files
   * @param {ExtractedContent} content - Extracted page content
   * @returns {void}
   */
  saveContent(content) {
    const filename = savePageContent(content, this.progressDir, this.turndownService, this.allMarkdownContent);
    console.log(`Saved: ${filename}`);
  }

  /**
   * Extracts the version number from a Sitefinity documentation URL
   * @param {string} url - The URL to check
   * @returns {string | null} - The version number (e.g., '152', '133') or null if no version found
   */
  extractVersion(url) {
    // Match patterns like /documentation/sitefinity-cms/152/...
    const versionMatch = url.match(/\/documentation\/sitefinity-cms\/(\d+)\//);
    return versionMatch ? versionMatch[1] : null;
  }

  /**
   * Normalizes a URL by removing the version slug if present
   * @param {string} url - The URL to normalize
   * @returns {string} - The normalized URL without version
   */
  normalizeUrl(url) {
    // Remove version pattern: /documentation/sitefinity-cms/152/ -> /documentation/sitefinity-cms/
    return url.replace(/\/documentation\/sitefinity-cms\/\d+\//, '/documentation/sitefinity-cms/');
  }

  /**
   * Gets the canonical (non-versioned) URL for deduplication
   * @param {string} url - The URL to get canonical form of
   * @returns {string} - The canonical URL
   */
  getCanonicalUrl(url) {
    const version = this.extractVersion(url);
    if (version) {
      // Has a version, return the normalized (versionless) URL
      return this.normalizeUrl(url);
    }
    // Already canonical (no version)
    return url;
  }

  /**
   * Close browser and generate summary
   * @returns {Promise<void>}
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
    }

    // Generate summary
    const summary = {
      totalPages: this.pageCount,
      cachedPages: this.cachedCount,
      newlyFetchedPages: this.pageCount,
      crawledAt: new Date().toISOString(),
      baseUrl: this.baseUrl,
      pages: Array.from(this.visited)
    };

    fs.writeFileSync(
      path.join(this.outputDir, '_summary.json'),
      JSON.stringify(summary, null, 2)
    );

    // Save concatenated markdown file as llms-full.txt
    const totalPages = this.pageCount + this.cachedCount;
    const markdownOutput = [
      '# Sitefinity CMS Documentation',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Total Pages:** ${totalPages}`,
      `**Cached Pages:** ${this.cachedCount}`,
      `**Newly Fetched Pages:** ${this.pageCount}`,
      '',
      '---',
      '',
      ...this.allMarkdownContent.map((md, i) => `\n\n## Document ${i + 1}\n\n${md}`)
    ].join('\n');

    fs.writeFileSync(
      path.join(this.outputDir, 'llms-full.txt'),
      markdownOutput
    );

    console.log(`\n✓ Crawling completed!`);
    console.log(`✓ Total pages: ${totalPages} (${this.cachedCount} cached, ${this.pageCount} newly fetched)`);
    console.log(`✓ Output structure:`);
    console.log(`  - ${this.outputDir}/`);
    console.log(`    - llms-full.txt (concatenated markdown for LLMs)`);
    console.log(`    - _summary.json (crawl metadata)`);
    console.log(`    - progress/`);
    console.log(`      - *.json (page metadata)`);
    console.log(`      - *.md (individual markdown files)`);
    console.log(`      - *.html (cleaned HTML files)`);
  }

  /**
   * Run the crawler
   * @returns {Promise<void>}
   */
  async run() {
    try {
      const urlsToCrawl = await this.initialize();

      // If we have cached URLs to crawl, crawl them
      if (urlsToCrawl.size > 0) {
        console.log(`\nCrawling ${urlsToCrawl.size} URLs from cached pages...`);
        for (const url of urlsToCrawl) {
          if (this.pageCount >= this.maxPages) {
            break;
          }
          await this.crawlPage(url);
        }
      }

      // Always crawl the base URL (in case there are new pages or no cache)
      await this.crawlPage(this.baseUrl);

      await this.close();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Crawler error:', errorMessage);
      await this.close();
      process.exit(1);
    }
  }
}
