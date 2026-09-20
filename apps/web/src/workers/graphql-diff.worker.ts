import {
  compareGraphqlSchemas,
  type SchemaDiffRequest,
} from '../lib/graphql-diff';

self.onmessage = async (
  event: MessageEvent<SchemaDiffRequest>,
): Promise<void> => {
  try {
    self.postMessage({ result: await compareGraphqlSchemas(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
