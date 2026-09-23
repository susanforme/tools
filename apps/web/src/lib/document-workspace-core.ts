export async function parseCleanupCsv(source: string): Promise<string[][]> {
  if (!source.trim() || source.length > 500000) throw new Error('table');
  const Papa = (await import('papaparse')).default;
  const result = Papa.parse<string[]>(source, { skipEmptyLines: 'greedy' });
  if (
    result.errors.some((error) => error.code !== 'UndetectableDelimiter') ||
    result.data.length < 2 ||
    result.data.length > 2001 ||
    result.data[0].length > 30 ||
    result.data.some(
      (row) =>
        row.length !== result.data[0].length ||
        row.some((cell) => cell.length > 10000),
    )
  )
    throw new Error('table');
  return result.data;
}
export type CleanAction = {
  operation: string;
  column: number;
  other: number;
  value: string;
};
export function cleanTable(rows: string[][], action: CleanAction): string[][] {
  if (
    rows.length < 2 ||
    rows.length > 2001 ||
    rows[0].length > 100 ||
    rows.some((row) => row.length !== rows[0].length)
  )
    throw new Error('table');
  const { operation, column, other, value } = action;
  if (!Number.isInteger(column) || column < 0 || column >= rows[0].length)
    throw new Error('column');
  const out = rows.map((row) => [...row]);
  if (operation === 'dedup') {
    const seen = new Set<string>();
    return out.filter((row, index) => {
      if (!index) return true;
      const key = row[column];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if (operation === 'split') {
    if (!value) throw new Error('separator');
    const count = Math.max(
      ...out.slice(1).map((row) => row[column].split(value).length),
    );
    if (count + out[0].length > 100) throw new Error('limit');
    return out.map((row, index) => {
      const parts = index
        ? row[column].split(value)
        : Array.from({ length: count }, (_, n) => `${row[column]}_${n + 1}`);
      row.splice(
        column,
        1,
        ...Array.from({ length: count }, (_, n) => parts[n] ?? ''),
      );
      return row;
    });
  }
  if (operation === 'merge') {
    if (
      !Number.isInteger(other) ||
      other < 0 ||
      other >= out[0].length ||
      other === column
    )
      throw new Error('column');
    return out.map((row) => {
      row[column] = [row[column], row[other]].join(value);
      row.splice(other, 1);
      return row;
    });
  }
  const canonical = new Map<string, string>();
  for (const row of out.slice(1)) {
    const cell = row[column];
    if (operation === 'fill' && !cell.trim()) row[column] = value;
    else if (operation === 'trim') row[column] = cell.trim();
    else if (operation === 'date' && cell.trim()) {
      const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(cell.trim());
      if (!match) throw new Error('date');
      const [, y, m, d] = match;
      const date = new Date(Date.UTC(+y, +m - 1, +d));
      if (
        date.getUTCFullYear() !== +y ||
        date.getUTCMonth() !== +m - 1 ||
        date.getUTCDate() !== +d
      )
        throw new Error('date');
      row[column] = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else if (operation === 'cluster') {
      // ponytail: 只归并大小写、全半角、空白和标点差异；编辑距离模糊合并应增加逐组确认。
      const key = cell
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[\p{P}\p{Z}\s]/gu, '');
      if (!key) continue;
      if (!canonical.has(key)) canonical.set(key, cell);
      row[column] = canonical.get(key)!;
    } else if (!['fill', 'trim', 'date', 'cluster'].includes(operation))
      throw new Error('operation');
  }
  return out;
}
export function bindTemplate(
  template: string,
  headers: string[],
  row: string[],
  number: string,
): string {
  if (
    template.length > 12000 ||
    new Set(headers).size !== headers.length ||
    headers.some((h) => !h.trim())
  )
    throw new Error('template');
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key: string) => {
    if (key === '#') return number;
    const index = headers.indexOf(key);
    if (index < 0) throw new Error(`variable: ${key}`);
    return row[index] ?? '';
  });
}
export type SearchDocument = {
  name: string;
  type: string;
  sections: { label: string; text: string }[];
};
export function searchDocuments(
  documents: SearchDocument[],
  query: string,
  type: string,
) {
  const needle = query.trim().toLocaleLowerCase();
  const results: {
    name: string;
    label: string;
    before: string;
    hit: string;
    after: string;
  }[] = [];
  if (!needle || needle.length > 200) return results;
  for (const doc of documents) {
    if (type !== 'all' && type !== doc.type) continue;
    for (const section of doc.sections) {
      const text = section.text.toLocaleLowerCase();
      let at = 0;
      while ((at = text.indexOf(needle, at)) >= 0) {
        results.push({
          name: doc.name,
          label: section.label,
          before: section.text.slice(Math.max(0, at - 70), at),
          hit: section.text.slice(at, at + needle.length),
          after: section.text.slice(
            at + needle.length,
            at + needle.length + 100,
          ),
        });
        if (results.length === 500) return results;
        at += needle.length;
      }
    }
  }
  return results;
}
export type RedactRect = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
export function validateRect(rect: RedactRect): void {
  if (
    !Number.isInteger(rect.page) ||
    rect.page < 1 ||
    rect.page > 100 ||
    ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x + rect.width > 100 ||
    rect.y + rect.height > 100
  )
    throw new Error('rectangle');
}
export function contentBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  let left = width,
    right = -1,
    top = height,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      if (
        data[p + 3] > 20 &&
        Math.min(data[p], data[p + 1], data[p + 2]) < 245
      ) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  return right < 0
    ? { x: 0, y: 0, width, height }
    : {
        x: Math.max(0, left - 8),
        y: Math.max(0, top - 8),
        width: Math.min(width - 1, right + 8) - Math.max(0, left - 8) + 1,
        height: Math.min(height - 1, bottom + 8) - Math.max(0, top - 8) + 1,
      };
}
export type EditableChapter = { title: string; text: string };
export function textChapters(
  text: string,
  fallback: string,
): EditableChapter[] {
  if (!text.trim() || text.length > 1000000) throw new Error('book');
  const chapters: EditableChapter[] = [];
  let title = fallback;
  let lines: string[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = /^#\s+(.+)$/.exec(line);
    if (heading) {
      if (lines.join('\n').trim())
        chapters.push({ title, text: lines.join('\n').trim() });
      title = heading[1];
      lines = [];
    } else lines.push(line);
  }
  if (lines.join('\n').trim())
    chapters.push({ title, text: lines.join('\n').trim() });
  if (!chapters.length || chapters.length > 100) throw new Error('book');
  return chapters;
}
export const xmlEscape = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
