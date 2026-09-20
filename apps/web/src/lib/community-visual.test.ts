// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseModelDocument } from './gltf-inspector';
import { createImagePlaceholder } from './image-placeholder';
import { createSelectorPreview } from './selector-preview';
import { transformSvgPath } from './svg-path-workbench';
import { inspectCodecs } from './browser-capabilities';

describe('community visual tools', () => {
  it('matches an inert tree and strips executable/external preview content', async () => {
    const result = await createSelectorPreview(
      '<ul><li class="a">one</li><li>two</li></ul><img src="https://example.com/test" onerror="alert(1)"><script>alert(1)</script>',
      'li.a',
    );
    expect(result.count).toBe(1);
    expect(result.snippets[0]).toContain('one');
    expect(result.html).toContain('data-tool-match="true"');
    expect(result.html).not.toContain('onerror');
    expect(result.html).not.toContain('https://example.com/test');
    expect(result.html).not.toContain('<script>');
    await expect(createSelectorPreview('<div/>', '[')).rejects.toThrow();
  });
  it('transforms real SVG paths and rejects invalid paths', async () => {
    const options = { x: 5, y: 10, scale: 2, rotate: 0, mode: 'absolute' };
    expect(await transformSvgPath('M0 0L10 0', options)).toBe('M5 10L25 10');
    await expect(transformSvgPath('not a path', options)).rejects.toThrow();
  });
  it('encodes image placeholders with preserved output shape and validates limits', async () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    const result = await createImagePlaceholder({
      pixels,
      width: 4,
      height: 4,
      components: 2,
    });
    expect(result.thumbUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.blurhash).toHaveLength(12);
    expect(result.blurPixels[0]).toBeGreaterThanOrEqual(250);
    await expect(
      createImagePlaceholder({ pixels, width: 101, height: 4, components: 2 }),
    ).rejects.toThrow('INVALID');
  });
  it('rejects external model resources, cyclic node graphs and broken GLB lengths', () => {
    const model = (data: object) =>
      new TextEncoder().encode(
        JSON.stringify({ asset: { version: '2.0' }, ...data }),
      ).buffer;
    expect(
      parseModelDocument(model({ nodes: [{}] }), false).json.nodes,
    ).toHaveLength(1);
    expect(() =>
      parseModelDocument(model({ nodes: [{ children: [0] }] }), false),
    ).toThrow('INVALID');
    expect(() =>
      parseModelDocument(
        model({ buffers: [{ uri: 'https://example.com/x.bin' }] }),
        false,
      ),
    ).toThrow('EXTERNAL');
    expect(() => parseModelDocument(new ArrayBuffer(24), true)).toThrow(
      'INVALID',
    );
  });
  it('rejects invalid codec parameters before probing the browser', async () => {
    await expect(
      inspectCodecs({ width: 0, height: 1080, rate: 30, custom: '' }),
    ).rejects.toThrow('INVALID');
  });
});
