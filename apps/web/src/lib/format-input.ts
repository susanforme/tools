export const FORMAT_INPUT_LIMIT = 2 * 1024 * 1024;
export function checkFormatSize(text: string): void {
  if (new TextEncoder().encode(text).byteLength > FORMAT_INPUT_LIMIT)
    throw new Error('INPUT_TOO_LARGE');
}
export function parseFormatJson(text: string): unknown {
  checkFormatSize(text);
  const value: unknown = JSON.parse(text);
  const pending: Array<[unknown, number]> = [[value, 0]];
  let nodes = 0;
  while (pending.length) {
    const [item, depth] = pending.pop()!;
    if (++nodes > 100_000 || depth > 100) throw new Error('STRUCTURE_LIMIT');
    if (typeof item === 'number' && !Number.isFinite(item))
      throw new Error('NON_JSON_RESULT');
    if (item && typeof item === 'object')
      for (const child of Object.values(item)) pending.push([child, depth + 1]);
  }
  return value;
}
export function formatOutput(value: unknown): string {
  const output = JSON.stringify(
    value,
    (_key, item: unknown) => {
      if (
        typeof item === 'function' ||
        typeof item === 'symbol' ||
        typeof item === 'bigint' ||
        (typeof item === 'number' && !Number.isFinite(item))
      )
        throw new Error('NON_JSON_RESULT');
      return item;
    },
    2,
  );
  if (output === undefined) throw new Error('NON_JSON_RESULT');
  if (output.length > 5 * 1024 * 1024) throw new Error('OUTPUT_TOO_LARGE');
  return output;
}
export type FormatResult = {
  output: string;
  info?: string;
  binary?: Uint8Array;
};
