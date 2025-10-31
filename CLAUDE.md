# CLAUDE.md

AI assistant guidance for this Sitefinity CMS documentation crawler.

## Project Overview

Playwright-based web crawler that extracts Sitefinity CMS documentation, saves as JSON/HTML/Markdown, and generates `llms-full.txt` for LLM consumption.

### Key Features

- **Smart Resume** - Caches crawled data, reuses fresh pages (default: 1 day), continues crawling from cached HTML links
- **Version Deduplication** - Detects versioned URLs (`/152/page`), crawls only canonical (latest) version
- **Breadcrumb Extraction** - Captures hierarchical navigation context
- **Whitespace Normalization** - Clean, optimized markdown output
- **Unlimited Crawling** - Configurable via CLI (default: unlimited)
- **Full Test Suite** - Node.js test runner with type checking

## ES Modules

This project uses ES modules (`"type": "module"` in package.json):
- All imports must use `.mjs` or `.js` extensions: `import { SitefinityCrawler } from './crawler.mjs'`
- Use `import/export` syntax (not `require/module.exports`)
- Node.js 14+ is required

## Commands

### Run the crawler
```bash
# Crawl all pages with 1-day cache (resumes from previous crawl)
npm run crawl

# Crawl 100 pages max with 1-day cache
npm run crawl -- 100

# Crawl 100 pages with 1-hour cache
npm run crawl -- 100 3600

# Force re-download everything (no cache)
npm run crawl -- Infinity 0
```
Arguments: `maxPages` (default: Infinity), `staleThreshold` in seconds (default: 86400 = 1 day, 0 = no cache)

### Regenerate markdown files
```bash
# Regenerate all .md files and llms-full.txt from cached JSON/HTML
npm run regenerate
```
This is useful after changing the markdown template (e.g., removing `**Crawled:**` timestamps). It rebuilds all markdown files from existing JSON and HTML cache without re-crawling.

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

**`SitefinityCrawler` class** key methods:
- `loadCachedProgress()` - Loads cached progress files, checks `crawledAt` timestamp against `staleThreshold`, marks fresh pages as visited
- `extractLinksFromHtml(html, baseUrl)` - Extracts documentation links from cached HTML (no network request)
- `crawlPage(url)` - Recursive crawler with smart caching and version deduplication:
  - Checks for fresh cached data, reuses if available
  - Extracts links from cached HTML to continue crawling
  - For stale/uncached pages: fetches from network
  - For versioned URLs: attempts canonical first, falls back to versioned
- `close()` - Generates summary with cache stats (`cachedPages`, `newlyFetchedPages`) and concatenated `llms-full.txt`

**`src/index.mjs`** - Entry point
- CLI args: `maxPages` (default: Infinity), `staleThreshold` in seconds (default: 86400)
- Creates `SitefinityCrawler` with options, runs crawl

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

1. **Initialization**: Load cached progress files, check `crawledAt` timestamp, mark fresh pages as visited
2. **For each page**:
   - **Cached (fresh)**: Load from disk, extract links from HTML, continue crawling
   - **Uncached/stale**: Fetch from network, extract content, save files, extract links
   - **Version dedup**: If versioned URL, try canonical first, fallback to versioned
   - Save to `progress/`: `{url}.json`, `{url}.html`, `{url}.md` (with breadcrumbs)
3. **Stop**: When `maxPages` reached or no more links
4. **Close**: Generate `_summary.json` (with cache stats) and `llms-full.txt`

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
- **`_summary.json`**: `{ totalPages, cachedPages, newlyFetchedPages, crawledAt, baseUrl, pages[] }`
- **`llms-full.txt`**: All markdown documents concatenated with cache statistics

## Configuration

### CLI Arguments
```bash
node src/index.mjs <maxPages> <staleThreshold>
# maxPages: Infinity (default) or number
# staleThreshold: 86400 (1 day, default), 0 (no cache), 604800 (1 week)
```

### Code Options
```javascript
new SitefinityCrawler({
  outputDir: './output',
  maxPages: Infinity,
  staleThreshold: 86400  // seconds
});
```

### Advanced Configuration
- **Selectors**: Edit `DEFAULT_SELECTORS` in [src/crawler.mjs](src/crawler.mjs#L25-L94)
- **Markdown**: Modify `createTurndownService()` in [src/crawler.mjs](src/crawler.mjs#L100-L105)
- **Timeouts**: Browser (60s), network idle (30s), page goto (60s) in [src/crawler.mjs](src/crawler.mjs)

## Troubleshooting

- **Stale cache**: If seeing outdated content, reduce `staleThreshold` or set to 0 to force re-download
- **Selectors**: Run `npm run test:sample` to verify extraction before making changes
- **Missing content**: Adjust `DEFAULT_SELECTORS.mainContent` or `.excludeSelectors`
- **Version dedup**: Check console logs for "Skipping versioned URL" or "Canonical version exists"
- **Type errors**: Run `npm run typecheck` to validate JSDoc annotations
- **Resume issues**: Delete `output/progress/` to force fresh crawl

## Code Design

**DRY Principle**: Shared utility functions exported from `src/crawler.mjs` are reused by both main crawler and test sampler. Changes to extraction logic apply everywhere automatically.

**Type Safety**: JSDoc annotations provide TypeScript checking without compilation. Run `npm run typecheck` to validate. Custom types: `CrawlerOptions`, `ExtractedContent`, `CachedPageData`.
