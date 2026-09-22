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

const CDN_MODULE_VERSIONS = {
  '@prometheus-io/lezer-promql': '0.313.3',
  'apache-arrow': '21.2.0',
  bson: '7.3.3',
  'ion-js': '5.2.1',
  'web-tree-sitter': '0.27.0',
  jose: '6.1.3',
  'paseto-ts': '2.0.6',
  openpgp: '6.3.1',
  'node-forge': '1.4.0',
  '@babel/parser': '8.0.5',
  '@asyncapi/parser': '3.6.3',
  '@bufbuild/cel': '0.6.1',
  'node-sql-parser': '5.4.0',
  'intl-messageformat': '12.1.0',
  protobufjs: '8.8.0',
  long: '5.3.2',
  'mqtt-packet': '9.0.2',
  three: '0.186.0',
  thumbhash: '0.1.1',
  blurhash: '2.0.5',
  svgpath: '2.6.0',
  '@faker-js/faker': '10.5.0',
  '@peculiar/x509': '2.0.0',
  '@tanstack/react-router': '1.161.3',
  '@webav/av-cliper': '1.2.8',
  ajv: '8.20.0',
  avsc: '5.7.9',
  asn1js: '3.0.10',
  browserslist: '4.29.0',
  'caniuse-lite': '1.0.30001810',
  buffer: '6.0.3',
  'cron-parser': '5.7.0',
  'crypto-js': '4.2.0',
  dexie: '4.3.0',
  exifr: '7.1.3',
  figlet: '1.11.4',
  fontkit: '2.0.4',
  jsonld: '9.0.0',
  'json-logic-js': '2.0.5',
  leaflet: '1.9.4',
  jsqr: '1.4.0',
  'libphonenumber-js': '1.13.10',
  mediabunny: '1.52.3',
  mermaid: '11.16.1',
  'pdf-lib': '1.17.1',
  'pdfjs-dist': '6.2.108',
  'postal-mime': '2.7.6',
  prettier: '3.8.1',
  react: '19.2.4',
  'react-dom': '19.2.4',
  'sql-formatter': '15.7.2',
  svgo: '4.0.2',
  terser: '5.46.0',
  wabt: '1.0.39',
  'wasm-webp': '0.1.0',
} as const;

const CDN_EXTERNAL_NAMES_PATTERN = Object.keys(CDN_MODULE_VERSIONS)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const CDN_EXTERNAL_PATTERN = new RegExp(
  `^(?!.*(?:\\.css$|\\?))(?:${CDN_EXTERNAL_NAMES_PATTERN})(?:/|$)`,
);

const REACT_CDN_BASE = `https://cdn.jsdelivr.net/npm/react@${CDN_MODULE_VERSIONS.react}`;
const REACT_IMPORT_MAP = {
  react: `${REACT_CDN_BASE}/+esm`,
  'react/jsx-runtime': `${REACT_CDN_BASE}/jsx-runtime/+esm`,
  'react/jsx-dev-runtime': `${REACT_CDN_BASE}/jsx-dev-runtime/+esm`,
  'react-dom': `https://cdn.jsdelivr.net/npm/react-dom@${CDN_MODULE_VERSIONS['react-dom']}/+esm`,
  'react-dom/client': `https://cdn.jsdelivr.net/npm/react-dom@${CDN_MODULE_VERSIONS['react-dom']}/client/+esm`,
  'https://cdn.jsdelivr.net/npm/react@19.2.0/+esm': `${REACT_CDN_BASE}/+esm`,
  'https://cdn.jsdelivr.net/npm/react@19.2.0/jsx-runtime/+esm': `${REACT_CDN_BASE}/jsx-runtime/+esm`,
  'https://cdn.jsdelivr.net/npm/react@19.2.0/jsx-dev-runtime/+esm': `${REACT_CDN_BASE}/jsx-dev-runtime/+esm`,
} as const;

function cdnModuleUrl(
  source: string,
  packageName: keyof typeof CDN_MODULE_VERSIONS,
): string {
  if (source === 'openpgp')
    return 'https://cdn.jsdelivr.net/npm/openpgp@6.3.1/dist/openpgp.min.mjs';
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
          children: JSON.stringify({ imports: REACT_IMPORT_MAP }),
          injectTo: 'head-prepend',
        },
      ];
    },
    writeBundle(_, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        if (/require\(\s*["']https:\/\/cdn\.jsdelivr/.test(output.code)) {
          this.error(`${output.fileName} requires a CDN module at runtime`);
        }
      }
    },
  };
}

// 回放引擎需要作为可信脚本文本装入隔离 iframe，生产仅在用户打开时请求 CDN。
function replayCdnAssets(): Plugin {
  const assets = ['rrweb/dist/rrweb.umd.cjs', 'rrweb/dist/style.css'];
  const prefix = '\0rrweb-cdn-text:';
  let production = false;
  return {
    name: 'rrweb-cdn-assets',
    enforce: 'pre',
    configResolved(config) {
      production = config.command === 'build';
    },
    resolveId(source) {
      if (!source.endsWith('?raw') || !assets.includes(source.slice(0, -4)))
        return null;
      const asset = source.slice(0, -4);
      return production
        ? prefix + asset + '.mjs'
        : fileURLToPath(
            new URL(`../../node_modules/${asset}`, import.meta.url),
          ) + '?raw';
    },
    load(id) {
      if (!id.startsWith(prefix)) return null;
      const url = `https://cdn.jsdelivr.net/npm/rrweb@2.1.4/${id.slice(prefix.length, -4).slice('rrweb/'.length)}`;
      return `const response = await fetch(${JSON.stringify(url)}); if (!response.ok) throw new Error('REPLAY_ASSET'); export default await response.text();`;
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
    replayCdnAssets(),
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
    plugins: () => [externalRequirePlugin(), cdnExternals()],
    rolldownOptions: {
      output: { paths: cdnExternalPath },
    },
  },
}));

export default config;
