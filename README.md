# Sitefinity Documentation Crawler

A Playwright-based web crawler for extracting content from the Sitefinity CMS documentation website. Built with ES modules and organized following best practices.

## Features

- Crawls documentation pages from https://www.progress.com/documentation/sitefinity-cms
- **Smart version deduplication** - Automatically detects and handles versioned URLs (e.g., `/152/page` vs `/page`)
- **Breadcrumb extraction** - Captures hierarchical navigation for better organization
- **Whitespace normalization** - Clean, optimized markdown output
- Extracts main content while excluding navigation, headers, footers, and sidebars
- Saves content as JSON (metadata), HTML (cleaned), and Markdown files
- Generates `llms-full.txt` - concatenated markdown optimized for LLM consumption
- Respects documentation structure and follows internal links
- Configurable crawl limits (unlimited by default) and output directories
- ES modules for modern JavaScript support
- Comprehensive test suite with Node.js test runner

## Installation

```bash
npm install
```

This will install Playwright and its dependencies. Chromium browser will be downloaded automatically.

## Usage

### Run the Crawler

To start crawling the Sitefinity documentation:

```bash
# Crawl all pages (unlimited)
npm run crawl

# Crawl up to 100 pages
npm run crawl -- 100

# Crawl up to 50 pages
npm run crawl -- 50
```

By default (no arguments), it will:
- Start from the main documentation page
- Crawl **all pages** (unlimited)
- Save output to the `./output` directory
- Save each page as JSON (content + metadata), HTML (cleaned content), and Markdown
- Generate `llms-full.txt` - a concatenated markdown file optimized for LLM consumption

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

### Command-Line Configuration

Pass `maxPages` as a command-line argument:

```bash
npm run crawl          # Unlimited pages (default)
npm run crawl -- 100   # Limit to 100 pages
npm run crawl -- 50    # Limit to 50 pages
```

### Code Configuration

Edit [src/index.mjs](src/index.mjs) to customize crawler settings:

```javascript
const crawler = new SitefinityCrawler({
  outputDir: './output',  // Where to save files
  maxPages: Infinity      // Maximum pages to crawl (can be overridden by CLI arg)
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
  "crawledAt": "2025-10-29T...",
  "baseUrl": "https://www.progress.com/documentation/sitefinity-cms",
  "pages": ["array of crawled URLs"]
}
```

### LLM-Optimized Output
`llms-full.txt` contains all pages concatenated in markdown format with:
- Clean, normalized whitespace
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

1. **Initialization**: Launches Chromium browser with Playwright
2. **Navigation**: Starts from the base documentation URL
3. **Version Deduplication** (for each discovered URL):
   - Detects if URL contains a version number (e.g., `/152/page`)
   - If versioned, attempts to fetch canonical (non-versioned) URL first
   - Crawls canonical if it exists, otherwise crawls the versioned URL as exception
   - Marks both canonical and versioned URLs as visited to prevent duplicates
4. **Content Extraction**:
   - Extracts breadcrumb navigation before processing
   - Waits for page to load
   - Removes excluded elements (nav, footer, etc.)
   - Extracts main content area
   - Normalizes whitespace in markdown output
5. **File Saving** (in `progress/` directory):
   - **JSON**: Structured metadata with breadcrumb array
   - **HTML**: Cleaned HTML content
   - **Markdown**: Frontmatter + normalized content
6. **Link Discovery**: Finds all internal documentation links
7. **Recursive Crawling**: Follows discovered links until max pages reached
8. **Cleanup**: Generates summary and `llms-full.txt` concatenated file, closes browser

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
