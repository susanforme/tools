import {
  scanLogFile,
  type LogFilters,
  type LogWorkerResponse,
} from '../lib/log-explorer';
const scope = self as unknown as {
  onmessage:
    | ((event: MessageEvent<{ file: File; filters: LogFilters }>) => void)
    | null;
  postMessage: (message: LogWorkerResponse) => void;
};
scope.onmessage = async ({ data }) => {
  try {
    let lastProgress = 0;
    const result = await scanLogFile(
      data.file,
      data.filters,
      (bytes, lines) => {
        if (Date.now() - lastProgress < 100) return;
        lastProgress = Date.now();
        scope.postMessage({ type: 'progress', bytes, lines });
      },
    );
    scope.postMessage({ type: 'result', result });
  } catch (error) {
    scope.postMessage({ type: 'error', error: (error as Error).message });
  }
};
