import { loader } from '@monaco-editor/react';
import {
  loadRuntimeAssetUrl,
  MONACO_VS_CDN_BASE,
  type RuntimeAssetName,
} from './runtime-assets';

function workerAsset(label: string): RuntimeAssetName {
  if (label === 'json') return 'monacoJsonWorker';
  if (label === 'css' || label === 'scss' || label === 'less')
    return 'monacoCssWorker';
  if (label === 'html' || label === 'handlebars' || label === 'razor')
    return 'monacoHtmlWorker';
  if (label === 'typescript' || label === 'javascript') return 'monacoTsWorker';
  return 'monacoEditorWorker';
}

const environment: NonNullable<typeof self.MonacoEnvironment> = {
  async getWorker(_workerId: string, label: string) {
    const url = await loadRuntimeAssetUrl(
      workerAsset(label),
      'text/javascript',
    );
    return new Worker(url, { name: `monaco-${label}` });
  },
};

loader.config({ paths: { vs: MONACO_VS_CDN_BASE } });
void loader.init().then(
  () => {
    self.MonacoEnvironment = environment;
  },
  () => undefined,
);
