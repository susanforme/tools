// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { createInstance } from 'i18next';
import type { ComponentType } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { focusToolsZh } from '@/i18n/locales/focus-tools';
import { Route as TimerRoute } from '@/routes/focus-timer';
import { Route as AmbientRoute } from '@/routes/ambient-sound';

const { query, setQuery } = vi.hoisted(() => ({
  query: {
    tab: 'countdown',
    minutes: 1 / 60,
    sound: '0',
    rain: 0,
    wind: 0,
    cafe: 0,
    white: 0,
    pink: 0,
    brown: 20,
    sleep: 0,
  },
  setQuery: vi.fn(),
}));
vi.mock('@/hooks/useQueryParams', () => ({
  ArrayParam: {},
  NumberParam: {},
  StringParam: {},
  useQueryParams: () => [query, setQuery],
}));
const i18n = createInstance();
await i18n.init({
  lng: 'zh',
  resources: { zh: { translation: focusToolsZh } },
  interpolation: { escapeValue: false },
});
const TimerPage = TimerRoute.options.component as ComponentType;
const AmbientPage = AmbientRoute.options.component as ComponentType;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  localStorage.clear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('focus tool lifecycle', () => {
  it('completes a countdown exactly once after a delayed tick, and pause preserves remaining time', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TimerPage />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '添加计时器' }));
    fireEvent.click(screen.getAllByRole('button', { name: '开始' })[0]);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.click(screen.getByRole('button', { name: '暂停' }));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByText('时间到')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: '开始' })[0]);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByText('时间到')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('计时器 1：时间到');
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts audio only on user action and closes audio resources when leaving', async () => {
    const source = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
      loop: false,
    };
    const gain = () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
    });
    const close = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn().mockResolvedValue(undefined);
    const suspend = vi.fn().mockResolvedValue(undefined);
    const context = vi.fn(function () {
      return {
        state: 'running',
        currentTime: 0,
        sampleRate: 100,
        destination: {},
        createGain: gain,
        createDynamicsCompressor: () => ({
          connect: vi.fn(),
          disconnect: vi.fn(),
        }),
        createBufferSource: () => source,
        createBuffer: () => ({ length: 1000, copyToChannel: vi.fn() }),
        resume,
        suspend,
        close,
      };
    });
    vi.stubGlobal('AudioContext', context);
    const { unmount } = render(
      <I18nextProvider i18n={i18n}>
        <AmbientPage />
      </I18nextProvider>,
    );
    expect(context).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '开始' }));
    });
    expect(resume).toHaveBeenCalledOnce();
    expect(source.start).toHaveBeenCalledOnce();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '暂停' }));
    });
    expect(suspend).toHaveBeenCalledOnce();
    unmount();
    expect(source.stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
