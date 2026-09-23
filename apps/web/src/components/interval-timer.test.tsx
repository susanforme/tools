// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IntervalTimer } from './interval-timer';
vi.mock('@/hooks/useQueryParams', () => ({
  ArrayParam: {},
  NumberParam: {},
  useQueryParams: () => [
    { stageNames: ['Work', 'Rest'], stageSeconds: ['2', '1'], rounds: 2 },
    vi.fn(),
  ],
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('catches up delayed ticks, pauses and cleans up interval resources', () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const complete = vi.fn();
  render(<IntervalTimer onStart={vi.fn()} onComplete={complete} />);
  fireEvent.click(screen.getByRole('button', { name: 'batch3Calc.start' }));
  act(() => vi.advanceTimersByTime(2100));
  expect(complete).toHaveBeenCalledWith('Rest');
  fireEvent.click(screen.getByRole('button', { name: 'batch3Calc.pause' }));
  act(() => vi.advanceTimersByTime(10000));
  expect(complete).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'batch3Calc.start' }));
  act(() => {
    vi.setSystemTime(50000);
    vi.advanceTimersByTime(100);
  });
  expect(complete).toHaveBeenLastCalledWith('batch3Calc.done');
  expect(complete).toHaveBeenCalledTimes(2);
  cleanup();
  expect(vi.getTimerCount()).toBe(0);
});
