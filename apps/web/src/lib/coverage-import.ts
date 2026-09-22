export type CoverageRange = { start: number; end: number };
export type CoverageFile = {
  url: string;
  text: string | null;
  total: number | null;
  used: number;
  unused: number | null;
  ranges: CoverageRange[];
  uncovered: CoverageRange[];
};
export function parseChromeCoverage(text: string): CoverageFile[] {
  if (text.length > 20 * 1024 * 1024) throw new Error('sizeLimit');
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value) || !value.length || value.length > 10000)
    throw new Error('coverageFormat');
  return value.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('coverageFormat');
    const item = raw as Record<string, unknown>;
    if (
      typeof item.url !== 'string' ||
      !(item.text === null || typeof item.text === 'string') ||
      !Array.isArray(item.ranges)
    )
      throw new Error('coverageFormat');
    const source = item.text;
    const ranges: CoverageRange[] = item.ranges
      .map((rawRange: unknown) => {
        if (!rawRange || typeof rawRange !== 'object')
          throw new Error('coverageRange');
        const { start, end } = rawRange as Record<string, unknown>;
        if (
          typeof start !== 'number' ||
          typeof end !== 'number' ||
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start < 0 ||
          end < start ||
          (source !== null && end > source.length)
        )
          throw new Error('coverageRange');
        return { start, end };
      })
      .sort((a, b) => a.start - b.start);
    const merged: CoverageRange[] = [];
    for (const range of ranges) {
      const previous = merged.at(-1);
      if (previous && range.start <= previous.end)
        previous.end = Math.max(previous.end, range.end);
      else merged.push({ ...range });
    }
    let end = 0;
    const uncovered: CoverageRange[] = [];
    for (const range of merged) {
      if (source !== null && range.start > end)
        uncovered.push({ start: end, end: range.start });
      end = range.end;
    }
    if (source !== null && end < source.length)
      uncovered.push({ start: end, end: source.length });
    const used = merged.reduce(
      (sum, range) => sum + range.end - range.start,
      0,
    );
    return {
      url: item.url,
      text: source,
      total: source?.length ?? null,
      used,
      unused: source === null ? null : source.length - used,
      ranges: merged,
      uncovered,
    };
  });
}
export function compareCoverage(before: CoverageFile[], after: CoverageFile[]) {
  const aggregate = (files: CoverageFile[]) => {
    const map = new Map<
      string,
      { total: number; unused: number; unknown: boolean }
    >();
    for (const file of files) {
      const row = map.get(file.url) ?? { total: 0, unused: 0, unknown: false };
      row.total += file.total ?? 0;
      row.unused += file.unused ?? 0;
      row.unknown ||= file.total === null;
      map.set(file.url, row);
    }
    return map;
  };
  const a = aggregate(before),
    b = aggregate(after);
  return [...new Set([...a.keys(), ...b.keys()])].map((url) => {
    const left = a.get(url),
      right = b.get(url);
    return {
      url,
      status: !left ? 'added' : !right ? 'removed' : 'changed',
      before: left && !left.unknown ? left.unused : null,
      after: right && !right.unknown ? right.unused : null,
      delta:
        left?.unknown || right?.unknown
          ? null
          : (right?.unused ?? 0) - (left?.unused ?? 0),
    };
  });
}
