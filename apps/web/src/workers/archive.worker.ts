/// <reference lib="webworker" />

import { getArchiveAdapter } from '@/lib/archive-adapters';
import type {
  ArchiveWorkerRequest,
  ArchiveWorkerResponse,
} from '@/lib/archive';

const context = self as DedicatedWorkerGlobalScope;

context.onmessage = (event: MessageEvent<ArchiveWorkerRequest>) => {
  void processRequest(event.data)
    .then((response) => {
      const transfers =
        response.ok && response.type === 'compressed'
          ? [response.data]
          : response.ok
            ? response.files.map((file) => file.data)
            : [];
      context.postMessage(response, transfers);
    })
    .catch((cause: unknown) => {
      context.postMessage({
        ok: false,
        error: cause instanceof Error ? cause.message : String(cause),
      } satisfies ArchiveWorkerResponse);
    });
};

async function processRequest(
  request: ArchiveWorkerRequest,
): Promise<ArchiveWorkerResponse> {
  const adapter = getArchiveAdapter(request.format);
  if (request.type === 'compress') {
    if (!adapter.supportsMultipleFiles && request.files.length !== 1) {
      throw new Error('SINGLE_FILE_ONLY');
    }
    const output = await adapter.compress(
      request.files.map((file) => ({
        name: file.name,
        data: new Uint8Array(file.data),
        directory: file.directory,
      })),
    );
    const data = output.slice().buffer;
    return { ok: true, type: 'compressed', data };
  }

  const files = await adapter.decompress(
    new Uint8Array(request.data),
    request.fileName,
  );
  return {
    ok: true,
    type: 'decompressed',
    files: files.map((file) => {
      const data = file.data.slice().buffer;
      return {
        name: file.name,
        size: data.byteLength,
        data,
        directory: file.directory,
      };
    }),
  };
}

export {};
