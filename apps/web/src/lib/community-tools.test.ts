import { describe, expect, it } from 'vitest';
import {
  buildJsonGraph,
  createSandboxDocument,
  simulateColorVision,
  simulateImagePixels,
} from './community-tools';

describe('community tool helpers', () => {
  it('simulates color vision while preserving alpha', () => {
    const gray = simulateColorVision([120, 120, 120], 'achromatopsia');
    expect(Math.max(...gray) - Math.min(...gray)).toBeLessThanOrEqual(1);
    const pixels = simulateImagePixels(
      Uint8ClampedArray.of(255, 0, 0, 128),
      'deuteranopia',
    );
    expect(pixels[3]).toBe(128);
  });

  it('builds a bounded JSON relationship graph', () => {
    const graph = buildJsonGraph({ user: { name: 'Ada' }, active: true });
    expect(graph.nodes.map(({ label }) => label)).toEqual([
      '$',
      'user',
      'name',
      'active',
    ]);
    expect(buildJsonGraph([1, 2, 3], 2).truncated).toBe(true);
  });

  it('isolates sandbox markup and escapes closing tags', () => {
    const document = createSandboxDocument({
      html: '<main>Preview</main>',
      css: 'body::after { content: "</style>"; }',
      javascript: 'console.log("</script>")',
      channel: 'test-channel',
    });
    expect(document).toContain("default-src 'none'");
    expect(document).toContain('<\\/script>');
    expect(document).toContain('test-channel');
  });
});
