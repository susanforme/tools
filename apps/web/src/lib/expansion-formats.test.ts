// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { processAvro } from './avro-tool';
import { processJsonLogic } from './json-logic-debug';
import { extractJsonLdScripts, processJsonLd } from './jsonld-debug';
import { processWasm } from './wasm-tool';

test('JSON-LD extracts inert HTML, resolves only supplied contexts and expands/compacts', async () => {
  const input = extractJsonLdScripts(
    '<script>alert(1)</script><img src="https://invalid.example/tracker"><script type="application/ld+json">{"@context":"https://example.test/context","name":"Ada"}</script><script type="application/ld+json">{"@id":"https://example.test/a","@type":"https://schema.org/Person"}</script>',
  );
  expect(JSON.parse(input)).toHaveLength(2);
  const fetch = vi.spyOn(globalThis, 'fetch');
  const contexts =
    '{"https://example.test/context":{"@context":{"name":"https://schema.org/name"}}}';
  const request = {
    kind: 'jsonld' as const,
    input,
    mode: 'expand' as const,
    context: '{"name":"https://schema.org/name"}',
    contexts,
  };
  const expanded = await processJsonLd(request);
  expect(expanded.output).toContain('https://schema.org/name');
  expect(
    (await processJsonLd({ ...request, mode: 'compact' })).output,
  ).toContain('"name": "Ada"');
  await expect(processJsonLd({ ...request, contexts: '{}' })).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockRestore();
  expect(() =>
    extractJsonLdScripts('<script type="application/ld+json">{bad}</script>'),
  ).toThrow('INVALID_JSONLD_SCRIPT:1');
});

test('JSON Logic uses interpreter semantics including falsy empty arrays and rejects JavaScript', async () => {
  const result = await processJsonLogic({
    kind: 'logic',
    rule: '{"if":[{"var":"items"},"nonempty","empty"]}',
    data: '{"items":[]}',
  });
  expect(JSON.parse(result.output)).toBe('empty');
  expect(JSON.parse(result.info!).variables).toEqual(['items']);
  await expect(
    processJsonLogic({ kind: 'logic', rule: '(()=>true)()', data: '{}' }),
  ).rejects.toThrow();
  await expect(
    processJsonLogic({ kind: 'logic', rule: '{"/": [1,0]}', data: '{}' }),
  ).rejects.toThrow('NON_JSON_RESULT');
});

test('Avro validates data, round trips bytes and checks reader/writer direction', async () => {
  const schema =
    '{"type":"record","name":"Person","fields":[{"name":"name","type":"string"},{"name":"age","type":"int"}]}';
  const request = {
    kind: 'avro' as const,
    mode: 'encode' as const,
    schema,
    reader: '',
    input: '{"name":"Ada","age":5}',
  };
  const encoded = await processAvro(request);
  expect(encoded.output).toBe('BkFkYQo=');
  expect(
    JSON.parse(
      (await processAvro({ ...request, mode: 'decode', input: encoded.output }))
        .output,
    ),
  ).toEqual({ name: 'Ada', age: 5 });
  await expect(
    processAvro({
      ...request,
      mode: 'validate',
      input: '{"name":"Ada","age":"5"}',
    }),
  ).rejects.toThrow();
  const reader =
    '{"type":"record","name":"Person","fields":[{"name":"name","type":"string"},{"name":"age","type":"long"},{"name":"country","type":"string","default":"CN"}]}';
  const compatibility = JSON.parse(
    (await processAvro({ ...request, mode: 'compatible', reader })).output,
  );
  expect(compatibility.readerReadsWriter.compatible).toBe(true);
  expect(compatibility.writerReadsReader.compatible).toBe(false);
  await expect(
    processAvro({ ...request, mode: 'decode', input: encoded.output + 'AAAA' }),
  ).rejects.toThrow();
});

test('WABT converts and inspects imports/start without instantiating user module', async () => {
  const instantiate = vi.spyOn(WebAssembly, 'instantiate');
  const wat =
    '(module (import "env" "sideEffect" (func $sideEffect)) (start $sideEffect) (func (export "answer") (result i32) i32.const 42))';
  const encoded = await processWasm({ kind: 'wasm', mode: 'wat', input: wat });
  const info = JSON.parse(encoded.info!);
  expect(info.imports).toEqual([
    { module: 'env', name: 'sideEffect', kind: 'function' },
  ]);
  expect(info.exports).toEqual([{ name: 'answer', kind: 'function' }]);
  expect(
    (await processWasm({ kind: 'wasm', mode: 'binary', input: encoded.output }))
      .output,
  ).toContain('(start');
  // WABT自身初始化可实例化可信WASM；用户模块始终只compile。
  expect(
    instantiate.mock.calls.every(
      (call) => JSON.stringify(call[1] ?? {}).includes('sideEffect') === false,
    ),
  ).toBe(true);
  instantiate.mockRestore();
  await expect(
    processWasm({
      kind: 'wasm',
      mode: 'wat',
      input: '(module (func (result i32)))',
    }),
  ).rejects.toThrow();
});
