import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
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
  '@faker-js/faker': '10.5.0',
  '@peculiar/x509': '2.0.0',
  '@tanstack/react-router': '1.161.3',
  '@webav/av-cliper': '1.2.8',
  ajv: '8.20.0',
  asn1js: '3.0.10',
  'cron-parser': '5.7.0',
  'crypto-js': '4.2.0',
  dexie: '4.3.0',
  exifr: '7.1.3',
  figlet: '1.11.4',
  fontkit: '2.0.4',
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
  'wasm-webp': '0.1.0',
} as const;

const CDN_EXTERNAL_NAMES_PATTERN = Object.keys(CDN_MODULE_VERSIONS)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const CDN_EXTERNAL_PATTERN = new RegExp(
  `^(?:${CDN_EXTERNAL_NAMES_PATTERN})(?:/|$)`,
);

function cdnModuleUrl(
  source: string,
  packageName: keyof typeof CDN_MODULE_VERSIONS,
): string {
  const path = `${packageName}@${CDN_MODULE_VERSIONS[packageName]}${source.slice(packageName.length)}`;
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
      const packageName = Object.keys(CDN_MODULE_VERSIONS).find(
        (name) => source === name || source.startsWith(`${name}/`),
      ) as keyof typeof CDN_MODULE_VERSIONS | undefined;
      if (!packageName) return null;
      return {
        id: source,
        external: true,
      };
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

const externalRequirePlugin = () =>
  esmExternalRequirePlugin({
    external: [CDN_EXTERNAL_PATTERN],
  });

const config = defineConfig(async () => ({
  // logLevel: 'warn',
  resolve: {
    tsconfigPaths: true,
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
