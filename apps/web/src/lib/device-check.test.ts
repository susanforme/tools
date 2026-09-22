import { afterEach, expect, it, vi } from 'vitest';
import { microphoneLevel, requestDeviceStream } from './device-check';
afterEach(() => vi.unstubAllGlobals());
it('stops every track if device permission arrives after cancellation', async () => {
  const stop = vi.fn();
  const stream = {
    getTracks: () => [{ stop }, { stop }],
  } as unknown as MediaStream;
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: async () => stream },
  });
  expect(await requestDeviceStream({ audio: true }, () => false)).toBeNull();
  expect(stop).toHaveBeenCalledTimes(2);
  expect(await requestDeviceStream({ audio: true }, () => true)).toBe(stream);
  expect(microphoneLevel(new Uint8Array([128, 128]))).toBe(0);
  expect(microphoneLevel(new Uint8Array([0, 255]))).toBe(100);
});
