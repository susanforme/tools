import { calculateFunctions, type FunctionRequest } from './function-workbench';
self.onmessage = (event: MessageEvent<FunctionRequest>) => {
  try {
    self.postMessage({ result: calculateFunctions(event.data) });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
