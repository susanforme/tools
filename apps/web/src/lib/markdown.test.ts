import type { WindowLike } from 'dompurify';
import { JSDOM } from 'jsdom';
import { describe, expect, test } from 'vitest';
import { markdownToToc, renderMarkdown } from './markdown';

describe('Markdown preview', () => {
  test('renders GFM and removes executable HTML', () => {
    const html = renderMarkdown(
      '| A | B |\n| - | - |\n| 1 | 2 |\n\n<img src=x onerror="alert(1)"><script>alert(1)</script>',
      new JSDOM('').window as unknown as WindowLike,
    );

    expect(html).toContain('<table>');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
  });

  test('builds a deduplicated Markdown table of contents', () => {
    expect(markdownToToc('# API\n## Users\n## Users')).toBe(
      '- [API](#api)\n  - [Users](#users)\n  - [Users](#users-1)',
    );
  });
});
