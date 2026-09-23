export function storyboardTimes(duration: number, interval: number): number[] {
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(interval) ||
    interval <= 0
  )
    throw new Error('invalid');
  const count = Math.ceil(duration / interval);
  if (count > 60) throw new Error('frames');
  return Array.from({ length: count }, (_, i) => i * interval);
}
export function videoTimecode(seconds: number): string {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
export async function seekStoryboardFrame(
  video: HTMLVideoElement,
  time: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) throw new Error('cancelled');
  if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= 2)
    return;
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', failed);
      signal.removeEventListener('abort', cancel);
      error ? reject(error) : resolve();
    };
    const done = () => finish(),
      failed = () => finish(new Error('video')),
      cancel = () => finish(new Error('cancelled'));
    const timer = setTimeout(() => finish(new Error('timeout')), 15000);
    video.addEventListener('seeked', done);
    video.addEventListener('error', failed);
    signal.addEventListener('abort', cancel, { once: true });
    video.currentTime = time;
  });
}
