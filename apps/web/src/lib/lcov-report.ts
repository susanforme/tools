export type CoverageMetric = {
  hit: number;
  found: number;
  percent: number | null;
};
export type CoverageLine = {
  line: number;
  hits: number;
  checksum: string | null;
};
export type CoverageBranch = { key: string; line: number; hits: number | null };
export type CoverageFile = {
  path: string;
  lines: CoverageLine[];
  branches: CoverageBranch[];
  lineCoverage: CoverageMetric;
  branchCoverage: CoverageMetric;
  records: number;
};
export type LcovReport = {
  files: CoverageFile[];
  fileCoverage: CoverageMetric;
  lineCoverage: CoverageMetric;
  branchCoverage: CoverageMetric;
};
export type LcovChange = {
  path: string;
  before: CoverageFile | null;
  after: CoverageFile | null;
  lineDelta: number | null;
  branchDelta: number | null;
};
export type LcovResult = {
  current: LcovReport;
  baseline: LcovReport | null;
  changes: LcovChange[];
};
export function coverageMetric(hit: number, found: number): CoverageMetric {
  return { hit, found, percent: found === 0 ? null : (hit / found) * 100 };
}
function integer(value: string, nonzero = false): number {
  if (!/^\d+$/.test(value)) throw new Error('INVALID_COUNT');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || (nonzero && number === 0))
    throw new Error('INVALID_COUNT');
  return number;
}
function sum(a: number, b: number): number {
  const number = a + b;
  if (!Number.isSafeInteger(number)) throw new Error('INVALID_COUNT');
  return number;
}
export function normalizeReportPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^(?:\.\/)+/, '');
}

export function parseLcov(text: string): LcovReport {
  if (new TextEncoder().encode(text).byteLength > 10 * 1024 * 1024)
    throw new Error('REPORT_TOO_LARGE');
  const files = new Map<
    string,
    {
      path: string;
      lines: Map<number, CoverageLine>;
      branches: Map<string, CoverageBranch>;
      records: number;
    }
  >();
  let current: ReturnType<typeof files.get> = undefined;
  let entries = 0;
  for (const [index, raw] of text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .entries()) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line === 'end_of_record') {
      if (!current) throw new Error(`INVALID_RECORD:${index + 1}`);
      current = undefined;
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 0) throw new Error(`INVALID_RECORD:${index + 1}`);
    const tag = line.slice(0, colon);
    const value = line.slice(colon + 1);
    if (tag === 'TN' || tag === 'VER') continue;
    if (tag === 'SF') {
      if (current || !value.trim())
        throw new Error(`INVALID_RECORD:${index + 1}`);
      const path = normalizeReportPath(value);
      current = files.get(path) ?? {
        path,
        lines: new Map(),
        branches: new Map(),
        records: 0,
      };
      current.records++;
      files.set(path, current);
      if (files.size > 10_000) throw new Error('RECORD_LIMIT');
      continue;
    }
    if (!current) throw new Error(`INVALID_RECORD:${index + 1}`);
    if (++entries > 300_000) throw new Error('RECORD_LIMIT');
    if (tag === 'DA') {
      const parts = value.split(',');
      if (parts.length < 2 || parts.length > 3)
        throw new Error(`INVALID_RECORD:${index + 1}`);
      const number = integer(parts[0], true);
      const hits = integer(parts[1]);
      const checksum = parts[2] || null;
      const previous = current.lines.get(number);
      if (previous?.checksum && checksum && previous.checksum !== checksum)
        throw new Error(`SOURCE_MISMATCH:${current.path}:${number}`);
      current.lines.set(number, {
        line: number,
        hits: sum(previous?.hits ?? 0, hits),
        checksum: checksum ?? previous?.checksum ?? null,
      });
    } else if (tag === 'BRDA') {
      const parts = value.split(',');
      if (parts.length < 4 || !/^[efu]*\d+$/.test(parts[1]))
        throw new Error(`INVALID_RECORD:${index + 1}`);
      const number = integer(parts[0], true);
      const branch = parts.slice(2, -1).join(',');
      if (!branch) throw new Error(`INVALID_RECORD:${index + 1}`);
      const taken = parts.at(-1)!;
      const hits = taken === '-' ? null : integer(taken);
      if (parts[1].includes('u')) continue;
      const key = JSON.stringify([number, parts[1], branch]);
      const previous = current.branches.get(key);
      current.branches.set(key, {
        key,
        line: number,
        hits:
          hits === null && (previous?.hits ?? null) === null
            ? null
            : sum(previous?.hits ?? 0, hits ?? 0),
      });
    } else if (
      ![
        'FN',
        'FNDA',
        'FNF',
        'FNH',
        'FNL',
        'FNA',
        'LF',
        'LH',
        'BRF',
        'BRH',
        'MCDC',
        'MCDCF',
        'MCDCH',
      ].includes(tag)
    )
      throw new Error(`UNSUPPORTED_RECORD:${tag}`);
  }
  if (current) throw new Error('MISSING_END');
  if (!files.size) throw new Error('NOT_LCOV');
  const resultFiles: CoverageFile[] = [...files.values()]
    .map((file) => {
      const lines = [...file.lines.values()].sort((a, b) => a.line - b.line);
      const branches = [...file.branches.values()];
      return {
        path: file.path,
        lines,
        branches,
        records: file.records,
        lineCoverage: coverageMetric(
          lines.filter((line) => line.hits > 0).length,
          lines.length,
        ),
        branchCoverage: coverageMetric(
          branches.filter((branch) => (branch.hits ?? 0) > 0).length,
          branches.length,
        ),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    files: resultFiles,
    fileCoverage: coverageMetric(
      resultFiles.filter((file) => file.lineCoverage.hit > 0).length,
      resultFiles.filter((file) => file.lineCoverage.found > 0).length,
    ),
    lineCoverage: coverageMetric(
      resultFiles.reduce((count, file) => count + file.lineCoverage.hit, 0),
      resultFiles.reduce((count, file) => count + file.lineCoverage.found, 0),
    ),
    branchCoverage: coverageMetric(
      resultFiles.reduce((count, file) => count + file.branchCoverage.hit, 0),
      resultFiles.reduce((count, file) => count + file.branchCoverage.found, 0),
    ),
  };
}

export function compareLcov(
  currentText: string,
  baselineText: string,
): LcovResult {
  const current = parseLcov(currentText);
  const baseline = baselineText.trim() ? parseLcov(baselineText) : null;
  const before = new Map(
    baseline?.files.map((file) => [file.path, file]) ?? [],
  );
  const after = new Map(current.files.map((file) => [file.path, file]));
  const delta = (a: number | null, b: number | null): number | null =>
    a === null || b === null ? null : b - a;
  const changes = [...new Set([...before.keys(), ...after.keys()])]
    .sort()
    .map((path): LcovChange => {
      const previous = before.get(path) ?? null;
      const next = after.get(path) ?? null;
      return {
        path,
        before: previous,
        after: next,
        lineDelta: delta(
          previous?.lineCoverage.percent ?? null,
          next?.lineCoverage.percent ?? null,
        ),
        branchDelta: delta(
          previous?.branchCoverage.percent ?? null,
          next?.branchCoverage.percent ?? null,
        ),
      };
    });
  return { current, baseline, changes };
}

export function matchCoverageSource(
  path: string,
  sources: string[],
  reportPaths: string[],
): number | null {
  const target = normalizeReportPath(path);
  const normalized = sources.map(normalizeReportPath);
  const exact = normalized
    .map((value, index) => (value === target ? index : -1))
    .filter((index) => index >= 0);
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const matches = (a: string, b: string): boolean =>
    a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
  const candidates = normalized
    .map((value, index) => (matches(value, target) ? index : -1))
    .filter((index) => index >= 0);
  if (candidates.length !== 1) return null;
  const candidate = candidates[0];
  return reportPaths.filter((report) =>
    matches(normalizeReportPath(report), normalized[candidate]),
  ).length === 1
    ? candidate
    : null;
}
