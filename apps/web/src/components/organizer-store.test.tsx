// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useOrganizerStore } from './organizer-store';
const valid = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
it('writes independent keys and preserves state when validation, import or storage fails', async () => {
  const first = renderHook(() =>
    useOrganizerStore('first', [] as string[], valid),
  );
  const second = renderHook(() =>
    useOrganizerStore('second', [] as string[], valid),
  );
  act(() => {
    first.result.current.setData(['first']);
    second.result.current.setData(['second']);
  });
  expect(JSON.parse(localStorage.getItem('first')!).data).toEqual(['first']);
  const snapshot = localStorage.getItem('first');
  await act(async () => {
    await first.result.current.restore({
      size: 10,
      text: async () => '{"version":1,"tool":"first","data":[3]}',
    } as File);
  });
  expect(localStorage.getItem('first')).toBe(snapshot);
  expect(first.result.current.error).toBe('backupInvalid');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  act(() => {
    expect(first.result.current.setData(['lost'])).toBe(false);
  });
  expect(first.result.current.data).toEqual(['first']);
  expect(localStorage.getItem('first')).toBe(snapshot);
});
it('does not overwrite corrupt stored data and recovers with a validated backup', async () => {
  localStorage.setItem('broken', 'not JSON');
  const view = renderHook(() =>
    useOrganizerStore('broken', [] as string[], valid),
  );
  expect(view.result.current.ready).toBe(false);
  act(() => {
    expect(view.result.current.setData(['new'])).toBe(false);
  });
  expect(localStorage.getItem('broken')).toBe('not JSON');
  await act(async () => {
    await view.result.current.restore({
      size: 10,
      text: async () =>
        JSON.stringify({ version: 1, tool: 'broken', data: ['restored'] }),
    } as File);
  });
  expect(view.result.current.ready).toBe(true);
  expect(view.result.current.data).toEqual(['restored']);
});

it('rejects stale tab writes and cancels imports that finish after navigation', async () => {
  const first = renderHook(() =>
    useOrganizerStore('shared', [] as string[], valid),
  );
  const second = renderHook(() =>
    useOrganizerStore('shared', [] as string[], valid),
  );
  act(() => {
    first.result.current.setData(['fresh']);
  });
  act(() => {
    expect(second.result.current.setData(['stale'])).toBe(false);
  });
  expect(JSON.parse(localStorage.getItem('shared')!).data).toEqual(['fresh']);
  expect(second.result.current.error).toBe('changedElsewhere');
  let resolveText: (value: string) => void = () => {};
  const text = new Promise<string>((resolve) => {
    resolveText = resolve;
  });
  let restore: Promise<void> = Promise.resolve();
  act(() => {
    restore = first.result.current.restore({
      size: 10,
      text: () => text,
    } as File);
  });
  first.unmount();
  await act(async () => {
    resolveText(JSON.stringify({ version: 1, tool: 'shared', data: ['late'] }));
    await restore;
  });
  expect(JSON.parse(localStorage.getItem('shared')!).data).toEqual(['fresh']);
});
