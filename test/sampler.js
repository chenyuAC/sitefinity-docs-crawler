import { chromium } from 'playwright';

/**
 * Sampler script to test and analyze selector strategies
 * for the Sitefinity documentation site
 */
async function sampleSelectors() {
  console.log('🔍 Sitefinity Documentation Selector Sampler\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 }
  });

  const url = 'https://www.progress.com/documentation/sitefinity-cms';
  console.log(`Navigating to: ${url}\n`);

  await page.goto(url, { waitUntil: 'networkidle' });

  // Sample different selectors
  const selectorTests = [
    {
      name: 'Article tag',
      selector: 'article',
      description: 'Standard HTML5 article element'
    },
    {
      name: 'Main content',
      selector: '.main-content, [role="main"]',
      description: 'Common main content containers'
    },
    {
      name: 'Content area',
      selector: '.content-area, .content, #content',
      description: 'Generic content area classes'
    },
    {
      name: 'Body (full page)',
      selector: 'body',
      description: 'Entire page body'
    }
  ];

  console.log('Testing Content Selectors:\n');
  console.log('='.repeat(80));

  for (const test of selectorTests) {
    const result = await page.evaluate((sel) => {
      const elements = document.querySelectorAll(sel);
      if (elements.length === 0) return null;

      const element = elements[0];
      const text = element.innerText || '';
      const html = element.innerHTML || '';

      return {
        found: true,
        count: elements.length,
        textLength: text.length,
        htmlLength: html.length,
        preview: text.substring(0, 200).replace(/\n/g, ' ')
      };
    }, test.selector);

    console.log(`\n📌 ${test.name}`);
    console.log(`   Selector: ${test.selector}`);
    console.log(`   Description: ${test.description}`);

    if (result) {
      console.log(`   ✓ Found: ${result.count} element(s)`);
      console.log(`   ✓ Text length: ${result.textLength} chars`);
      console.log(`   ✓ HTML length: ${result.htmlLength} chars`);
      console.log(`   Preview: "${result.preview}..."`);
    } else {
      console.log(`   ✗ Not found`);
    }
  }

  // Test exclusion selectors
  console.log('\n\n' + '='.repeat(80));
  console.log('Testing Exclusion Selectors (elements to remove):\n');

  const exclusionTests = [
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
  ];

  for (const selector of exclusionTests) {
    const count = await page.evaluate((sel) => {
      return document.querySelectorAll(sel).length;
    }, selector);

    const status = count > 0 ? '✓' : '✗';
    console.log(`${status} ${selector.padEnd(30)} - ${count} element(s)`);
  }

  // Analyze page structure
  console.log('\n\n' + '='.repeat(80));
  console.log('Page Structure Analysis:\n');

  const structure = await page.evaluate(() => {
    return {
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() || 'None',
      h2Count: document.querySelectorAll('h2').length,
      linkCount: document.querySelectorAll('a').length,
      docLinks: document.querySelectorAll('a[href*="/documentation/sitefinity-cms"]').length,
      hasArticle: !!document.querySelector('article'),
      hasMain: !!document.querySelector('main, [role="main"]'),
      bodyClasses: document.body.className,
      bodyTextLength: document.body.innerText.length
    };
  });

  console.log(`Title: ${structure.title}`);
  console.log(`H1: ${structure.h1}`);
  console.log(`H2 count: ${structure.h2Count}`);
  console.log(`Total links: ${structure.linkCount}`);
  console.log(`Documentation links: ${structure.docLinks}`);
  console.log(`Has <article> tag: ${structure.hasArticle}`);
  console.log(`Has <main> or [role="main"]: ${structure.hasMain}`);
  console.log(`Body classes: ${structure.bodyClasses || 'None'}`);
  console.log(`Body text length: ${structure.bodyTextLength} chars`);

  // Sample content extraction with exclusions
  console.log('\n\n' + '='.repeat(80));
  console.log('Sample Content Extraction (with exclusions):\n');

  const extractedContent = await page.evaluate(() => {
    // Clone body
    const bodyClone = document.body.cloneNode(true);

    // Remove unwanted elements
    const excludeSelectors = [
      'nav', 'header', 'footer', '.navbar', '.sidebar',
      '#kendonav', '#navContainer', '#sfVersionSelector',
      '.breadcrumb', '.k-treeview', '[data-role="treeview"]'
    ];

    excludeSelectors.forEach(sel => {
      bodyClone.querySelectorAll(sel).forEach(el => el.remove());
    });

    const text = bodyClone.innerText || '';
    return {
      textLength: text.length,
      preview: text.substring(0, 500).trim()
    };
  });

  console.log(`Extracted text length: ${extractedContent.textLength} chars`);
  console.log(`\nPreview:\n${'─'.repeat(80)}`);
  console.log(extractedContent.preview);
  console.log('─'.repeat(80));

  // Extract sample links
  console.log('\n\n' + '='.repeat(80));
  console.log('Sample Documentation Links (first 10):\n');

  const sampleLinks = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/documentation/sitefinity-cms"]');
    const urls = [];

    for (let i = 0; i < Math.min(10, links.length); i++) {
      urls.push({
        text: links[i].textContent?.trim() || '',
        href: links[i].href
      });
    }

    return urls;
  });

  sampleLinks.forEach((link, i) => {
    console.log(`${i + 1}. ${link.text}`);
    console.log(`   ${link.href}\n`);
  });

  console.log('\n✓ Sampling complete! Press Ctrl+C to exit or browser will close in 10 seconds...');

  await page.waitForTimeout(10000);
  await browser.close();
}

// Run sampler
sampleSelectors().catch(console.error);
