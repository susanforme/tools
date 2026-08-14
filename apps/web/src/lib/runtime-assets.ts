import {
  importCachedCdnModule,
  loadCachedCdnAssetBuffer,
  loadCachedCdnAssetUrl,
} from './cdn-asset-cache';

const NPM_CDN = 'https://cdn.jsdelivr.net/npm';
const MONACO_VERSION = '0.55.1';

function npmAsset(packageName: string, version: string, path: string) {
  return `${NPM_CDN}/${packageName}@${version}/${path}`;
}

export const RUNTIME_ASSET_URLS = {
  bwipModule: npmAsset('@bwip-js/browser', '4.11.2', 'dist/bwip-js.mjs'),
  brotliGlue: npmAsset('brotli-wasm', '3.0.1', 'pkg.web/brotli_wasm.js'),
  brotliWasm: npmAsset('brotli-wasm', '3.0.1', 'pkg.web/brotli_wasm_bg.wasm'),
  jqWasm: npmAsset('jq-wasm', '3.0.0-jq-1.8.2', 'dist/build/jq.wasm'),
  jqGlue: npmAsset('jq-wasm', '3.0.0-jq-1.8.2', 'dist/chunk-OUKQZV2W.mjs'),
  immutableModule: npmAsset('immutable', '5.1.4', 'dist/immutable.es.js'),
  libxml2Module: npmAsset('libxml2-wasm', '0.7.1', 'lib/index.mjs'),
  minifyHtmlGlue: npmAsset('@minify-html/wasm', '0.18.1', 'index_bg.js'),
  minifyHtmlWasm: npmAsset('@minify-html/wasm', '0.18.1', 'index_bg.wasm'),
  openccCn2t: npmAsset('opencc-js', '1.4.1', 'dist/esm/cn2t.js'),
  openccT2cn: npmAsset('opencc-js', '1.4.1', 'dist/esm/t2cn.js'),
  pdfWorker: npmAsset('pdfjs-dist', '6.2.108', 'build/pdf.worker.min.mjs'),
  sevenZipGlue: npmAsset('7z-wasm', '1.2.0', '7zz.es6.js'),
  sevenZipWasm: npmAsset('7z-wasm', '1.2.0', '7zz.wasm'),
  sassDart: npmAsset('sass', '1.97.3', 'sass.dart.js'),
  sqliteGlue: npmAsset(
    '@sqlite.org/sqlite-wasm',
    '3.53.0-build1',
    'dist/index.mjs',
  ),
  sqliteWasm: npmAsset(
    '@sqlite.org/sqlite-wasm',
    '3.53.0-build1',
    'dist/sqlite3.wasm',
  ),
  zstdWasm: npmAsset('@bokuweb/zstd-wasm', '0.0.27', 'dist/esm/zstd.wasm'),
  zstdModule: npmAsset('@bokuweb/zstd-wasm', '0.0.27', 'dist/esm/index.web.js'),
  monacoEditorWorker: npmAsset(
    'monaco-editor',
    MONACO_VERSION,
    'min/vs/assets/editor.worker-Be8ye1pW.js',
  ),
  monacoCssWorker: npmAsset(
    'monaco-editor',
    MONACO_VERSION,
    'min/vs/assets/css.worker-HnVq6Ewq.js',
  ),
  monacoHtmlWorker: npmAsset(
    'monaco-editor',
    MONACO_VERSION,
    'min/vs/assets/html.worker-B51mlPHg.js',
  ),
  monacoJsonWorker: npmAsset(
    'monaco-editor',
    MONACO_VERSION,
    'min/vs/assets/json.worker-DKiEKt88.js',
  ),
  monacoTsWorker: npmAsset(
    'monaco-editor',
    MONACO_VERSION,
    'min/vs/assets/ts.worker-CMbG-7ft.js',
  ),
} as const;

export const MONACO_VS_CDN_BASE = npmAsset(
  'monaco-editor',
  MONACO_VERSION,
  'min/vs',
);

export type RuntimeAssetName = keyof typeof RUNTIME_ASSET_URLS;

const runtimeObjectUrls = new Map<string, Promise<string>>();

export function loadRuntimeAssetUrl(
  name: RuntimeAssetName,
  mimeType: string,
): Promise<string> {
  const key = `${name}:${mimeType}`;
  let url = runtimeObjectUrls.get(key);
  if (!url) {
    url = loadCachedCdnAssetUrl(RUNTIME_ASSET_URLS[name], mimeType);
    runtimeObjectUrls.set(key, url);
  }
  return url;
}

export function loadRuntimeWasm(name: RuntimeAssetName): Promise<ArrayBuffer> {
  return loadCachedCdnAssetBuffer(RUNTIME_ASSET_URLS[name]);
}

export function importRuntimeModule<T>(name: RuntimeAssetName): Promise<T> {
  return importCachedCdnModule<T>(RUNTIME_ASSET_URLS[name]);
}

export function importNetworkRuntimeModule<T>(
  name: RuntimeAssetName,
): Promise<T> {
  return import(/* @vite-ignore */ RUNTIME_ASSET_URLS[name]) as Promise<T>;
}
