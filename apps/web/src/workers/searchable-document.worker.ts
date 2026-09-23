import type { Worker as OcrWorker } from 'tesseract.js';
import {
  searchablePdf,
  validateScanPages,
  type ScanRequest,
  type ScanResult,
} from '@/lib/searchable-document';
self.onmessage = async (event: MessageEvent<ScanRequest>) => {
  let engine: OcrWorker | null = null;
  try {
    const request = event.data;
    validateScanPages(request.pages);
    let result: ScanResult;
    if (request.kind === 'pdf')
      result = {
        kind: 'pdf',
        bytes: await searchablePdf(request.pages, request.font),
      };
    else {
      if (!['eng', 'chi_sim', 'eng+chi_sim'].includes(request.language))
        throw new Error('language');
      const [{ createWorker }, { default: workerPath }] = await Promise.all([
        import('tesseract.js'),
        import('tesseract.js/dist/worker.min.js?url'),
      ]);
      engine = await createWorker(request.language, 1, {
        workerPath: new URL(workerPath, self.location.href).href,
        workerBlobURL: import.meta.env.PROD,
      });
      const pages = [];
      for (const page of request.pages) {
        const { data } = await engine.recognize(
          new Blob([new Uint8Array(page.image)], { type: 'image/png' }),
          {},
          { text: true, blocks: true },
        );
        const lines = (data.blocks ?? [])
          .flatMap((block) =>
            block.paragraphs.flatMap((paragraph) =>
              paragraph.lines.map((line) => ({
                text: line.text.trim(),
                ...line.bbox,
              })),
            ),
          )
          .filter(
            (line) => line.text && line.x1 > line.x0 && line.y1 > line.y0,
          );
        pages.push({ ...page, lines });
      }
      validateScanPages(pages);
      result = { kind: 'ocr', pages };
    }
    self.postMessage({ result });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  } finally {
    await engine?.terminate();
  }
};
