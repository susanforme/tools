import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import wasm from 'vite-plugin-wasm';
import tsconfigPaths from 'vite-tsconfig-paths';
const config = defineConfig({
  // logLevel: 'warn',
  plugins: [
    VitePWA({
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
      },
      registerType: 'autoUpdate',
      // devOptions: {
      //   enabled: true,
      // },

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
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    wasm(),
  ],
  server: {
    strictPort: true,
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5173,
  },
});

export default config;
