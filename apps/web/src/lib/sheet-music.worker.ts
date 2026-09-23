import { cleanMusicXml } from './sheet-music';
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const file = event.data;
    if (file.size > 5_000_000) throw new Error('scoreLimit');
    let xml: string;
    if (/\.mxl$/i.test(file.name)) {
      const { unzipSync, strFromU8 } = await import('fflate');
      let total = 0,
        count = 0;
      const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter(entry) {
          count++;
          total += entry.originalSize;
          if (
            count > 100 ||
            total > 20_000_000 ||
            entry.originalSize > 5_000_000
          )
            throw new Error('scoreLimit');
          return /\.(xml|musicxml)$/i.test(entry.name);
        },
      });
      const container = files['META-INF/container.xml'];
      if (!container) throw new Error('score');
      const { XMLParser } = await import('fast-xml-parser');
      const manifest = new XMLParser({
        ignoreAttributes: false,
        processEntities: false,
      }).parse(strFromU8(container)) as {
        container?: {
          rootfiles?: {
            rootfile?:
              | { '@_full-path'?: string }
              | { '@_full-path'?: string }[];
          };
        };
      };
      const roots = manifest.container?.rootfiles?.rootfile;
      const root = Array.isArray(roots) ? roots[0] : roots;
      const path = root?.['@_full-path'];
      if (!path || !Object.hasOwn(files, path)) throw new Error('score');
      xml = strFromU8(files[path]!);
    } else xml = await file.text();
    self.postMessage({ result: cleanMusicXml(xml) });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
