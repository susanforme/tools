export type PatchLine = {
  number: number | null;
  text: string;
  changed: boolean;
};
export type ParsedPatch = {
  oldFileName: string;
  newFileName: string;
  added: number;
  removed: number;
  hunks: {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
    left: PatchLine[];
    right: PatchLine[];
  }[];
};
export async function parseGitPatch(input: string): Promise<ParsedPatch[]> {
  if (input.length > 2 * 1024 * 1024) throw new Error('patchLimit');
  if (/^GIT binary patch|^Binary files |^@@@/m.test(input))
    throw new Error('patchBinary');
  const { parsePatch } = await import('diff');
  const patches = parsePatch(input);
  if (!patches.length || !patches.some((p) => p.oldFileName || p.newFileName))
    throw new Error('patchFormat');
  return patches.map((patch) => {
    let added = 0,
      removed = 0;
    const hunks = patch.hunks.map((hunk) => {
      let oldLine = hunk.oldStart,
        newLine = hunk.newStart;
      const left: PatchLine[] = [],
        right: PatchLine[] = [];
      const empty = (): PatchLine => ({
        number: null,
        text: '',
        changed: false,
      });
      const pad = () => {
        while (left.length < right.length) left.push(empty());
        while (right.length < left.length) right.push(empty());
      };
      for (const line of hunk.lines) {
        if (line.startsWith('-')) {
          removed++;
          left.push({ number: oldLine++, text: line.slice(1), changed: true });
        } else if (line.startsWith('+')) {
          added++;
          right.push({ number: newLine++, text: line.slice(1), changed: true });
        } else if (line.startsWith(' ')) {
          pad();
          left.push({ number: oldLine++, text: line.slice(1), changed: false });
          right.push({
            number: newLine++,
            text: line.slice(1),
            changed: false,
          });
        }
      }
      pad();
      return {
        ...hunk,
        oldLines: hunk.oldLines ?? 0,
        newLines: hunk.newLines ?? 0,
        left,
        right,
      };
    });
    return {
      oldFileName: patch.oldFileName ?? '',
      newFileName: patch.newFileName ?? '',
      added,
      removed,
      hunks,
    };
  });
}
