import type { LayoutFont } from '../lib/media-font';
self.onmessage = async (event: MessageEvent<File[]>) => {
  try {
    const { create } = await import('fontkit');
    const result: LayoutFont[] = [];
    for (const file of event.data) {
      if (
        file.size > 8 * 1024 * 1024 ||
        !/\.(ttf|otf|woff2?)$/i.test(file.name)
      )
        throw new Error('limit');
      const bytes = new Uint8Array(await file.arrayBuffer()),
        parsed = create(bytes as unknown as Buffer),
        font = 'fonts' in parsed ? parsed.fonts[0] : parsed;
      if (!font) throw new Error('invalid');
      const axes = Object.entries(font.variationAxes ?? {})
        .flatMap(([tag, axis]) =>
          axis
            ? [
                {
                  tag,
                  name: axis.name,
                  min: axis.min,
                  max: axis.max,
                  default: axis.default,
                },
              ]
            : [],
        )
        .filter((axis) => /^[\w ]{4}$/.test(axis.tag));
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      result.push({
        name: file.name,
        data: `data:font/${file.name.split('.').at(-1)};base64,${btoa(binary)}`,
        axes,
      });
    }
    self.postMessage({ result });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
