# Sitefinity Documentation Crawler

A Playwright-based web crawler for extracting content from the Sitefinity CMS documentation website. Built with ES modules and organized following best practices.

## Features

- Crawls documentation pages from https://www.progress.com/documentation/sitefinity-cms
- Extracts main content while excluding navigation, headers, footers, and sidebars
- Saves content as both JSON and HTML files
- Respects documentation structure and follows internal links
- Configurable crawl limits and output directories
- ES modules for modern JavaScript support

## Installation

```bash
npm install
```

This will install Playwright and its dependencies. Chromium browser will be downloaded automatically.

## Usage

### Run the Crawler

To start crawling the Sitefinity documentation:

```bash
npm run crawl
```

By default, it will:
- Start from the main documentation page
- Crawl up to 50 pages (configurable)
- Save output to the `./output` directory
- Save each page as JSON (content + metadata) and HTML (raw content)

### Run the Sampler (Test)

To test and analyze the selector strategy on the documentation site:

```bash
npm run test:sample
```

This will:
- Open a browser window (headless: false)
- Test various content selectors
- Show which elements would be excluded
- Display sample extracted content
- List sample documentation links

The sampler is useful for:
- Debugging selector issues
- Understanding the page structure
- Verifying content extraction quality
- Testing before running a full crawl

## Configuration

Edit [src/index.js](src/index.js) to customize crawler settings:

```javascript
const crawler = new SitefinityCrawler({
  outputDir: './output',  // Where to save files
  maxPages: 50            // Maximum pages to crawl
});
```

### Selector Configuration

The crawler uses these selectors (defined in [src/crawler.js:14-36](src/crawler.js#L14-L36)):

**Main Content:**
- `article`, `.main-content`, `[role="main"]`, `.content-area`

**Excluded Elements:**
- Navigation: `nav`, `.navbar`, `.breadcrumb`
- Sidebars: `.sidebar`, `#kendonav`, `#navContainer`
- UI Controls: `#sfVersionSelector`, `.k-treeview`, `[data-role="treeview"]`
- Standard elements: `header`, `footer`

## Output Structure

Each crawled page generates two files:

### JSON File (metadata + text)
```json
{
  "url": "https://www.progress.com/documentation/sitefinity-cms/...",
  "title": "Page Title",
  "heading": "Main Heading",
  "text": "Extracted text content...",
  "crawledAt": "2025-10-29T..."
}
```

### HTML File (raw content)
The extracted HTML content after removing excluded elements.

### Summary File
`_summary.json` contains crawl statistics:
```json
{
  "totalPages": 50,
  "crawledAt": "2025-10-29T...",
  "baseUrl": "https://www.progress.com/documentation/sitefinity-cms",
  "pages": ["array of crawled URLs"]
}
```

## Project Structure

```
sitefinity-docs-crawler/
├── src/
│   ├── crawler.js      # Main crawler class
│   └── index.js        # Entry point
├── test/
│   └── sampler.js      # Selector testing tool
├── output/             # Crawled content (generated)
├── package.json        # Project configuration (ES modules)
├── README.md          # Documentation
└── .gitignore         # Git ignore rules
```

## How It Works

1. **Initialization**: Launches Chromium browser with Playwright
2. **Navigation**: Starts from the base documentation URL
3. **Content Extraction**:
   - Waits for page to load
   - Removes excluded elements (nav, footer, etc.)
   - Extracts main content area
   - Saves both structured data (JSON) and raw HTML
4. **Link Discovery**: Finds all internal documentation links
5. **Recursive Crawling**: Follows discovered links until max pages reached
6. **Cleanup**: Generates summary and closes browser

## Advanced Usage

### Programmatic Usage

```javascript
import { SitefinityCrawler } from './src/crawler.js';

const crawler = new SitefinityCrawler({
  outputDir: './custom-output',
  maxPages: 100
});

await crawler.run();
```

### Custom Selectors

Modify the `selectors` object in [src/crawler.js:14-36](src/crawler.js#L14-L36) to adjust content extraction:

```javascript
this.selectors = {
  mainContent: 'your-custom-selector',
  excludeSelectors: ['custom-nav', '.custom-sidebar'],
  documentationLinks: 'a[href*="/your-pattern"]'
};
```

## Troubleshooting

### Timeout Errors
If pages are slow to load, increase timeout in [src/crawler.js:122-125](src/crawler.js#L122-L125):
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
Adjust `maxPages` parameter in [src/index.js](src/index.js).

### ES Module Issues
This project uses ES modules (`"type": "module"` in package.json). Make sure:
- Use `.js` extensions in imports
- Use `import/export` instead of `require/module.exports`
- Node.js version 14+ is recommended

## License

ISC
