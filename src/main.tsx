import './i18n';
import './styles.css';

import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getRouter } from './router';

import { registerSW } from 'virtual:pwa-register';

// 怎么做到点击才离线安装？
registerSW({
  onNeedRefresh() {
    console.log('update app');
    // 这里可以触发一个 UI Toast 提示用户刷新页面
  },
  onOfflineReady() {
    console.log('offline ready');
  },
  immediate: true,
});

const router = getRouter();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
