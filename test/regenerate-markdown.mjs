import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createTurndownService,
  contentToMarkdown,
  normalizeMarkdownWhitespace
} from '../src/crawler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Regenerate all markdown files from existing JSON and HTML files
 * This is useful when you've changed the markdown template and want to update all files
 */
async function regenerateMarkdown() {
  console.log('🔄 Regenerating markdown files from JSON and HTML...\n');

  const outputDir = path.join(__dirname, '..', 'output');
  const progressDir = path.join(outputDir, 'progress');

  if (!fs.existsSync(progressDir)) {
    console.error('❌ Error: No progress directory found at:', progressDir);
    console.log('   Run the crawler first to generate content.');
    process.exit(1);
  }

  // Find all JSON files (excluding redirects and summary)
  const jsonFiles = fs.readdirSync(progressDir)
    .filter(f => f.endsWith('.json') && !f.endsWith('.redirect.json') && f !== '_summary.json')
    .sort();

  if (jsonFiles.length === 0) {
    console.error('❌ Error: No JSON files found in progress directory');
    process.exit(1);
  }

  console.log(`Found ${jsonFiles.length} pages to regenerate\n`);

  const turndownService = createTurndownService();
  const allMarkdownContent = [];
  let successCount = 0;
  let errorCount = 0;

  for (const jsonFile of jsonFiles) {
    const jsonPath = path.join(progressDir, jsonFile);
    const htmlPath = jsonPath.replace('.json', '.html');
    const mdPath = jsonPath.replace('.json', '.md');

    try {
      // Check if HTML file exists
      if (!fs.existsSync(htmlPath)) {
        console.error(`⚠️  Skipping ${jsonFile}: HTML file not found`);
        errorCount++;
        continue;
      }

      // Read JSON metadata
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

      // Read HTML content
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

      // Create content object for markdown conversion
      const content = {
        url: jsonData.url,
        title: jsonData.title,
        heading: jsonData.heading,
        breadcrumb: jsonData.breadcrumb || [],
        html: htmlContent,
        text: jsonData.text || ''
      };

      // Convert to markdown using the shared function
      const markdownDoc = contentToMarkdown(content, turndownService);

      // Save markdown file
      fs.writeFileSync(mdPath, markdownDoc);

      // Collect for concatenated output
      allMarkdownContent.push(markdownDoc);

      successCount++;
      if (successCount % 100 === 0) {
        console.log(`✓ Processed ${successCount}/${jsonFiles.length} files...`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error processing ${jsonFile}:`, errorMessage);
      errorCount++;
    }
  }

  console.log(`\n✓ Regenerated ${successCount} markdown files`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} files had errors`);
  }

  // Regenerate llms-full.txt
  console.log('\n📝 Generating llms-full.txt...');

  const totalPages = successCount;
  const markdownOutput = [
    '# Sitefinity CMS Documentation',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Total Pages:** ${totalPages}`,
    `**Regenerated from cache:** true`,
    '',
    '---',
    '',
    ...allMarkdownContent.map(md => `\n\n${md}`)
  ].join('\n');

  const outputFilepath = path.join(outputDir, 'llms-full.txt');
  fs.writeFileSync(outputFilepath, markdownOutput);

  console.log(`✓ Generated ${outputFilepath}`);
  console.log(`✓ Total size: ${(markdownOutput.length / 1024 / 1024).toFixed(2)} MB`);

  console.log('\n✅ All done!');
  console.log(`\nRegenerated files:`);
  console.log(`  - ${successCount} individual markdown files in ${progressDir}/`);
  console.log(`  - ${outputFilepath}`);
}

// Run the regeneration
regenerateMarkdown().catch(error => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('❌ Fatal error:', errorMessage);
  process.exit(1);
});
