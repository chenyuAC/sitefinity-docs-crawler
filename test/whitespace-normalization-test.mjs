/**
 * Test whitespace normalization in markdown output
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeMarkdownWhitespace } from '../src/crawler.mjs';

test('Whitespace normalization - removes excessive blank lines', () => {
  const input = `Line 1


Line 2




Line 3`;

  const expected = `Line 1

Line 2

Line 3`;

  assert.strictEqual(
    normalizeMarkdownWhitespace(input),
    expected,
    'Should reduce 3+ consecutive newlines to max 2'
  );
});

test('Whitespace normalization - trims trailing whitespace from lines', () => {
  const input = `Line 1   \nLine 2\t\t\nLine 3     `;
  const expected = `Line 1\nLine 2\nLine 3`;

  assert.strictEqual(
    normalizeMarkdownWhitespace(input),
    expected,
    'Should remove trailing whitespace from each line'
  );
});

test('Whitespace normalization - trims document edges', () => {
  const input = `\n\n  Line 1\n  Line 2\n\n`;
  const expected = `Line 1\n  Line 2`;

  assert.strictEqual(
    normalizeMarkdownWhitespace(input),
    expected,
    'Should trim leading/trailing whitespace from document but preserve indentation'
  );
});

test('Whitespace normalization - preserves intentional indentation', () => {
  const input = `# Heading\n\n  - Indented item\n    - More indented`;
  const expected = `# Heading\n\n  - Indented item\n    - More indented`;

  assert.strictEqual(
    normalizeMarkdownWhitespace(input),
    expected,
    'Should preserve leading whitespace (indentation) within lines'
  );
});

test('Whitespace normalization - handles complex case', () => {
  const input = `

Title


Paragraph 1



Paragraph 2



End

`;

  const expected = `Title

Paragraph 1

Paragraph 2

End`;

  assert.strictEqual(
    normalizeMarkdownWhitespace(input),
    expected,
    'Should handle complex whitespace patterns'
  );
});

test('Whitespace normalization - preserves code blocks', () => {
  const input = `Text\n\n\`\`\`\ncode line 1\n\n\ncode line 2\n\`\`\`\n\n\nMore text`;
  const expected = `Text\n\n\`\`\`\ncode line 1\n\ncode line 2\n\`\`\`\n\nMore text`;

  assert.strictEqual(
    normalizeMarkdownWhitespace(input),
    expected,
    'Should normalize whitespace even within code blocks'
  );
});
