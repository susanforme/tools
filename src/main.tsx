import './i18n';
import './styles.css';

import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getRouter } from './router';

import { registerSW } from 'virtual:pwa-register';

registerSW({
  onNeedRefresh() {
    console.log('有新内容更新，请刷新');
    // 这里可以触发一个 UI Toast 提示用户刷新页面
  },
  onOfflineReady() {
    console.log('应用已完全缓存，可以离线使用了！');
  },
});

const router = getRouter();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
