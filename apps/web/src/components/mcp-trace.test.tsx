// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { Route } from '../routes/mcp-trace';

const delayed = vi.hoisted(() => {
  let release: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    ready,
    release,
    redact: vi.fn(() => ({ output: '[{"removed":"old selection"}]' })),
  };
});
vi.mock('@/lib/data-redactor', async () => {
  await delayed.ready;
  return { analyzeRedaction: delayed.redact };
});
vi.mock('@/hooks/useQueryParams', () => ({
  StringParam: {},
  withDefault: () => ({}),
  useQueryParams: () => [{ status: 'all' }, vi.fn()],
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('does not restore an old export selection after deselecting during lazy loading', async () => {
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null,
  };
  vi.stubGlobal(
    'Worker',
    vi.fn(function () {
      return worker;
    }),
  );
  const Page = Route.options.component as ComponentType;
  render(<Page />);
  fireEvent.click(screen.getByRole('button', { name: 'mcpTrace.sample' }));
  act(() =>
    worker.onmessage?.(
      new MessageEvent('message', {
        data: {
          result: {
            skipped: 0,
            calls: [
              {
                key: '0:1',
                session: 'sample',
                id: 1,
                method: 'tools/call',
                status: 'success',
                duration: 2,
                request: null,
                response: null,
              },
            ],
          },
        },
      }),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'mcpTrace.selectPage' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'mcpTrace.previewExport' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'mcpTrace.deselect' }));
  await act(async () => {
    delayed.release();
  });
  await waitFor(() => expect(delayed.redact).toHaveBeenCalled());
  expect(screen.queryByLabelText('mcpTrace.exportReview')).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'mcpTrace.download' }),
  ).toBeNull();
});
