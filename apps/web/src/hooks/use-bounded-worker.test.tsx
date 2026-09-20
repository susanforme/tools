// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { expect, test, vi } from 'vitest';
import { useBoundedWorker } from './use-bounded-worker';

test('terminates on timeout, cancellation and unmount, ignoring late results', () => {
  vi.useFakeTimers();
  const workers: Array<{
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
  }> = [];
  const create = (): Worker => {
    const worker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
    };
    workers.push(worker);
    return worker as unknown as Worker;
  };
  const { result, unmount } = renderHook(
    () => useBoundedWorker<string, string>(create, 100),
    { wrapper: StrictMode },
  );
  act(() => result.current.run('first'));
  act(() => vi.advanceTimersByTime(100));
  expect(result.current.error).toBe('TIMEOUT');
  expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  act(() =>
    workers[0].onmessage?.(
      new MessageEvent('message', { data: { result: 'stale' } }),
    ),
  );
  expect(result.current.result).toBeNull();
  act(() => result.current.run('second'));
  act(() => result.current.cancel());
  expect(result.current.error).toBe('CANCELLED');
  expect(workers[1].terminate).toHaveBeenCalledTimes(1);
  act(() => result.current.run('third'));
  unmount();
  expect(workers[2].terminate).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
