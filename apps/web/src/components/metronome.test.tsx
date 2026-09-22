// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { createElement, type ComponentType } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { Route } from '../routes/metronome';

vi.mock('@/hooks/useQueryParams', () => ({
  NumberParam: {},
  useQueryParams: () => [{ bpm: 120 }, vi.fn()],
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const contexts: FakeAudioContext[] = [];
class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  starts: number[] = [];
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => {
    this.state = 'closed';
    return Promise.resolve();
  });
  constructor() {
    contexts.push(this);
  }
  createOscillator() {
    return {
      frequency: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
      start: (time: number) => this.starts.push(time),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
}

afterEach(() => {
  cleanup();
  contexts.length = 0;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('starts only on request, schedules against audio time and closes audio on pause and navigation', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  const view = render(createElement(Route.options.component as ComponentType));
  expect(contexts).toHaveLength(0);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'metronome.start' }));
  });
  const first = contexts[0];
  expect(first.starts).toEqual([0.05]);
  first.currentTime = 0.5;
  act(() => {
    vi.advanceTimersByTime(25);
  });
  expect(first.starts).toEqual([0.05, 0.55]);
  fireEvent.click(screen.getByRole('button', { name: 'metronome.stop' }));
  expect(first.close).toHaveBeenCalledOnce();
  act(() => {
    vi.advanceTimersByTime(500);
  });
  expect(first.starts).toHaveLength(2);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'metronome.start' }));
  });
  view.unmount();
  expect(contexts[1].close).toHaveBeenCalledOnce();
});
