# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Playwright-based web crawler for extracting content from the Sitefinity CMS documentation website (https://www.progress.com/documentation/sitefinity-cms). The crawler recursively follows documentation links, extracts main content while filtering out navigation/UI elements, and saves the results as JSON (structured metadata + text), HTML, and Markdown files. It also generates concatenated outputs (`llms-full.txt` and `llms-full.md`) for LLM consumption.

## ES Modules

This project uses ES modules (`"type": "module"` in package.json):
- All imports must use `.mjs` or `.js` extensions: `import { SitefinityCrawler } from './crawler.mjs'`
- Use `import/export` syntax (not `require/module.exports`)
- Node.js 14+ is required

## Commands

### Run the crawler
```bash
npm run crawl
```
Executes `src/index.mjs` which crawls up to 50 pages (default) and saves output to `./output` directory.

### Run the selector sampler/tester
```bash
npm run test:sample
```
Tests the crawler's extraction logic on sample pages (headless). Use this to:
- Debug selector issues
- Verify what content gets extracted vs excluded
- Preview the output format (JSON, HTML, Markdown, and concatenated files)
- Test changes before running a full crawl

## Architecture

### Core Components

**`src/crawler.mjs`** - Core crawler module
- Exports reusable extraction functions and the `SitefinityCrawler` class
- **Exported functions** (used by sampler and main crawler):
  - `extractPageContent(page, excludeSelectors)` - Extracts content from a page with element exclusion
  - `contentToMarkdown(content, turndownService)` - Converts extracted content to markdown with frontmatter
  - `createTurndownService()` - Creates a configured Turndown service instance
  - `DEFAULT_SELECTORS` - Default selectors for content extraction
- **`SitefinityCrawler` class**:
  - `initialize()` - Creates output directory and launches headless Chromium
  - `crawlPage(url)` - Recursive crawler that visits pages, extracts content, and follows links
  - `extractContent(page, url)` - Wrapper that calls `extractPageContent()`
  - `extractLinks(page)` - Finds documentation links to crawl
  - `saveContent(content)` - Writes JSON, HTML, and Markdown files; collects content for concatenation
  - `close()` - Closes browser and generates summary plus concatenated file (`llms-full.txt` in markdown format)
  - `run()` - Main entry point that orchestrates the crawl

**`src/index.mjs`** - Entry point
- Creates a `SitefinityCrawler` instance with configuration
- Default: 50 max pages, `./output` directory

**`test/sampler.mjs`** - Selector testing tool
- **Imports and uses the crawler's extraction functions directly** (true code reuse)
- Tests on sample URLs to verify output quality
- Generates sample outputs: individual Markdown files and concatenated `llms-full.txt`
- Useful for validating changes before running full crawl

### Selector Strategy

The crawler's effectiveness depends on its CSS selectors (defined in `src/crawler.mjs` constructor):

**Main content extraction** (first match wins):
- `article`, `.main-content`, `[role="main"]`, `.content-area`

**Elements to exclude** (Sitefinity-specific):
- Navigation: `nav`, `header`, `footer`, `.navbar`, `.breadcrumb`
- Sidebars: `.sidebar`, `#kendonav`, `#navContainer`
- UI controls: `#sfVersionSelector`, `.k-treeview`, `[data-role="treeview"]`

**Link following pattern**:
- `a[href*="/documentation/sitefinity-cms"]` - Only follows internal documentation links
- URLs are cleaned (hash/query params removed) for deduplication

### Crawling Flow

1. Start at base URL (Sitefinity CMS documentation home)
2. For each page:
   - Wait for network idle (30s timeout with fallback)
   - Use `extractPageContent()` to remove excluded elements and extract clean content
   - Use `contentToMarkdown()` to convert HTML to markdown
   - Save as `{sanitized-url}.json`, `{sanitized-url}.html`, and `{sanitized-url}.md`
   - Collect markdown content for concatenation
   - Extract all documentation links
   - Recursively crawl discovered links (breadth-first)
3. Stop when `maxPages` reached or no more links
4. Generate `_summary.json` and `llms-full.txt` (markdown format)

### Output Structure

Each page creates three files:
- **JSON**: `{ url, title, heading, text, crawledAt }`
- **HTML**: Cleaned HTML content (excluded elements removed)
- **Markdown**: Converted from HTML with frontmatter (URL, title, heading)

Plus summary and concatenated file:
- **`_summary.json`**: `{ totalPages, crawledAt, baseUrl, pages[] }`
- **`llms-full.txt`**: All Markdown documents concatenated with proper structure (markdown format, not plain text)

## Configuration Points

To modify crawler behavior, edit `src/index.mjs`:
```javascript
const crawler = new SitefinityCrawler({
  outputDir: './output',  // Change output location
  maxPages: 50            // Change crawl limit
});
```

To adjust content extraction, edit `DEFAULT_SELECTORS` in `src/crawler.mjs` (around lines 24-45).

To customize Markdown conversion, modify the Turndown options in the `createTurndownService()` function in `src/crawler.mjs` (around lines 51-55).

To change timeouts, modify:
- Browser launch timeout: `src/crawler.mjs` (60s in browser launch)
- Network idle timeout: `src/crawler.mjs` (30s in extractContent)
- Page goto timeout: `src/crawler.mjs` (60s in crawlPage)

## Troubleshooting

**Selector issues**: Always run `npm run test:sample` first to verify selectors work on the live site before making changes. The sampler uses the exact same extraction code as the main crawler.

**Timeout errors**: Increase timeouts in the three locations mentioned above. The network idle timeout can be safely ignored (has try/catch).

**Missing/wrong content**: The sampler tool shows exactly what will be extracted. If content is missing, adjust `DEFAULT_SELECTORS.mainContent`. If unwanted content appears, add to `DEFAULT_SELECTORS.excludeSelectors`.

## Code Reusability

The crawler is designed with modular, reusable functions:
- `extractPageContent()` - Can be imported and used independently for content extraction
- `contentToMarkdown()` - Can be imported for HTML to Markdown conversion
- `createTurndownService()` - Provides consistent Turndown configuration
- `DEFAULT_SELECTORS` - Shared selector configuration

The sampler demonstrates this by importing and using these functions directly, ensuring it tests the exact same logic as the main crawler.
