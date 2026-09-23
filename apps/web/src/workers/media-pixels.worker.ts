import {
  pixelFrame,
  validPixelProject,
  type PixelProject,
} from '../lib/media-pixels';
self.onmessage = async (
  event: MessageEvent<{ project: PixelProject; fps: number }>,
) => {
  try {
    const { project, fps } = event.data;
    if (
      !validPixelProject(project) ||
      !Number.isFinite(fps) ||
      fps < 1 ||
      fps > 50
    )
      throw new Error('invalid');
    const { encode } = await import('modern-gif');
    const result = await encode({
      width: project.width,
      height: project.height,
      frames: project.frames.map((_, i) => ({
        data: new Uint8Array(pixelFrame(project, i)),
        delay: Math.round(1000 / fps),
      })),
      looped: true,
      loopCount: 0,
      maxColors: 255,
      format: 'arrayBuffer',
    });
    self.postMessage({ result: new Uint8Array(result) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
