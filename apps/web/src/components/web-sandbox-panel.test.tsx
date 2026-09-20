// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WebSandboxPanel } from './community-tool-panels';

vi.mock('@/components/monaco-editor', () => ({
  MonacoTextEditor: ({
    value,
    label,
    onChange,
  }: {
    value: string;
    label: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
vi.mock('@/hooks/useQueryParams', async () => {
  const { useState } = await import('react');
  return {
    StringParam: {},
    useQueryParam: (_name: string, _config: unknown, value: string) =>
      useState(value),
  };
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('debounces all three editors, reruns unchanged code, and cancels pending previews', () => {
  vi.useFakeTimers();
  const { unmount } = render(<WebSandboxPanel />);
  const preview = () =>
    screen.getByTitle<HTMLIFrameElement>('communityTools.sandboxPreview');
  const initialSource = preview().srcdoc;
  expect(preview().getAttribute('sandbox')).toBe('allow-scripts');

  fireEvent.change(screen.getByLabelText('HTML'), {
    target: { value: '<h1>First</h1>' },
  });
  act(() => vi.advanceTimersByTime(200));
  fireEvent.change(screen.getByLabelText('HTML'), {
    target: { value: '<h1>Latest</h1>' },
  });
  act(() => vi.advanceTimersByTime(299));
  expect(preview().srcdoc).toBe(initialSource);
  act(() => vi.advanceTimersByTime(1));
  expect(preview().srcdoc).toContain('<h1>Latest</h1>');

  fireEvent.mouseDown(screen.getByRole('tab', { name: 'CSS' }), {
    button: 0,
    ctrlKey: false,
  });
  fireEvent.change(screen.getByLabelText('CSS'), {
    target: { value: 'h1 { color: red; }' },
  });
  act(() => vi.advanceTimersByTime(300));
  expect(preview().srcdoc).toContain('h1 { color: red; }');

  fireEvent.mouseDown(screen.getByRole('tab', { name: 'JavaScript' }), {
    button: 0,
    ctrlKey: false,
  });
  fireEvent.change(screen.getByLabelText('JavaScript'), {
    target: { value: 'console.log("live");' },
  });
  // 手动运行立即应用编辑，并取消待执行的自动预览。
  fireEvent.click(screen.getByRole('button', { name: 'communityTools.run' }));
  expect(preview().srcdoc).toContain('console.log("live");');
  expect(vi.getTimerCount()).toBe(0);

  const previousFrame = preview();
  fireEvent.click(screen.getByRole('button', { name: 'communityTools.run' }));
  expect(preview()).not.toBe(previousFrame);
  expect(preview().srcdoc).toBe(previousFrame.srcdoc);

  fireEvent.change(screen.getByLabelText('JavaScript'), {
    target: { value: 'console.log("updated");' },
  });
  act(() => vi.advanceTimersByTime(300));
  expect(preview().srcdoc).toContain('console.log("updated");');
  fireEvent.change(screen.getByLabelText('JavaScript'), {
    target: { value: '' },
  });
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
