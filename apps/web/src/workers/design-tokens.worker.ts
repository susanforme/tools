import { analyzeDesignTokens, type TokensRequest } from '../lib/design-tokens';
self.onmessage = async (event: MessageEvent<TokensRequest>): Promise<void> => {
  try {
    const { file, text, prefix } = event.data;
    if (file && file.size > 2 * 1024 * 1024) throw new Error('LIMIT');
    const result = await analyzeDesignTokens(
      file ? await file.text() : (text ?? ''),
      prefix,
    );
    self.postMessage({ result });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message.split('|')[0] });
  }
};
