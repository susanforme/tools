// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { Route } from '../routes/tuner';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/hooks/useQueryParams', () => ({
  NumberParam: {},
  useQueryParams: () => [{}, vi.fn()],
}));
afterEach(() => vi.unstubAllGlobals());

it('closes a pending audio context on unmount and stops a late microphone stream', async () => {
  const contexts: FakeContext[] = [];
  class FakeContext {
    state = 'running';
    constructor() {
      contexts.push(this);
    }
    resume = vi.fn(async () => {});
    close = vi.fn(async () => {
      this.state = 'closed';
    });
  }
  let grant: ((stream: MediaStream) => void) | null = null;
  const getUserMedia = vi.fn(
    () =>
      new Promise<MediaStream>((resolve) => {
        grant = resolve;
      }),
  );
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  const Component = Route.options.component as ComponentType;
  const view = render(<Component />);
  fireEvent.click(screen.getByRole('button', { name: 'tuner.start' }));
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
  view.unmount();
  expect(contexts[0].close).toHaveBeenCalledOnce();
  const stop = vi.fn();
  await act(async () => {
    grant!({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  });
  expect(stop).toHaveBeenCalledOnce();
  expect(contexts[0].close).toHaveBeenCalledOnce();
});
