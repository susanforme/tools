export type ImageFormat = 'webp' | 'gif';
export type ConversionDirection = 'webp-to-gif' | 'gif-to-webp';

export type AnimationConversionRequest = {
  direction: ConversionDirection;
  source: ArrayBuffer;
  quality: number;
};

export type AnimationConversionResult = {
  source: ArrayBuffer;
  frameCount: number;
  duration: number;
};

type AnimationFrame = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  duration: number;
};

const MAX_DECODED_BYTES = 128 * 1024 * 1024;
const MAX_FRAMES = 1_000;

export async function detectImageFormat(
  file: Blob,
): Promise<ImageFormat | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));

  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  return null;
}

function findWebpChunk(source: Uint8Array, name: string): number {
  const view = new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength,
  );
  let offset = 12;

  while (offset + 8 <= source.byteLength) {
    const chunkName = String.fromCharCode(...source.slice(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    if (chunkName === name) return offset;
    offset += 8 + size + (size & 1);
  }
  return -1;
}

export function readWebpLoopCount(source: Uint8Array): number | null {
  const offset = findWebpChunk(source, 'ANIM');
  if (offset < 0 || offset + 14 > source.byteLength) return null;
  return new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength,
  ).getUint16(offset + 12, true);
}

function validateFrames(frames: AnimationFrame[]): void {
  const decodedBytes = frames.reduce(
    (total, frame) => total + frame.data.byteLength,
    0,
  );
  if (
    frames.length === 0 ||
    frames.length > MAX_FRAMES ||
    decodedBytes > MAX_DECODED_BYTES
  ) {
    throw new Error('ANIMATION_TOO_LARGE');
  }
}

function gifDuration(duration: number): number {
  return Math.max(10, Math.round(duration / 10) * 10);
}

async function webpToGif(
  source: ArrayBuffer,
): Promise<AnimationConversionResult> {
  const bytes = new Uint8Array(source);
  const webp = await import('wasm-webp');
  const animationOffset = findWebpChunk(bytes, 'ANIM');
  let frames: AnimationFrame[];

  if (animationOffset >= 0) {
    const decoded = await webp.decodeAnimation(bytes, true);
    if (!decoded?.length) throw new Error('DECODE_FAILED');
    frames = decoded.map((frame) => ({
      data: frame.data,
      width: frame.width,
      height: frame.height,
      duration: gifDuration(frame.duration),
    }));
  } else {
    const decoded = await webp.decodeRGBA(bytes);
    if (!decoded) throw new Error('DECODE_FAILED');
    frames = [{ ...decoded, duration: 100 }];
  }

  validateFrames(frames);
  const { encode } = await import('modern-gif');
  const output = await encode({
    width: frames[0].width,
    height: frames[0].height,
    frames: frames.map((frame) => ({
      data: new Uint8Array(frame.data),
      delay: frame.duration,
    })),
    looped: frames.length > 1,
    loopCount: readWebpLoopCount(bytes) ?? 0,
    maxColors: 255,
    format: 'arrayBuffer',
  });

  return {
    source: output,
    frameCount: frames.length,
    duration: frames.reduce((total, frame) => total + frame.duration, 0),
  };
}

async function gifToWebp(
  source: ArrayBuffer,
  quality: number,
): Promise<AnimationConversionResult> {
  const { decode, decodeFrames } = await import('modern-gif');
  const gif = decode(source);
  const decoded = decodeFrames(source, { gif });
  const frames: AnimationFrame[] = decoded.map((frame) => ({
    data: frame.data,
    width: frame.width,
    height: frame.height,
    duration: Math.max(10, frame.delay),
  }));
  validateFrames(frames);

  const webp = await import('wasm-webp');
  const config = { lossless: 0, quality };
  const output =
    frames.length === 1
      ? await webp.encode(
          new Uint8Array(frames[0].data),
          frames[0].width,
          frames[0].height,
          true,
          config,
        )
      : await webp.encodeAnimation(
          frames[0].width,
          frames[0].height,
          true,
          frames.map((frame) => ({
            data: new Uint8Array(frame.data),
            duration: frame.duration,
            config,
          })),
        );
  if (!output) throw new Error('ENCODE_FAILED');

  return {
    source: output.slice().buffer,
    frameCount: frames.length,
    duration: frames.reduce((total, frame) => total + frame.duration, 0),
  };
}

export function convertAnimation(
  request: AnimationConversionRequest,
): Promise<AnimationConversionResult> {
  return request.direction === 'webp-to-gif'
    ? webpToGif(request.source)
    : gifToWebp(request.source, request.quality);
}
