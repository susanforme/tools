import {
  contentBounds,
  validateRect,
  type RedactRect,
} from './document-workspace-core';
import { loadRuntimeAssetUrl } from './runtime-assets';
export type PdfLayoutOptions = {
  crop: boolean;
  paper: string;
  header: string;
  footer: string;
  numbers: boolean;
  rectangles: RedactRect[];
};
export async function rebuildPdf(
  file: File,
  options: PdfLayoutOptions,
): Promise<Uint8Array> {
  if (
    file.size > 20 * 1024 * 1024 ||
    options.rectangles.length > 100 ||
    options.header.length > 120 ||
    options.footer.length > 120
  )
    throw new Error('size');
  options.rectangles.forEach(validateRect);
  const pdfjs = await import('pdfjs-dist');
  const { PDFDocument } = await import('pdf-lib');
  pdfjs.GlobalWorkerOptions.workerSrc = await loadRuntimeAssetUrl(
    'pdfWorker',
    'text/javascript',
  );
  const loading = pdfjs.getDocument({ data: await file.arrayBuffer() });
  try {
    const source = await loading.promise;
    if (
      source.numPages > 50 ||
      options.rectangles.some((rect) => rect.page > source.numPages)
    )
      throw new Error('pages');
    const output = await PDFDocument.create();
    let totalPixels = 0;
    for (let index = 1; index <= source.numPages; index++) {
      const page = await source.getPage(index);
      const viewport = page.getViewport({ scale: 2 });
      totalPixels += viewport.width * viewport.height;
      if (
        viewport.width * viewport.height > 16000000 ||
        totalPixels > 100000000
      )
        throw new Error('size');
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: options.crop });
      if (!ctx) throw new Error('canvas');
      try {
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        ctx.fillStyle = '#000';
        for (const rect of options.rectangles.filter(
          (rect) => rect.page === index,
        )) {
          const x = Math.floor((rect.x / 100) * canvas.width),
            y = Math.floor((rect.y / 100) * canvas.height);
          ctx.fillRect(
            x,
            y,
            Math.ceil(((rect.x + rect.width) / 100) * canvas.width) - x,
            Math.ceil(((rect.y + rect.height) / 100) * canvas.height) - y,
          );
        }
        const bounds = options.crop
          ? contentBounds(
              ctx.getImageData(0, 0, canvas.width, canvas.height).data,
              canvas.width,
              canvas.height,
            )
          : { x: 0, y: 0, width: canvas.width, height: canvas.height };
        const paper =
          options.paper === 'a4'
            ? [595.28, 841.89]
            : options.paper === 'letter'
              ? [612, 792]
              : [bounds.width / 2, bounds.height / 2];
        const header = options.header.trim(),
          footer = [
            options.footer.trim(),
            options.numbers ? `${index} / ${source.numPages}` : '',
          ]
            .filter(Boolean)
            .join('  ');
        const margin = header || footer ? 32 : 0;
        if (paper[0] < 80 || paper[1] < 80) throw new Error('size');
        const final = document.createElement('canvas');
        final.width = Math.ceil(paper[0] * 2);
        final.height = Math.ceil(paper[1] * 2);
        if (final.width * final.height > 16000000) throw new Error('size');
        const draw = final.getContext('2d');
        if (!draw) throw new Error('canvas');
        try {
          draw.fillStyle = '#fff';
          draw.fillRect(0, 0, final.width, final.height);
          const scale = Math.min(
            final.width / bounds.width,
            (final.height - margin * 4) / bounds.height,
          );
          draw.drawImage(
            canvas,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            (final.width - bounds.width * scale) / 2,
            margin * 2 +
              (final.height - margin * 4 - bounds.height * scale) / 2,
            bounds.width * scale,
            bounds.height * scale,
          );
          draw.fillStyle = '#111';
          draw.font = '22px sans-serif';
          draw.textAlign = 'center';
          draw.textBaseline = 'middle';
          if (header)
            draw.fillText(header, final.width / 2, 32, final.width - 24);
          if (footer)
            draw.fillText(
              footer,
              final.width / 2,
              final.height - 32,
              final.width - 24,
            );
          const image = await output.embedPng(final.toDataURL('image/png'));
          const dest = output.addPage(paper as [number, number]);
          dest.drawImage(image, {
            x: 0,
            y: 0,
            width: paper[0],
            height: paper[1],
          });
        } finally {
          final.width = final.height = 0;
        }
      } finally {
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    return await output.save();
  } finally {
    await loading.destroy();
  }
}
