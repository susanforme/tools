import {
  checkTranslations,
  type TranslationRequest,
} from '../lib/i18n-checker';
self.onmessage = (event: MessageEvent<TranslationRequest>): void => {
  try {
    const { base, sources, rules } = event.data;
    self.postMessage({ result: checkTranslations(base, sources, rules) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
