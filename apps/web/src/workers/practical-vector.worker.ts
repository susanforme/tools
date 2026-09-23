export type VectorTask = {
  image: ImageData;
  mode: string;
  colors: number;
  threshold: number;
  simplify: number;
};
self.onmessage = async (event: MessageEvent<VectorTask>) => {
  try {
    const { image, mode, colors, threshold, simplify } = event.data;
    if (
      image.width * image.height > 1_000_000 ||
      !Number.isInteger(colors) ||
      colors < 2 ||
      colors > 32 ||
      !Number.isFinite(threshold) ||
      threshold < 0 ||
      threshold > 255 ||
      !Number.isFinite(simplify) ||
      simplify < 0 ||
      simplify > 20
    )
      throw new Error('invalid');
    if (mode === 'monochrome')
      for (let i = 0; i < image.data.length; i += 4) {
        const shade =
          image.data[i] * 0.2126 +
            image.data[i + 1] * 0.7152 +
            image.data[i + 2] * 0.0722 >=
          threshold
            ? 255
            : 0;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = shade;
      }
    const tracer = (await import('imagetracerjs')).default;
    const svg = tracer.imagedataToSVG(image, {
      numberofcolors: mode === 'monochrome' ? 2 : colors,
      ltres: simplify,
      qtres: simplify,
      pathomit: 8,
      colorsampling: 2,
      viewbox: true,
      desc: false,
      strokewidth: 0,
      ...(mode === 'monochrome'
        ? {
            pal: [
              { r: 0, g: 0, b: 0, a: 255 },
              { r: 255, g: 255, b: 255, a: 255 },
            ],
          }
        : {}),
    });
    self.postMessage({ result: svg });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
