import { expect, it, vi } from 'vitest';
import { clearDirectoryContents } from './local-data';

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
