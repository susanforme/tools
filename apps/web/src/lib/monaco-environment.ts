import { loadRuntimeAssetUrl, type RuntimeAssetName } from './runtime-assets';

function workerAsset(label: string): RuntimeAssetName {
  if (label === 'json') return 'monacoJsonWorker';
  if (label === 'css' || label === 'scss' || label === 'less')
    return 'monacoCssWorker';
  if (label === 'html' || label === 'handlebars' || label === 'razor')
    return 'monacoHtmlWorker';
  if (label === 'typescript' || label === 'javascript') return 'monacoTsWorker';
  return 'monacoEditorWorker';
}

export const MONACO_ENVIRONMENT: NonNullable<typeof self.MonacoEnvironment> = {
  async getWorker(_workerId: string, label: string) {
    const url = await loadRuntimeAssetUrl(
      workerAsset(label),
      'text/javascript',
    );
    return new Worker(url, { name: `monaco-${label}` });
  },
};

if (typeof self !== 'undefined') self.MonacoEnvironment = MONACO_ENVIRONMENT;
