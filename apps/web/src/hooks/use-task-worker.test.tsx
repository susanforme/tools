// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { expect, test, vi } from 'vitest';
import { useTaskWorker } from './use-task-worker';

test('terminates completed workers and rejects pending work when leaving the page', async () => {
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null,
  };
  const createWorker = (): Worker => worker as unknown as Worker;
  const { result, unmount } = renderHook(
    () => useTaskWorker<string, number>(createWorker),
    { wrapper: StrictMode },
  );
  let completed: Promise<number>;
  act(() => {
    completed = result.current('first');
  });
  expect(worker.postMessage).toHaveBeenCalledWith('first');
  act(() =>
    worker.onmessage?.(new MessageEvent('message', { data: { result: 42 } })),
  );
  await expect(completed!).resolves.toBe(42);
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  const pending = result.current('second');
  const rejection = expect(pending).rejects.toThrow('任务已取消');
  unmount();
  await rejection;
  expect(worker.terminate).toHaveBeenCalledTimes(2);
  await expect(result.current('after unmount')).rejects.toThrow('任务已取消');
});
