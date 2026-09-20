// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import HtmlAccessibilityPanel from './html-accessibility-panel';
import { ACCESSIBILITY_TIMEOUT_MS } from '@/lib/html-accessibility';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en' },
  }),
}));
vi.mock('axe-core/axe.min.js?raw', () => ({ default: '/* test audit */' }));
vi.mock('dompurify/purify.min.js?raw', () => ({
  default: '/* test sanitizer */',
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('discards a pending import on cancel and clears the timeout on unmount', async () => {
  vi.useFakeTimers();
  const view = render(<HtmlAccessibilityPanel />);
  fireEvent.click(
    screen.getByRole('button', { name: 'htmlAccessibility.run' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'htmlAccessibility.cancel' }),
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.queryByTitle('htmlAccessibility.preview')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  fireEvent.click(
    screen.getByRole('button', { name: 'htmlAccessibility.run' }),
  );
  view.unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(vi.getTimerCount()).toBe(0);
});

it('times out a frame that does not report and removes the preview', async () => {
  vi.useFakeTimers();
  render(<HtmlAccessibilityPanel />);
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'htmlAccessibility.run' }),
    );
    await Promise.resolve();
  });
  act(() => vi.advanceTimersByTime(ACCESSIBILITY_TIMEOUT_MS));
  expect(screen.getByRole('alert').textContent).toBe(
    'htmlAccessibility.failed',
  );
  expect(screen.queryByTitle('htmlAccessibility.preview')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
