/** 离开页面或取消授权后，迟到的设备流也必须立即释放。 */
export async function requestDeviceStream(
  constraints: MediaStreamConstraints,
  isCurrent: () => boolean,
): Promise<MediaStream | null> {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  if (isCurrent()) return stream;
  stream.getTracks().forEach((track) => track.stop());
  return null;
}

export function microphoneLevel(samples: Uint8Array): number {
  if (!samples.length) return 0;
  const energy = samples.reduce(
    (sum, sample) => sum + ((sample - 128) / 128) ** 2,
    0,
  );
  return Math.min(100, Math.round(Math.sqrt(energy / samples.length) * 200));
}
