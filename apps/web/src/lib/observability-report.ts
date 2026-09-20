export const REPORT_MAX_BYTES = 20 * 1024 * 1024;
export type ReportObject = Record<string, unknown>;
export function reportObject(value: unknown): ReportObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalidFormat');
  return value as ReportObject;
}
export function reportArray(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('invalidFormat');
  return value;
}
export function reportText(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') throw new Error('invalidFormat');
  if (value.length > 256 * 1024) throw new Error('limit');
  return value;
}
export function reportNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('invalidFormat');
  return value;
}
export function readReportJson(source: string): unknown {
  if (new TextEncoder().encode(source).length > REPORT_MAX_BYTES)
    throw new Error('sizeLimit');
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.replace(/^\uFEFF/, '')) as unknown;
  } catch {
    throw new Error('invalidJson');
  }
  const stack: Array<[unknown, number]> = [[parsed, 0]];
  let count = 0;
  while (stack.length) {
    const [value, depth] = stack.pop()!;
    if (++count > 500_000 || depth > 80) throw new Error('limit');
    if (value && typeof value === 'object')
      for (const child of Object.values(value)) stack.push([child, depth + 1]);
  }
  return parsed;
}
export function reportPreview(value: unknown, limit = 16_384): string {
  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
