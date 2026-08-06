import { describe, expect, it } from 'vitest';
import { getArchiveAdapter } from './archive-adapters';

const SOURCE = [
  {
    data: new Uint8Array(),
    directory: true,
    name: 'src/assets',
  },
  {
    data: new TextEncoder().encode('hello'),
    directory: false,
    name: 'src/lib/a.txt',
  },
];

describe.each(['zip', '7z'] as const)('%s archive adapter', (format) => {
  it('keeps nested paths and empty folders', async () => {
    const adapter = getArchiveAdapter(format);
    const compressed = await adapter.compress(SOURCE);
    const files = await adapter.decompress(compressed, `archive.${format}`);

    expect(files.map((file) => [file.name, file.directory])).toEqual(
      expect.arrayContaining([
        ['src/assets', true],
        ['src/lib/a.txt', false],
      ]),
    );
  });
});

it('decodes legacy GBK ZIP file names', async () => {
  const adapter = getArchiveAdapter('zip');
  const compressed = await adapter.compress([
    { data: new Uint8Array([1]), directory: false, name: 'aa.txt' },
  ]);
  const view = new DataView(compressed.buffer);
  for (let offset = 0; offset + 4 <= compressed.length; offset += 1) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x04034b50) compressed.set([0xd6, 0xd0], offset + 30);
    if (signature === 0x02014b50) compressed.set([0xd6, 0xd0], offset + 46);
  }

  const files = await adapter.decompress(compressed, 'legacy.zip');

  expect(files[0]?.name).toBe('中.txt');
});
