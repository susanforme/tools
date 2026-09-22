// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DeviceCheckPage } from '../routes/device-check';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/hooks/useQueryParams', () => ({
  StringParam: {},
  NumberParam: {},
  useQueryParams: () => [{}, vi.fn()],
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('releases camera permission granted after navigating away', async () => {
  let grant: (stream: MediaStream) => void = () => undefined;
  const stop = vi.fn();
  const request = new Promise<MediaStream>((resolve) => {
    grant = resolve;
  });
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(() => request),
      enumerateDevices: async () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  const view = render(<DeviceCheckPage />);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'deviceCheck.start' })[0],
  );
  expect(screen.getByText('deviceCheck.waiting')).toBeTruthy();
  view.unmount();
  await act(async () => {
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await request;
  });
  expect(stop).toHaveBeenCalledOnce();
});
it('releases a stream when unmount falls between helper and caller continuations', async () => {
  let grant: (stream: MediaStream) => void = () => undefined;
  const stop = vi.fn();
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: () =>
        new Promise<MediaStream>((resolve) => {
          grant = resolve;
        }),
      enumerateDevices: async () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  const view = render(<DeviceCheckPage />);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'deviceCheck.start' })[0],
  );
  await act(async () => {
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await Promise.resolve();
    view.unmount();
  });
  expect(stop).toHaveBeenCalledOnce();
});
it('closes a speaker context if audio playback cannot resume', async () => {
  const close = vi.fn(async () => undefined);
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'suspended';
      close = close;
      resume = async () => {
        throw new Error('audio unavailable');
      };
    },
  );
  render(<DeviceCheckPage />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'deviceCheck.left' }));
  });
  expect(close).toHaveBeenCalledOnce();
  expect(screen.getByText('deviceCheck.failed')).toBeTruthy();
});
