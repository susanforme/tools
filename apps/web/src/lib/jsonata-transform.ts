export type JsonataRequest = { input: string; expression: string };
export type JsonataResult = { output: string; empty: boolean };
export const JSONATA_INPUT_LIMIT = 2 * 1024 * 1024;

export async function transformJsonata({
  input,
  expression,
}: JsonataRequest): Promise<JsonataResult> {
  if (
    new TextEncoder().encode(input).byteLength > JSONATA_INPUT_LIMIT ||
    expression.length > 50_000
  )
    throw new Error('INPUT_TOO_LARGE');
  if (!expression.trim()) throw new Error('EMPTY_EXPRESSION');
  const data: unknown = JSON.parse(input);
  const jsonata = (await import('jsonata')).default;
  const result: unknown = await jsonata(expression, {
    stack: 500,
    timeout: 4000,
  }).evaluate(data);
  if (result === undefined) return { output: '', empty: true };
  const output = JSON.stringify(result, null, 2);
  if (output === undefined) throw new Error('NON_JSON_RESULT');
  if (output.length > 5 * 1024 * 1024) throw new Error('OUTPUT_TOO_LARGE');
  return { output, empty: false };
}
