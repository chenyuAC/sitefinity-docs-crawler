# Sitefinity Documentation Crawler

Playwright-based web crawler for Sitefinity CMS documentation with smart caching and resume capabilities.

## Features

- **Smart Resume** - Caches crawled data, reuses fresh pages (configurable threshold), extracts links from cached HTML to continue crawling
- **Version Deduplication** - Automatically handles versioned URLs (`/152/page`), crawls canonical (latest) version only
- **Breadcrumb Extraction** - Captures hierarchical navigation context
- **Whitespace Normalization** - Clean, optimized markdown output
- Extracts main content while excluding navigation/UI elements
- Saves as JSON (metadata), HTML (cleaned), and Markdown files
- Generates `llms-full.txt` - concatenated markdown for LLM consumption
- Configurable crawl limits (unlimited by default) and cache duration
- ES modules, JSDoc type safety, Node.js test suite

## Installation

```bash
npm install
```

This will install Playwright and its dependencies. Chromium browser will be downloaded automatically.

## Usage

### Run the Crawler

```bash
# Resume with 1-day cache (default)
npm run crawl

# Crawl 100 pages max with 1-day cache
npm run crawl -- 100

# Crawl with 1-hour cache (3600 seconds)
npm run crawl -- 100 3600

# Force re-download everything (no cache)
npm run crawl -- Infinity 0
```

**Arguments:**
- `maxPages`: Number of pages to crawl (default: `Infinity`)
- `staleThreshold`: Seconds before cache is stale (default: `86400` = 1 day, `0` = no cache)

**Behavior:**
- Loads cached progress from `./output/progress/`
- Reuses fresh cached pages (based on `crawledAt` timestamp)
- Extracts links from cached HTML to discover new pages
- Re-downloads stale or missing pages
- Saves output to `./output/` directory

### Run Tests

```bash
# Run all tests
npm test

# Run only the sampler test
npm run test:sample

# Run version deduplication tests
npm run test:dedup
```

**Sampler test** - Tests the crawler's extraction logic on sample pages:
- Runs headless browser
- Tests content selectors
- Shows which elements are excluded
- Displays sample extracted content
- Generates output files (JSON, HTML, MD) in `progress/` directory

The sampler is useful for:
- Debugging selector issues
- Understanding the page structure
- Verifying content extraction quality
- Testing before running a full crawl

### Type Check

To validate the JavaScript code with TypeScript:

```bash
npm run typecheck
```

This will check all `.mjs` files for type errors using TypeScript's type checker with JSDoc annotations.

## Configuration

### CLI Arguments

```bash
npm run crawl -- <maxPages> <staleThreshold>
```
- `maxPages`: Number of pages (default: `Infinity`)
- `staleThreshold`: Cache lifetime in seconds (default: `86400` = 1 day, `0` = no cache)

### Code Configuration

Edit [src/index.mjs](src/index.mjs):

```javascript
const crawler = new SitefinityCrawler({
  outputDir: './output',
  maxPages: Infinity,
  staleThreshold: 86400  // 1 day
});
```

### Selector Configuration

The crawler uses these selectors (defined in [src/crawler.mjs:14-36](src/crawler.mjs#L14-L36)):

**Main Content:**
- `article`, `.main-content`, `[role="main"]`, `.content-area`

**Excluded Elements:**
- Navigation: `nav`, `.navbar`, `.breadcrumb`
- Sidebars: `.sidebar`, `#kendonav`, `#navContainer`
- UI Controls: `#sfVersionSelector`, `.k-treeview`, `[data-role="treeview"]`
- Standard elements: `header`, `footer`

## Output Structure

```
output/
├── llms-full.txt              # Concatenated markdown for LLM consumption
├── _summary.json              # Crawl statistics and metadata
└── progress/
    ├── *.json                 # Individual page metadata files
    ├── *.md                   # Individual markdown files
    └── *.html                 # Cleaned HTML files
```

### JSON File (metadata + text)
```json
{
  "url": "https://www.progress.com/documentation/sitefinity-cms/...",
  "title": "Page Title",
  "heading": "Main Heading",
  "breadcrumb": ["Home", "Parent", "Current Page"],
  "text": "Extracted text content...",
  "crawledAt": "2025-10-29T..."
}
```

### Markdown File (with frontmatter)
```markdown
# Page Title

**URL:** https://www.progress.com/documentation/sitefinity-cms/...
**Breadcrumb:** Home > Parent > Current Page
**Crawled:** 2025-10-29T...

---

[cleaned markdown content...]
```

### HTML File (cleaned content)
The extracted HTML content after removing excluded elements.

### Summary File
`_summary.json` contains crawl statistics:
```json
{
  "totalPages": 150,
  "cachedPages": 120,
  "newlyFetchedPages": 30,
  "crawledAt": "2025-10-29T...",
  "baseUrl": "https://www.progress.com/documentation/sitefinity-cms",
  "pages": ["array of crawled URLs"]
}
```

### LLM-Optimized Output
`llms-full.txt` contains all pages concatenated with cache statistics and clean, normalized whitespace
- Breadcrumb navigation for context
- Structured frontmatter
- Document separators

## Project Structure

```
sitefinity-docs-crawler/
├── src/
│   ├── crawler.mjs     # Core crawler module with reusable functions
│   └── index.mjs       # Entry point with CLI argument parsing
├── test/
│   ├── sampler.mjs                      # Selector testing tool
│   ├── version-dedup-test.mjs           # Version deduplication tests
│   ├── breadcrumb-test.mjs              # Breadcrumb extraction tests
│   └── whitespace-normalization-test.mjs # Whitespace tests
├── output/             # Crawled content (generated)
│   ├── llms-full.txt   # Concatenated markdown for LLMs
│   ├── _summary.json   # Crawl statistics
│   └── progress/       # Individual page files (JSON, HTML, MD)
├── package.json        # Project configuration (ES modules)
├── tsconfig.json       # TypeScript configuration for type checking
├── CLAUDE.md           # AI assistant guidance
├── README.md           # Documentation
└── .gitignore          # Git ignore rules
```

## How It Works

1. **Load Cache**: Scans `output/progress/`, loads fresh cached pages (based on `crawledAt` vs `staleThreshold`)
2. **Initialize**: Launches Chromium browser, marks cached URLs as visited
3. **For Each URL**:
   - **If cached (fresh)**: Load from disk, extract links from HTML, skip network request
   - **If uncached/stale**: Fetch from network, extract content, save files
   - **Version dedup**: Prefer canonical URL over versioned URL
4. **Content Extraction** (for uncached pages):
   - Extract breadcrumb navigation
   - Remove excluded elements (nav, footer, etc.)
   - Extract main content, normalize whitespace
5. **File Saving**: JSON (metadata), HTML (cleaned), Markdown (with frontmatter) in `progress/`
6. **Link Discovery**: Extract documentation links (from live page or cached HTML)
7. **Recursive Crawl**: Follow discovered links until max pages or no more links
8. **Cleanup**: Generate summary with cache stats and `llms-full.txt`, close browser

## Advanced Usage

### Programmatic Usage

```javascript
import { SitefinityCrawler } from './src/crawler.mjs';

const crawler = new SitefinityCrawler({
  outputDir: './custom-output',
  maxPages: 100
});

await crawler.run();
```

### Custom Selectors

Modify the `selectors` object in [src/crawler.mjs:14-36](src/crawler.mjs#L14-L36) to adjust content extraction:

```javascript
this.selectors = {
  mainContent: 'your-custom-selector',
  excludeSelectors: ['custom-nav', '.custom-sidebar'],
  documentationLinks: 'a[href*="/your-pattern"]'
};
```

## Troubleshooting

### Timeout Errors
If pages are slow to load, increase timeout in [src/crawler.mjs:122-125](src/crawler.mjs#L122-L125):
```javascript
await page.goto(url, {
  waitUntil: 'domcontentloaded',
  timeout: 120000  // Increase to 2 minutes
});
```

### Missing Content
Run the sampler to verify selectors are working:
```bash
npm run test:sample
```

### Too Many/Few Pages
Adjust `maxPages` parameter in [src/index.mjs](src/index.mjs).

### ES Module Issues
This project uses ES modules with `.mjs` extensions (`"type": "module"` in package.json). Make sure:
- Use `.mjs` extensions in imports
- Use `import/export` instead of `require/module.exports`
- Node.js version 14+ is recommended

## License

ISC
