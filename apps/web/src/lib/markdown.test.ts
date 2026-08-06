import type { WindowLike } from 'dompurify';
import { JSDOM } from 'jsdom';
import { describe, expect, test } from 'vitest';
import { renderMarkdown } from './markdown';

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
});
