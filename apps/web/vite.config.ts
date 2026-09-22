import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { esmExternalRequirePlugin } from 'rolldown/plugins';
import Icons from 'unplugin-icons/vite';
import { defineConfig, type Plugin, type PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import wasm from 'vite-plugin-wasm';

const crossOriginIsolationHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// 非组件运行时依赖固定版本外置；组件及 Monaco 扩展保持本地构建。
const CDN_MODULE_VERSIONS = {
  '@asyncapi/parser': '3.6.3',
  '@babel/parser': '8.0.5',
  '@bufbuild/cel': '0.6.1',
  '@faker-js/faker': '10.5.0',
  '@ffmpeg/ffmpeg': '0.12.15',
  '@goodtools/wiregasm': '1.9.1',
  '@graphql-inspector/core': '8.0.0',
  '@jridgewell/trace-mapping': '0.3.31',
  '@msgpack/msgpack': '3.1.3',
  '@otplib/plugin-base32-scure': '13.4.1',
  '@otplib/plugin-crypto-web': '13.4.1',
  '@peculiar/x509': '2.0.0',
  '@prometheus-io/lezer-promql': '0.313.3',
  '@scure/bip39': '2.3.0',
  '@tanstack/react-query': '5.101.4',
  '@tanstack/react-router': '1.161.3',
  '@turf/area': '7.4.0',
  '@turf/length': '7.4.0',
  '@webav/av-cliper': '1.2.8',
  ajv: '8.20.0',
  'apache-arrow': '21.2.0',
  asn1js: '3.0.10',
  avsc: '5.7.9',
  'axe-core': '4.13.0',
  blurhash: '2.0.5',
  browserslist: '4.29.0',
  bson: '7.3.3',
  buffer: '6.0.3',
  'caniuse-lite': '1.0.30001810',
  'cbor-x': '1.6.5',
  'class-variance-authority': '0.7.1',
  clsx: '2.1.1',
  'cron-parser': '5.7.0',
  'crypto-js': '4.2.0',
  dexie: '4.3.0',
  'dexie-react-hooks': '4.2.0',
  diff: '8.0.2',
  dompurify: '3.4.13',
  exifr: '7.1.3',
  'fast-json-patch': '3.1.1',
  'fast-xml-parser': '5.11.1',
  fflate: '0.8.3',
  figlet: '1.11.4',
  fontkit: '2.0.4',
  'fuse.js': '7.5.0',
  graphql: '17.0.2',
  hono: '4.13.0',
  hyparquet: '1.31.0',
  'hyparquet-compressors': '1.1.1',
  i18next: '25.8.13',
  'ical.js': '2.2.1',
  ignore: '7.0.9',
  'intl-messageformat': '12.1.0',
  'ion-js': '5.2.1',
  jose: '6.1.3',
  jotai: '2.18.0',
  'js-yaml': '4.3.2',
  'json-logic-js': '2.0.5',
  jsonata: '2.2.2',
  'jsonc-parser': '3.3.1',
  jsonld: '9.0.0',
  'jsonpath-plus': '10.4.0',
  jsqr: '1.4.0',
  leaflet: '1.9.4',
  'libphonenumber-js': '1.13.10',
  long: '5.3.2',
  marked: '18.0.9',
  mediabunny: '1.52.3',
  mermaid: '11.16.1',
  'modern-gif': '2.1.0',
  'mqtt-packet': '9.0.2',
  mutative: '1.3.0',
  nanoid: '6.0.1',
  'node-forge': '1.4.0',
  'node-sql-parser': '5.4.0',
  openpgp: '6.3.1',
  otplib: '13.4.1',
  papaparse: '5.7.0',
  'paseto-ts': '2.0.6',
  'pdf-lib': '1.17.1',
  'pdfjs-dist': '6.2.108',
  picomatch: '4.0.7',
  plist: '5.0.0',
  'postal-mime': '2.7.6',
  prettier: '3.8.1',
  protobufjs: '8.8.0',
  punycode: '2.3.1',
  qrcode: '1.5.4',
  react: '19.2.4',
  'react-dom': '19.2.4',
  'react-i18next': '16.5.4',
  'reflect-metadata': '0.2.2',
  rrweb: '2.1.4',
  semver: '7.8.5',
  'smol-toml': '1.7.1',
  'spdx-exceptions': '2.5.0',
  'spdx-expression-parse': '5.0.0',
  'spdx-license-ids': '3.0.24',
  'sql-formatter': '15.7.2',
  'structured-headers': '2.0.3',
  svgo: '4.0.2',
  svgpath: '2.6.0',
  'tailwind-merge': '3.5.0',
  terser: '5.46.0',
  'tesseract.js': '7.0.0',
  three: '0.186.0',
  thumbhash: '0.1.1',
  ulid: '3.0.2',
  'use-mutative': '1.3.1',
  util: '0.12.5',
  wabt: '1.0.39',
  'wasm-webp': '0.1.0',
  'web-tree-sitter': '0.27.0',
  zundo: '2.3.0',
  zustand: '5.0.15',
} as const;

const CDN_EXTERNAL_NAMES_PATTERN = Object.keys(CDN_MODULE_VERSIONS)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const CDN_EXTERNAL_PATTERN = new RegExp(
  `^(?!.*(?:\\.css$|\\?))(?:${CDN_EXTERNAL_NAMES_PATTERN})(?:/|$)`,
);

const REACT_CDN_BASE = `https://cdn.jsdelivr.net/npm/react@${CDN_MODULE_VERSIONS.react}`;
const CDN_IMPORT_MAP = {
  react: `${REACT_CDN_BASE}/+esm`,
  'react/jsx-runtime': `${REACT_CDN_BASE}/jsx-runtime/+esm`,
  'react/jsx-dev-runtime': `${REACT_CDN_BASE}/jsx-dev-runtime/+esm`,
  'react-dom': `https://cdn.jsdelivr.net/npm/react-dom@${CDN_MODULE_VERSIONS['react-dom']}/+esm`,
  'react-dom/client': `https://cdn.jsdelivr.net/npm/react-dom@${CDN_MODULE_VERSIONS['react-dom']}/client/+esm`,
  // CDN 传递依赖也必须复用应用的 React、状态和数据库实例。
  ...Object.fromEntries(
    ['18.3.1', '19.1.1', '19.2.0', '19.2.7', '19.2.8'].map((version) => [
      `https://cdn.jsdelivr.net/npm/react@${version}/`,
      `${REACT_CDN_BASE}/`,
    ]),
  ),
  'https://cdn.jsdelivr.net/npm/dexie@4.2.0/': `https://cdn.jsdelivr.net/npm/dexie@${CDN_MODULE_VERSIONS.dexie}/`,
  'https://cdn.jsdelivr.net/npm/i18next@25.8.0/': `https://cdn.jsdelivr.net/npm/i18next@${CDN_MODULE_VERSIONS.i18next}/`,
  'https://cdn.jsdelivr.net/npm/zustand@5.0.1/': `https://cdn.jsdelivr.net/npm/zustand@${CDN_MODULE_VERSIONS.zustand}/`,
} as const;

function cdnModuleUrl(
  source: string,
  packageName: keyof typeof CDN_MODULE_VERSIONS,
): string {
  if (source === 'openpgp')
    return 'https://cdn.jsdelivr.net/npm/openpgp@6.3.1/dist/openpgp.min.mjs';
  if (source === '@ffmpeg/ffmpeg')
    return `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${CDN_MODULE_VERSIONS['@ffmpeg/ffmpeg']}/dist/esm/index.js`;
  const path = `${packageName}@${CDN_MODULE_VERSIONS[packageName]}${source
    .slice(packageName.length)
    .replace(
      /^\/addons\//,
      packageName === 'three' ? '/examples/jsm/' : '/addons/',
    )
    .replace(/\/$/, '')}`;
  return `https://cdn.jsdelivr.net/npm/${path}/+esm`;
}

function cdnExternalPath(source: string): string {
  const packageName = Object.keys(CDN_MODULE_VERSIONS).find(
    (name) => source === name || source.startsWith(`${name}/`),
  ) as keyof typeof CDN_MODULE_VERSIONS | undefined;
  return packageName ? cdnModuleUrl(source, packageName) : source;
}

function cdnExternals(): Plugin {
  return {
    name: 'cdn-externals',
    apply: 'build',
    enforce: 'pre',
    resolveId(source) {
      // CSS 等资源交给 Vite；它们不是可导入的 CDN JavaScript 模块。
      if (source.includes('?') || source.endsWith('.css')) return null;
      const packageName = Object.keys(CDN_MODULE_VERSIONS).find(
        (name) => source === name || source.startsWith(`${name}/`),
      ) as keyof typeof CDN_MODULE_VERSIONS | undefined;
      if (!packageName) return null;
      return {
        id: source,
        external: true,
      };
    },
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'importmap' },
          children: JSON.stringify({ imports: CDN_IMPORT_MAP }),
          injectTo: 'head-prepend',
        },
      ];
    },
    writeBundle(_, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const [id, module] of Object.entries(output.modules)) {
          if (module.renderedLength === 0) continue;
          const name = Object.keys(CDN_MODULE_VERSIONS).find((name) =>
            id.includes(`/node_modules/${name}/`),
          );
          if (name)
            this.error(`${output.fileName} bundles CDN dependency ${name}`);
        }
        if (/require\(\s*["']https:\/\/cdn\.jsdelivr/.test(output.code)) {
          this.error(`${output.fileName} requires a CDN module at runtime`);
        }
      }
    },
  };
}

// 原始脚本、Worker 入口和样式按需从 CDN 加载，开发时保持 Vite 本地解析。
function cdnAssets(): Plugin {
  const assets: Record<string, string> = {
    'rrweb/dist/rrweb.umd.cjs?raw': 'rrweb@2.1.4/dist/rrweb.umd.cjs',
    'rrweb/dist/style.css?raw': 'rrweb@2.1.4/dist/style.css',
    'axe-core/axe.min.js?raw': `axe-core@${CDN_MODULE_VERSIONS['axe-core']}/axe.min.js`,
    'dompurify/purify.min.js?raw': `dompurify@${CDN_MODULE_VERSIONS.dompurify}/dist/purify.min.js`,
    'leaflet/dist/leaflet.css': `leaflet@${CDN_MODULE_VERSIONS.leaflet}/dist/leaflet.css`,
    'tesseract.js/dist/worker.min.js?url': `tesseract.js@${CDN_MODULE_VERSIONS['tesseract.js']}/dist/worker.min.js`,
  };
  const prefix = '\0cdn-asset:';
  let production = false;
  return {
    name: 'cdn-assets',
    enforce: 'pre',
    configResolved(config) {
      production = config.command === 'build';
    },
    resolveId(source) {
      if (!Object.hasOwn(assets, source)) return null;
      if (!production && !/^(rrweb|axe-core)\//.test(source)) return null;
      return production
        ? prefix + source + '.mjs'
        : fileURLToPath(
            new URL(
              `../../node_modules/${source.replace(/\?raw$/, '')}`,
              import.meta.url,
            ),
          ) + (source.endsWith('?raw') ? '?raw' : '');
    },
    load(id) {
      if (!id.startsWith(prefix)) return null;
      const source = id.slice(prefix.length, -4);
      const url = `https://cdn.jsdelivr.net/npm/${assets[source]}`;
      if (source.endsWith('?url'))
        return `export default ${JSON.stringify(url)};`;
      if (source.endsWith('.css'))
        return `await new Promise((resolve, reject) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.crossOrigin = 'anonymous';
          link.href = ${JSON.stringify(url)};
          link.onload = resolve;
          link.onerror = () => { link.remove(); reject(new Error('CDN_ASSET: ' + link.href)); };
          document.head.append(link);
        });`;
      return `const response = await fetch(${JSON.stringify(url)}); if (!response.ok) throw new Error('CDN_ASSET: ' + response.status); export default await response.text();`;
    },
  };
}

const externalRequirePlugin = () =>
  esmExternalRequirePlugin({
    external: [CDN_EXTERNAL_PATTERN],
  });

const config = defineConfig(async ({ command }) => ({
  // logLevel: 'warn',
  define: {
    'process.env.NODE_DEBUG': JSON.stringify(''),
    // 大型 WASM 资源与 JS 一样固定版本；仅打开对应工具时请求。
    __WIREGASM_ASSET_BASE__: JSON.stringify(
      command === 'build'
        ? 'https://cdn.jsdelivr.net/npm/@goodtools/wiregasm@1.9.1/dist/'
        : '/@fs' +
            fileURLToPath(
              new URL(
                '../../node_modules/@goodtools/wiregasm/dist/',
                import.meta.url,
              ),
            ),
    ),
    __TREE_SITTER_WASM_URL__: JSON.stringify(
      'https://cdn.jsdelivr.net/npm/web-tree-sitter@0.27.0/web-tree-sitter.wasm',
    ),
    __HCL_WASM_URL__: JSON.stringify(
      'https://cdn.jsdelivr.net/npm/@tree-sitter-grammars/tree-sitter-hcl@1.2.0/tree-sitter-hcl.wasm',
    ),
  },
  resolve: {
    tsconfigPaths: true,
    alias: [
      { find: /^buffer$/, replacement: 'buffer/' },
      { find: /^util$/, replacement: 'util/' },
    ],
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  build: {
    rolldownOptions: {
      output: { paths: cdnExternalPath },
    },
  },
  plugins: [
    cdnAssets(),
    externalRequirePlugin(),
    cdnExternals(),
    Icons({ compiler: 'jsx', jsx: 'react' }),

    VitePWA({
      selfDestroying: true,
      manifest: {
        name: 'tools',
        short_name: 'tools',
        description: 'a simple tools collection for web developers',
        background_color: '#ffffff',
        display: 'standalone',
        screenshots: [
          {
            src: 'screenshot-desktop.png',
            sizes: '2560x1440',
            type: 'image/png',
            form_factor: 'wide',
            label: 'desktop application interface',
          },
          {
            src: 'screenshot-mobile.png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow', // 解决第二个警告：指定为移动端窄屏
            label: 'mobile application interface',
          },
        ],
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    wasm(),
    ...(process.env.ANALYZE
      ? [
          (await import('rollup-plugin-visualizer')).visualizer({
            filename: 'dist/bundle-analysis.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
          }) as PluginOption,
        ]
      : []),
  ],
  server: {
    headers: crossOriginIsolationHeaders,
    strictPort: true,
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5173,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  worker: {
    format: 'es' as const,
    plugins: () => [cdnAssets(), externalRequirePlugin(), cdnExternals()],
    rolldownOptions: {
      output: { paths: cdnExternalPath },
    },
  },
}));

export default config;
