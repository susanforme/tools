import { analyzeMcpTraces, type TraceSource } from '../lib/mcp-trace';

self.onmessage = (event: MessageEvent<TraceSource[]>) => {
  try {
    self.postMessage({ result: analyzeMcpTraces(event.data) });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
