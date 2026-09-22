export type CspReport = {
  document: string;
  blocked: string;
  directive: string;
  disposition: string;
  source: string;
  line: number | null;
};

export function parseCspReports(input: string): CspReport[] {
  if (input.length > 5 * 1024 * 1024) throw new Error('最多支持 5 MB 报告');
  const value: unknown = JSON.parse(input);
  const entries = Array.isArray(value) ? value : [value];
  if (entries.length > 20000) throw new Error('最多支持 20000 条报告');
  const reports: CspReport[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new Error('报告必须是 JSON 对象');
    const envelope = entry as Record<string, unknown>;
    if (typeof envelope.type === 'string' && envelope.type !== 'csp-violation')
      continue;
    const raw = envelope['csp-report'] ?? envelope.body ?? envelope;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('报告正文无效');
    const body = raw as Record<string, unknown>;
    const read = (modern: string, legacy: string): string => {
      const item = body[modern] ?? body[legacy];
      return typeof item === 'string' ? item : '';
    };
    const directive =
      read('effectiveDirective', 'effective-directive') ||
      read('violatedDirective', 'violated-directive');
    if (!directive)
      throw new Error('报告缺少 effectiveDirective / violated-directive');
    const line = body.lineNumber ?? body['line-number'];
    reports.push({
      document:
        read('documentURL', 'document-uri') ||
        (typeof envelope.url === 'string' ? envelope.url : ''),
      blocked: read('blockedURL', 'blocked-uri'),
      directive,
      disposition: read('disposition', 'disposition'),
      source: read('sourceFile', 'source-file'),
      line: typeof line === 'number' && Number.isFinite(line) ? line : null,
    });
  }
  if (!reports.length) throw new Error('未找到 CSP 违规报告');
  return reports;
}

export function groupCspReports(
  reports: CspReport[],
  field: 'directive' | 'blocked' | 'document',
) {
  const counts = new Map<string, number>();
  reports.forEach((report) =>
    counts.set(report[field], (counts.get(report[field]) ?? 0) + 1),
  );
  return Array.from(counts, ([value, count]) => ({ value, count })).sort(
    (a, b) => b.count - a.count,
  );
}
