// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useLatestJob } from './practical-ui';
it('discards an old request even if the user switches away and back to its input', async () => {
  const hook = renderHook(({ input }) => useLatestJob<string>(input), {
    initialProps: { input: 'a' },
  });
  let resolve: (value: string) => void = () => {};
  let task: Promise<void>;
  act(() => {
    task = hook.result.current.run(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
  });
  expect(hook.result.current.busy).toBe(true);
  hook.rerender({ input: 'b' });
  hook.rerender({ input: 'a' });
  expect(hook.result.current.busy).toBe(false);
  await act(async () => {
    resolve('old');
    await task;
  });
  expect(hook.result.current.result).toBeNull();
  await act(() => hook.result.current.run(async () => 'new'));
  expect(hook.result.current.result).toBe('new');
  hook.unmount();
});

import { validateBoard } from './practical-whiteboard';
it('accepts bounded whiteboard backups and rejects invalid geometry or duplicate identities', () => {
  const shape = {
    id: 'shape-1',
    kind: 'pen',
    points: [
      [0, 0],
      [100, 100],
    ],
    color: '#2563eb',
    text: '',
  };
  expect(validateBoard([shape])).toBe(true);
  expect(validateBoard([shape, shape])).toBe(false);
  expect(
    validateBoard([
      {
        ...shape,
        points: [
          [0, 0],
          [Infinity, 0],
        ],
      },
    ]),
  ).toBe(false);
  expect(validateBoard([{ ...shape, kind: 'script' }])).toBe(false);
});
