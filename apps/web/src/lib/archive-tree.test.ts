import { describe, expect, it } from 'vitest';
import {
  addArchiveFiles,
  archiveTreeEntries,
  createArchiveTree,
  removeArchiveNodes,
} from './archive-tree';

describe('archive tree', () => {
  it('keeps imported paths and removes a folder recursively', () => {
    const tree = addArchiveFiles(createArchiveTree(), [
      { file: new File(['a'], 'a.txt'), path: 'src/a.txt' },
      { file: new File(['b'], 'b.txt'), path: 'src/lib/b.txt' },
    ]);
    expect(archiveTreeEntries(tree).map((entry) => entry.path)).toEqual([
      'src',
      'src/a.txt',
      'src/lib',
      'src/lib/b.txt',
    ]);

    const sourceFolder = Object.values(tree).find(
      (node) => node.kind === 'folder' && node.name === 'src',
    )!;
    expect(
      archiveTreeEntries(removeArchiveNodes(tree, [sourceFolder.id])),
    ).toEqual([]);
  });
});
