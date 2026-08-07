export function jsonToNdjson(value: unknown): string {
  if (!Array.isArray(value)) throw new Error('JSON 根节点必须是数组');
  return value.map((item) => JSON.stringify(item)).join('\n');
}

export function ndjsonToJson(value: string): unknown[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as unknown;
      } catch (cause) {
        throw new Error(`第 ${index + 1} 行：${(cause as Error).message}`);
      }
    });
}
