import { validateSequence } from './media-workspace-core';
export type SequenceRequest = {
  frames: { blob: Blob; duration: number }[];
  width: number;
  height: number;
  format: 'gif' | 'webm';
};
self.onmessage = async (event: MessageEvent<SequenceRequest>) => {
  try {
    const { frames, width, height, format } = event.data;
    validateSequence(
      frames.map((f) => f.duration),
      width,
      height,
    );
    if (format === 'gif' && frames.length * width * height > 40_000_000)
      throw new Error('gifLimit');
    const canvas = new OffscreenCanvas(width, height),
      ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    const draw = async (blob: Blob) => {
      const image = await createImageBitmap(blob);
      try {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        const scale = Math.min(width / image.width, height / image.height);
        ctx.drawImage(
          image,
          (width - image.width * scale) / 2,
          (height - image.height * scale) / 2,
          image.width * scale,
          image.height * scale,
        );
      } finally {
        image.close();
      }
    };
    let bytes: Uint8Array;
    if (format === 'gif') {
      const { encode } = await import('modern-gif');
      const data: { data: Uint8Array<ArrayBuffer>; delay: number }[] = [];
      for (const f of frames) {
        await draw(f.blob);
        data.push({
          data: new Uint8Array(ctx.getImageData(0, 0, width, height).data),
          delay: f.duration,
        });
      }
      bytes = new Uint8Array(
        await encode({
          width,
          height,
          frames: data,
          looped: true,
          loopCount: 0,
          maxColors: 255,
          format: 'arrayBuffer',
        }),
      );
    } else {
      const {
        Output,
        BufferTarget,
        WebMOutputFormat,
        CanvasSource,
        canEncodeVideo,
      } = await import('mediabunny');
      const codec = (await canEncodeVideo('vp9', { width, height }))
        ? 'vp9'
        : (await canEncodeVideo('vp8', { width, height }))
          ? 'vp8'
          : null;
      if (!codec) throw new Error('codec');
      const target = new BufferTarget(),
        output = new Output({ format: new WebMOutputFormat(), target });
      const source = new CanvasSource(canvas, { codec, bitrate: 4_000_000 });
      output.addVideoTrack(source);
      await output.start();
      let at = 0;
      try {
        for (const f of frames) {
          await draw(f.blob);
          await source.add(at, f.duration / 1000);
          at += f.duration / 1000;
        }
        source.close();
        await output.finalize();
        if (!target.buffer) throw new Error('encode');
        bytes = new Uint8Array(target.buffer);
      } catch (e) {
        await output.cancel();
        throw e;
      }
    }
    self.postMessage({ result: bytes }, [bytes.buffer]);
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
