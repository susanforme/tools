export type DiffLineChange = {
  originalStartLineNumber: number;
  originalEndLineNumber: number;
  modifiedStartLineNumber: number;
  modifiedEndLineNumber: number;
};

export function summarizeDiff(changes: readonly DiffLineChange[] | null) {
  let added = 0;
  let removed = 0;

  for (const change of changes ?? []) {
    if (change.modifiedEndLineNumber > 0) {
      added +=
        change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1;
    }
    if (change.originalEndLineNumber > 0) {
      removed +=
        change.originalEndLineNumber - change.originalStartLineNumber + 1;
    }
  }

  return { added, removed };
}

export function formatJson(text: string): string {
  if (text.trim() === '') return '';
  return JSON.stringify(JSON.parse(text) as unknown, null, 2);
}
