// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { createInstance } from 'i18next';
import type { ComponentType } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, expect, it, vi } from 'vitest';
import { studyToolsZh } from '@/i18n/locales/study-tools';
import { Route } from '@/routes/label-maker';
const { rows, labels } = vi.hoisted(() => ({
  rows: vi.fn(),
  labels: vi.fn(() => ['data:image/png;base64,test']),
}));
vi.mock('@/hooks/useQueryParams', () => ({
  NumberParam: {},
  StringParam: {},
  useQueryParams: () => [{}, vi.fn()],
}));
vi.mock('@/lib/study-print', () => ({
  studyRows: rows,
  exportStudyPdf: vi.fn(),
}));
vi.mock('@/lib/label-maker', () => ({ makeLabels: labels }));
const i18n = createInstance();
await i18n.init({
  lng: 'zh',
  resources: { zh: { translation: studyToolsZh } },
  interpolation: { escapeValue: false },
});
const Page = Route.options.component as ComponentType;
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('drops an old CSV generation when text changes before parsing resolves', async () => {
  let resolveRows!: (rows: string[][]) => void;
  rows.mockReturnValue(
    new Promise<string[][]>((resolve) => {
      resolveRows = resolve;
    }),
  );
  render(
    <I18nextProvider i18n={i18n}>
      <Page />
    </I18nextProvider>,
  );
  fireEvent.change(
    screen.getByLabelText('每行一个标签；CSV 多列在同一标签内换行'),
    { target: { value: '旧内容' } },
  );
  fireEvent.click(screen.getByRole('button', { name: '生成打印预览' }));
  fireEvent.change(
    screen.getByLabelText('每行一个标签；CSV 多列在同一标签内换行'),
    { target: { value: '新内容' } },
  );
  await act(async () => resolveRows([['旧内容']]));
  expect(labels).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '下载 A4 PDF' })).toBeNull();
  expect(
    (screen.getByRole('button', { name: '生成打印预览' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it('does not finish a pending CSV generation after the page unmounts', async () => {
  let resolveRows!: (rows: string[][]) => void;
  rows.mockReturnValue(
    new Promise<string[][]>((resolve) => {
      resolveRows = resolve;
    }),
  );
  const view = render(
    <I18nextProvider i18n={i18n}>
      <Page />
    </I18nextProvider>,
  );
  fireEvent.change(
    screen.getByLabelText('每行一个标签；CSV 多列在同一标签内换行'),
    { target: { value: '内容' } },
  );
  fireEvent.click(screen.getByRole('button', { name: '生成打印预览' }));
  view.unmount();
  await act(async () => resolveRows([['内容']]));
  expect(labels).not.toHaveBeenCalled();
});
