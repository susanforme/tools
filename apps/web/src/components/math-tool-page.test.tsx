// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mathToolsZh } from '@/i18n/locales/math-tools';
import { MathToolPage } from './math-tool-page';

const { query, setQuery } = vi.hoisted(() => ({
  query: {} as { mode?: string; digits?: number; places?: number },
  setQuery: vi.fn(),
}));
vi.mock('@/hooks/useQueryParams', () => ({
  NumberParam: {},
  StringParam: {},
  useQueryParams: () => [query, setQuery],
}));
const i18n = createInstance();
await i18n.init({
  lng: 'zh',
  resources: { zh: { translation: mathToolsZh } },
  interpolation: { escapeValue: false },
});
const page = (tool: Parameters<typeof MathToolPage>[0]['tool']) => (
  <I18nextProvider i18n={i18n}>
    <MathToolPage tool={tool} />
  </I18nextProvider>
);
beforeEach(() => {
  for (const key of Object.keys(query)) delete query[key as keyof typeof query];
  setQuery.mockClear();
});
afterEach(cleanup);

it('calculates fractions, clears stale results on edit, and shows translated validation errors', () => {
  render(page('fraction-calculator'));
  fireEvent.click(screen.getByRole('button', { name: '计算' }));
  expect(screen.getByText('1/2')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('分数 B'), {
    target: { value: '1/0' },
  });
  expect(screen.queryByRole('region', { name: '计算结果' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '计算' }));
  expect(screen.getByRole('alert').textContent).toContain('除数或分母不能为零');
  fireEvent.click(screen.getByRole('button', { name: '恢复示例' }));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('restores URL options, invalidates results after URL changes and ignores unused matrix B', () => {
  query.mode = 'inverse';
  const view = render(page('matrix-calculator'));
  expect(screen.queryByLabelText('矩阵 B')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '计算' }));
  expect(screen.getByRole('region', { name: '计算结果' })).toBeTruthy();
  query.mode = 'multiply';
  view.rerender(page('matrix-calculator'));
  expect(screen.getByLabelText('矩阵 B')).toBeTruthy();
  expect(screen.queryByRole('region', { name: '计算结果' })).toBeNull();
});

it('restores rounding precision from the URL and preserves empty input validation', () => {
  query.places = 1;
  render(page('rounding-calculator'));
  const precision = screen.getByLabelText('小数位（-20–20）');
  expect((precision as HTMLInputElement).value).toBe('1');
  fireEvent.click(screen.getByRole('button', { name: '计算' }));
  expect(screen.getByText('-1.3')).toBeTruthy();
  fireEvent.change(precision, { target: { value: '' } });
  expect(setQuery).toHaveBeenCalledWith({ places: undefined });
});
