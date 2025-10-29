# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Playwright-based web crawler for extracting content from the Sitefinity CMS documentation website (https://www.progress.com/documentation/sitefinity-cms). The crawler recursively follows documentation links, extracts main content while filtering out navigation/UI elements, and saves the results as JSON (structured metadata + text), HTML, and Markdown files. It also generates a concatenated output (`llms-full.txt`) optimized for LLM consumption.

### Key Features

- **Smart Version Deduplication** - Automatically detects versioned URLs (e.g., `/152/page` vs `/133/page`) and crawls only the canonical (latest) version
- **Breadcrumb Extraction** - Captures hierarchical navigation context for better organization
- **Whitespace Normalization** - Produces clean, optimized markdown with consistent formatting
- **Unlimited Crawling** - Configurable page limits (default: unlimited) via command-line arguments
- **Comprehensive Testing** - Full test suite with Node.js test runner

## ES Modules

This project uses ES modules (`"type": "module"` in package.json):
- All imports must use `.mjs` or `.js` extensions: `import { SitefinityCrawler } from './crawler.mjs'`
- Use `import/export` syntax (not `require/module.exports`)
- Node.js 14+ is required

## Commands

### Run the crawler
```bash
# Crawl all pages (unlimited)
npm run crawl

# Crawl up to 100 pages
npm run crawl -- 100

# Crawl up to 50 pages
npm run crawl -- 50
```
Executes `src/index.mjs` which accepts an optional numeric argument for `maxPages` (default: Infinity).

### Run tests
```bash
# Run all tests
npm test

# Run only sampler test
npm run test:sample

# Run only version deduplication tests
npm run test:dedup

# Run type checking
npm run typecheck
```

Tests include:
- Sampler (content extraction validation)
- Version deduplication logic
- Breadcrumb extraction
- Whitespace normalization

## Architecture

### Core Components

**`src/crawler.mjs`** - Core crawler module with reusable functions and the `SitefinityCrawler` class

**Exported utility functions** (used by sampler and main crawler):
- `extractBreadcrumb(page)` - Extracts breadcrumb navigation from a page
- `extractPageContent(page, excludeSelectors)` - Extracts content with element exclusion
- `contentToMarkdown(content, turndownService)` - Converts content to markdown with frontmatter
- `normalizeMarkdownWhitespace(markdown)` - Cleans up excessive whitespace in markdown
- `createTurndownService()` - Creates a configured Turndown service instance
- `urlToFilename(url)` - Converts URL to safe filename
- `savePageContent(content, progressDir, turndownService, allMarkdownContent)` - Saves JSON, HTML, and MD files
- `DEFAULT_SELECTORS` - Default selectors for content extraction

**`SitefinityCrawler` class** methods:
- `initialize()` - Creates output directory and launches headless Chromium
- `crawlPage(url)` - Recursive crawler with smart version deduplication
  - Detects versioned URLs (e.g., `/152/page`)
  - Attempts to crawl canonical (versionless) URL first
  - Falls back to versioned URL if canonical doesn't exist
  - Marks both versioned and canonical URLs as visited to prevent duplicates
- `extractContent(page, url)` - Wrapper that calls `extractPageContent()`
- `extractLinks(page)` - Finds documentation links to crawl
- `saveContent(content)` - Uses shared `savePageContent()` function
- `close()` - Closes browser and generates summary plus concatenated file (`llms-full.txt`)
- `run()` - Main entry point that orchestrates the crawl
- `extractVersion(url)` - Extracts version number from URL (e.g., "152")
- `normalizeUrl(url)` - Removes version slug from URL
- `getCanonicalUrl(url)` - Returns canonical (non-versioned) URL

**`src/index.mjs`** - Entry point
- Accepts command-line arguments for `maxPages`
- Default: unlimited pages (`Infinity`), `./output` directory

**`test/sampler.mjs`** - Selector testing tool
- **Uses shared `savePageContent()` function** - ensures sampler generates identical output to main crawler
- Tests on sample URLs to verify output quality
- Generates sample outputs: `llms-full.sample.txt` and individual files in `progress/`
- Useful for validating changes before running full crawl

### Selector Strategy

The crawler's effectiveness depends on its CSS selectors (defined in `DEFAULT_SELECTORS`):

**Main content extraction** (first match wins):
- `article`, `.main-content`, `[role="main"]`, `.content-area`

**Elements to exclude** (Sitefinity-specific):
- Navigation: `nav`, `header`, `footer`, `.navbar` (but breadcrumbs are extracted separately before exclusion)
- Sidebars: `.sidebar`, `#kendonav`, `#navContainer`
- UI controls: `#sfVersionSelector`, `.k-treeview`, `[data-role="treeview"]`
- Promotional content, feedback widgets, training sections, etc.

**Link following pattern**:
- `a[href*="/documentation/sitefinity-cms"]` - Only follows internal documentation links
- URLs are cleaned (hash/query params removed) for deduplication

### Crawling Flow

1. Start at base URL (Sitefinity CMS documentation home)
2. For each page:
   - **Check for version deduplication**:
     - If URL has version (e.g., `/152/page`), check if canonical already visited
     - Try to fetch canonical URL (without version)
     - If canonical exists, crawl it and skip versioned URL
     - If canonical doesn't exist, crawl versioned URL as exception
   - Wait for network idle (30s timeout with fallback)
   - **Extract breadcrumb** before content extraction (prevents removal)
   - Use `extractPageContent()` to remove excluded elements and extract clean content
   - Use `contentToMarkdown()` to convert HTML to markdown with breadcrumbs
   - Save to `progress/` directory:
     - `{sanitized-url}.json` (metadata with breadcrumb array)
     - `{sanitized-url}.html` (cleaned HTML)
     - `{sanitized-url}.md` (markdown with frontmatter)
   - Collect markdown content for concatenation
   - Extract all documentation links
   - Recursively crawl discovered links (breadth-first)
3. Stop when `maxPages` reached or no more links
4. Generate `_summary.json` and `llms-full.txt` (markdown format)

### Output Structure

```
output/
├── llms-full.txt              # Concatenated markdown for LLM consumption
├── _summary.json              # Crawl statistics and metadata
└── progress/
    ├── *.json                 # Individual page metadata files
    ├── *.md                   # Individual markdown files
    └── *.html                 # Cleaned HTML files
```

Each page creates three files in `progress/`:
- **JSON**: `{ url, title, heading, breadcrumb: [], text, crawledAt }`
- **HTML**: Cleaned HTML content (excluded elements removed)
- **Markdown**: Converted from HTML with frontmatter including:
  - `# Heading`
  - `**URL:** ...`
  - `**Breadcrumb:** Home > Parent > Current Page` (if available)
  - `**Crawled:** ...`
  - `---`
  - Normalized markdown content

Plus root-level files:
- **`_summary.json`**: `{ totalPages, crawledAt, baseUrl, pages[] }`
- **`llms-full.txt`**: All markdown documents concatenated (markdown format, not plain text)

## Configuration Points

### Command-line Configuration

Pass `maxPages` as argument:
```bash
node src/index.mjs 100  # Crawl up to 100 pages
node src/index.mjs      # Crawl all pages (unlimited)
```

### Code Configuration

To modify crawler behavior, edit `src/index.mjs`:
```javascript
const crawler = new SitefinityCrawler({
  outputDir: './output',  // Change output location
  maxPages: Infinity      // Change crawl limit (or pass via CLI)
});
```

To adjust content extraction, edit `DEFAULT_SELECTORS` in `src/crawler.mjs` (around lines 23-92).

To customize Markdown conversion, modify the Turndown options in the `createTurndownService()` function in `src/crawler.mjs` (around lines 98-103).

To change timeouts, modify:
- Browser launch timeout: `src/crawler.mjs` (60s in initialize)
- Network idle timeout: `src/crawler.mjs` (30s in extractPageContent)
- Page goto timeout: `src/crawler.mjs` (60s in crawlPage)

## Troubleshooting

**Selector issues**: Always run `npm run test:sample` first to verify selectors work on the live site before making changes. The sampler uses the exact same extraction code as the main crawler.

**Timeout errors**: Increase timeouts in the three locations mentioned above. The network idle timeout can be safely ignored (has try/catch).

**Missing/wrong content**: The sampler tool shows exactly what will be extracted. If content is missing, adjust `DEFAULT_SELECTORS.mainContent`. If unwanted content appears, add to `DEFAULT_SELECTORS.excludeSelectors`.

**Version deduplication**: Check console logs for messages like "Skipping versioned URL (already crawled canonical)" or "Canonical version exists, crawling...". Run `npm run test:dedup` to verify the version detection logic.

**Type errors**: Run `npm run typecheck` to validate JSDoc type annotations. All functions should have proper type documentation.

## Code Reusability (DRY Principle)

The crawler is designed with modular, reusable functions following the DRY principle:

**Shared utility functions** (exported from `src/crawler.mjs`):
- `extractBreadcrumb()` - Breadcrumb extraction
- `extractPageContent()` - Content extraction with exclusions
- `contentToMarkdown()` - HTML to Markdown conversion with frontmatter
- `normalizeMarkdownWhitespace()` - Whitespace cleanup
- `createTurndownService()` - Turndown service configuration
- `urlToFilename()` - URL to filename conversion
- `savePageContent()` - Unified file saving (JSON, HTML, MD)
- `DEFAULT_SELECTORS` - Shared selector configuration

**Code reuse pattern**: The sampler (`test/sampler.mjs`) imports and uses the exact same functions as the main crawler, ensuring identical behavior and eliminating code duplication. Any changes to extraction logic automatically apply to both the crawler and the sampler.

## Type Safety

This project uses JSDoc annotations for TypeScript type checking without requiring compilation:

- Run `npm run typecheck` to validate types
- All exported functions have complete JSDoc annotations
- Custom types defined: `CrawlerOptions`, `ExtractedContent`
- Playwright types imported for page objects

Example JSDoc pattern:
```javascript
/**
 * Extract content from a page using the provided selectors
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string[]} [excludeSelectors] - Selectors for elements to exclude
 * @returns {Promise<ExtractedContent>}
 */
export async function extractPageContent(page, excludeSelectors = DEFAULT_SELECTORS.excludeSelectors) {
  // ...
}
```
