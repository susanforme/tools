// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import type { ComponentType } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, expect, it, vi } from 'vitest';
import { learningReadingZh } from '@/i18n/locales/learning-reading-tools';
import { Route } from '@/routes/typing-practice';
vi.mock('@/hooks/useQueryParams', () => ({
  StringParam: {},
  useQueryParam: () => ['custom', vi.fn()],
}));
const i18n = createInstance();
await i18n.init({
  lng: 'zh',
  resources: { zh: { translation: learningReadingZh } },
  interpolation: { escapeValue: false },
});
const Page = Route.options.component as ComponentType;
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it('does not finish or record intermediate IME text, and saves committed input once', () => {
  render(
    <I18nextProvider i18n={i18n}>
      <Page />
    </I18nextProvider>,
  );
  fireEvent.change(screen.getByLabelText('练习文本（最多 5000 字符）'), {
    target: { value: '你好' },
  });
  const input = screen.getByLabelText('输入即开始计时');
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: 'nihao' } });
  expect((input as HTMLTextAreaElement).disabled).toBe(false);
  expect(localStorage.getItem('tools-typing-scores')).toBeNull();
  fireEvent.change(input, { target: { value: '你好' } });
  fireEvent.compositionEnd(input, { data: '你好' });
  expect((input as HTMLTextAreaElement).disabled).toBe(true);
  expect(JSON.parse(localStorage.getItem('tools-typing-scores')!)).toHaveLength(
    1,
  );
  fireEvent.change(input, { target: { value: '你好' } });
  expect(JSON.parse(localStorage.getItem('tools-typing-scores')!)).toHaveLength(
    1,
  );
  expect(screen.getByText('100.0%')).toBeTruthy();
});
