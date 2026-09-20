import type { AvroRequest } from '../lib/avro-tool';
import type { JsonLdRequest } from '../lib/jsonld-debug';
import type { JsonLogicRequest } from '../lib/json-logic-debug';
import type { WasmRequest } from '../lib/wasm-tool';
export type FormatRequest =
  | AvroRequest
  | JsonLdRequest
  | JsonLogicRequest
  | WasmRequest;
self.onmessage = async (event: MessageEvent<FormatRequest>): Promise<void> => {
  try {
    const request = event.data;
    const result =
      request.kind === 'jsonld'
        ? await (await import('../lib/jsonld-debug')).processJsonLd(request)
        : request.kind === 'logic'
          ? await (
              await import('../lib/json-logic-debug')
            ).processJsonLogic(request)
          : request.kind === 'avro'
            ? await (await import('../lib/avro-tool')).processAvro(request)
            : await (await import('../lib/wasm-tool')).processWasm(request);
    self.postMessage({ result });
  } catch (error) {
    let message = (error as Error).message;
    const cause = (error as { details?: { cause?: Error } }).details?.cause;
    if (cause?.message.startsWith('REMOTE_CONTEXT_BLOCKED:'))
      message = cause.message;
    self.postMessage({ error: message });
  }
};
