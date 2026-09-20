import { reportObject } from './observability-report';
export const PERFORMANCE_MAX_BYTES = 64 * 1024 * 1024;
export function performanceJson(source: string): unknown {
  if (new TextEncoder().encode(source).length > PERFORMANCE_MAX_BYTES)
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
    if (depth > 80) throw new Error('limit');
    if (!value || typeof value !== 'object') continue;
    const values = Array.isArray(value) ? value : Object.values(value);
    count += values.length;
    if (count > 12_000_000) throw new Error('limit');
    for (const child of values)
      if (child && typeof child === 'object') stack.push([child, depth + 1]);
  }
  return parsed;
}
export function requiredArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('invalidFormat');
  return value;
}
export function nonnegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('invalidFormat');
  return value;
}
export function finiteTime(value: unknown): number {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !/^-?\d+(\.\d+)?$/.test(value))
  )
    throw new Error('invalidFormat');
  const result = Number(value);
  if (!Number.isFinite(result) || Math.abs(result) > Number.MAX_SAFE_INTEGER)
    throw new Error('invalidFormat');
  return result;
}
export function dictionary(value: unknown): Record<string, unknown> {
  return value === undefined ? {} : reportObject(value);
}
