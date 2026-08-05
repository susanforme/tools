import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import zh from './locales/zh';

export type Locale = 'zh' | 'en';
export const LOCALES: Locale[] = ['en', 'zh'];

const STORAGE_KEY = 'devtools-lang';

function detectLanguage(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && LOCALES.includes(stored)) return stored;
  const browser = navigator.language.split('-')[0];
  return browser === 'zh' ? 'zh' : 'en';
}

// 同步检测，在 init 时直接传入正确语言，避免首屏闪烁
const initialLang = detectLanguage();

i18n.use(initReactI18next).init({
  debug: false,
  showSupportNotice: false,
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: initialLang,
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
