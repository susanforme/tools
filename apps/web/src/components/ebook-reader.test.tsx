// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createInstance } from 'i18next';
import type { ComponentType } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, expect, it, vi } from 'vitest';
import { learningReadingZh } from '@/i18n/locales/learning-reading-tools';
import { Route } from '@/routes/ebook-reader';
vi.mock('@/hooks/useQueryParams', () => ({
  NumberParam: {},
  StringParam: {},
  useQueryParam: () => ['original', vi.fn()],
  useQueryParams: () => [{ font: 20, line: 1.8 }, vi.fn()],
}));
vi.mock('@/lib/ebook-reader', () => ({
  readBook: vi.fn(async () => ({
    id: 'test-book',
    title: 'My book',
    urls: [],
    chapters: [
      { title: 'First', blocks: [{ text: 'First chapter body', image: null }] },
      {
        title: 'Second',
        blocks: [{ text: 'Second chapter body', image: null }],
      },
    ],
  })),
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
  vi.unstubAllGlobals();
  localStorage.clear();
});
it('restores each book position and saves bookmarks and chapter navigation', async () => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static revokeObjectURL = vi.fn();
    },
  );
  localStorage.setItem(
    'tools-book-test-book',
    JSON.stringify({ position: { chapter: 1, block: 0 }, bookmarks: [] }),
  );
  const view = render(
    <I18nextProvider i18n={i18n}>
      <Page />
    </I18nextProvider>,
  );
  fireEvent.change(screen.getByLabelText('选择或拖入 EPUB / TXT'), {
    target: { files: [new File([''], 'test.epub')] },
  });
  await waitFor(() =>
    expect(screen.getByText('Second chapter body')).toBeTruthy(),
  );
  fireEvent.click(screen.getByText('添加书签'));
  expect(
    JSON.parse(localStorage.getItem('tools-book-test-book')!).bookmarks,
  ).toHaveLength(1);
  fireEvent.click(screen.getByText('上一章'));
  expect(screen.getByText('First chapter body')).toBeTruthy();
  expect(
    JSON.parse(localStorage.getItem('tools-book-test-book')!).position.chapter,
  ).toBe(0);
  view.unmount();
  expect(
    JSON.parse(localStorage.getItem('tools-book-test-book')!).bookmarks[0]
      .chapter,
  ).toBe(1);
});
