import type { RulesLogic } from 'json-logic-js';
import {
  formatOutput,
  parseFormatJson,
  type FormatResult,
} from './format-input';
export type JsonLogicRequest = { kind: 'logic'; rule: string; data: string };
export async function processJsonLogic(
  request: JsonLogicRequest,
): Promise<FormatResult> {
  const rule = parseFormatJson(request.rule);
  const data = parseFormatJson(request.data);
  const logic = (await import('json-logic-js')).default;
  const value: unknown = logic.apply(rule as RulesLogic, data);
  return {
    output: formatOutput(value),
    info: formatOutput({
      truthy: logic.truthy(value),
      variables:
        rule && typeof rule === 'object'
          ? logic.uses_data(rule as Record<string, unknown>)
          : [],
    }),
  };
}
