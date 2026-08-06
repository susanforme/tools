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
