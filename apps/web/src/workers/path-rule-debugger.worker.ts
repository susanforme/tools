import {
  debugPathRules,
  type PathRuleRequest,
} from '../lib/path-rule-debugger';
self.onmessage = async ({ data }: MessageEvent<PathRuleRequest>) => {
  try {
    self.postMessage({ result: await debugPathRules(data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
