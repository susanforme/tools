import { expect, it, vi } from 'vitest';
import { clearDirectoryContents, getDirectorySize } from './local-data';

it('removes every stored file and folder', async () => {
  const removeEntry = vi.fn(async () => undefined);
  const directory = {
    async *entries() {
      yield ['recording.webm'];
      yield ['video-results'];
    },
    removeEntry,
  } as unknown as FileSystemDirectoryHandle;

  await clearDirectoryContents(directory);

  expect(removeEntry).toHaveBeenCalledTimes(2);
  expect(removeEntry).toHaveBeenCalledWith('recording.webm', {
    recursive: true,
  });
  expect(removeEntry).toHaveBeenCalledWith('video-results', {
    recursive: true,
  });
});

it('totals files nested in OPFS directories', async () => {
  const directory = {
    async *entries() {
      yield [
        'video.mp4',
        { kind: 'file', getFile: async () => ({ size: 12 }) },
      ];
      yield [
        'thumbnails',
        {
          kind: 'directory',
          async *entries() {
            yield [
              'frame.jpg',
              { kind: 'file', getFile: async () => ({ size: 3 }) },
            ];
          },
        },
      ];
    },
  } as unknown as FileSystemDirectoryHandle;

  await expect(getDirectorySize(directory)).resolves.toBe(15);
});
