import type { ContextDefinition, JsonLdDocument, NodeObject } from 'jsonld';
import {
  checkFormatSize,
  formatOutput,
  parseFormatJson,
  type FormatResult,
} from './format-input';
export type JsonLdRequest = {
  kind: 'jsonld';
  input: string;
  mode: 'expand' | 'compact';
  context: string;
  contexts: string;
};
export function extractJsonLdScripts(html: string): string {
  checkFormatSize(html);
  // template 的内容保持惰性，不插入页面、不加载 img/iframe 等资源。
  const template = document.createElement('template');
  template.innerHTML = html;
  const scripts = [...template.content.querySelectorAll('script')].filter(
    (script) =>
      script.type.trim().toLowerCase().split(';')[0] === 'application/ld+json',
  );
  if (!scripts.length) throw new Error('NO_JSONLD');
  if (scripts.length > 100) throw new Error('STRUCTURE_LIMIT');
  return JSON.stringify(
    scripts.flatMap((script, index) => {
      try {
        const value: unknown = JSON.parse(script.textContent ?? '');
        return Array.isArray(value) ? value : [value];
      } catch {
        throw new Error(`INVALID_JSONLD_SCRIPT:${index + 1}`);
      }
    }),
  );
}
export async function processJsonLd(
  request: JsonLdRequest,
): Promise<FormatResult> {
  const input = parseFormatJson(request.input);
  if (!input || typeof input !== 'object') throw new Error('JSONLD_OBJECT');
  const contexts = parseFormatJson(request.contexts.trim() || '{}');
  if (!contexts || typeof contexts !== 'object' || Array.isArray(contexts))
    throw new Error('CONTEXT_MAP');
  const localContexts = contexts as Record<string, unknown>;
  const documentLoader = async (url: string) => {
    if (!Object.hasOwn(localContexts, url))
      throw new Error(`REMOTE_CONTEXT_BLOCKED:${url}`);
    const document = localContexts[url];
    if (!document || typeof document !== 'object')
      throw new Error('CONTEXT_MAP');
    return {
      documentUrl: url,
      document: document as NodeObject,
    };
  };
  const jsonld = (await import('jsonld')).default;
  // safe 避免未定义词条被静默丢弃；loader 永远不回退到网络。
  const options = { documentLoader, safe: true };
  const output =
    request.mode === 'compact'
      ? await jsonld.compact(
          input as JsonLdDocument,
          parseFormatJson(request.context) as ContextDefinition,
          options,
        )
      : await jsonld.expand(input as JsonLdDocument, options);
  return { output: formatOutput(output) };
}
