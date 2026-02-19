import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import zh from './locales/zh';

export type Locale = 'zh' | 'en';
export const LOCALES: Locale[] = ['en', 'zh'];

export const STORAGE_KEY = 'devtools-lang';

/**
 * 仅在客户端调用（useEffect 内），用于检测用户偏好语言。
 * 不能在模块顶层同步调用，否则会导致 SSR/hydration 不匹配。
 */
export function detectClientLanguage(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && LOCALES.includes(stored)) return stored;
  const browser = navigator.language.split('-')[0];
  return browser === 'zh' ? 'zh' : 'en';
}

// 始终以默认语言 'en' 初始化，保证 SSR 与客户端首次 hydration 输出一致。
// 用户偏好语言在组件 mount 后的 useEffect 中切换。
i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: Locale) {
  i18n.changeLanguage(lang);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }
}

export default i18n;
