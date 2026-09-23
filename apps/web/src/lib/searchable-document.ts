import { ocrPdfScale } from './ocr';
import { loadRuntimeAssetUrl } from './runtime-assets';
export type ScanLine = {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};
export type ScanPage = {
  name: string;
  image: Uint8Array;
  width: number;
  height: number;
  lines: ScanLine[];
};
export type ScanRequest =
  | { kind: 'ocr'; pages: ScanPage[]; language: string }
  | { kind: 'pdf'; pages: ScanPage[]; font: Uint8Array | null };
export type ScanResult =
  | { kind: 'ocr'; pages: ScanPage[] }
  | { kind: 'pdf'; bytes: Uint8Array };
export async function prepareScanFiles(
  files: File[],
  signal: AbortSignal,
): Promise<ScanPage[]> {
  if (
    !files.length ||
    files.length > 20 ||
    files.reduce((sum, f) => sum + f.size, 0) > 60 * 1024 * 1024 ||
    files.some((f) => f.size > 20 * 1024 * 1024)
  )
    throw new Error('size');
  const result: ScanPage[] = [];
  let pixels = 0;
  const capture = async (canvas: HTMLCanvasElement, name: string) => {
    pixels += canvas.width * canvas.height;
    if (result.length >= 20 || pixels > 80000000) throw new Error('size');
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('canvas'))),
        'image/png',
      ),
    );
    signal.throwIfAborted();
    if (
      blob.size + result.reduce((sum, page) => sum + page.image.length, 0) >
      60 * 1024 * 1024
    )
      throw new Error('size');
    result.push({
      name,
      image: new Uint8Array(await blob.arrayBuffer()),
      width: canvas.width,
      height: canvas.height,
      lines: [],
    });
  };
  for (const file of files) {
    signal.throwIfAborted();
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = await loadRuntimeAssetUrl(
        'pdfWorker',
        'text/javascript',
      );
      signal.throwIfAborted();
      const loading = pdfjs.getDocument({ data: await file.arrayBuffer() });
      const abort = () => {
        void loading.destroy();
      };
      signal.addEventListener('abort', abort, { once: true });
      try {
        signal.throwIfAborted();
        const doc = await loading.promise;
        if (doc.numPages + result.length > 20) throw new Error('size');
        for (let n = 1; n <= doc.numPages; n++) {
          signal.throwIfAborted();
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 }),
            viewport = page.getViewport({
              scale: ocrPdfScale(base.width, base.height),
            });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          try {
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('canvas');
            await page.render({ canvas, canvasContext: ctx, viewport }).promise;
            await capture(canvas, `${file.name} · ${n}`);
          } finally {
            canvas.width = canvas.height = 0;
            page.cleanup();
          }
        }
      } finally {
        signal.removeEventListener('abort', abort);
        await loading.destroy();
      }
    } else {
      if (!/^image\/(png|jpeg|webp|bmp)$/.test(file.type))
        throw new Error('image');
      const bitmap = await createImageBitmap(file);
      try {
        signal.throwIfAborted();
        if (bitmap.width * bitmap.height > 16000000) throw new Error('size');
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('canvas');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bitmap, 0, 0);
          await capture(canvas, file.name);
        } finally {
          canvas.width = canvas.height = 0;
        }
      } finally {
        bitmap.close();
      }
    }
  }
  return result;
}
export function validateScanPages(pages: ScanPage[]): void {
  if (!pages.length || pages.length > 20) throw new Error('size');
  let pixels = 0,
    bytes = 0;
  for (const page of pages) {
    pixels += page.width * page.height;
    bytes += page.image.length;
    if (
      !Number.isInteger(page.width) ||
      !Number.isInteger(page.height) ||
      page.width < 1 ||
      page.height < 1 ||
      page.width * page.height > 16000000 ||
      pixels > 80000000 ||
      bytes > 60 * 1024 * 1024 ||
      page.image.length > 40 * 1024 * 1024 ||
      page.lines.length > 1000
    )
      throw new Error('size');
    for (const line of page.lines) {
      if (
        line.text.length > 5000 ||
        ![line.x0, line.x1, line.y0, line.y1].every(Number.isFinite) ||
        line.x0 < 0 ||
        line.y0 < 0 ||
        line.x1 > page.width ||
        line.y1 > page.height ||
        line.x1 <= line.x0 ||
        line.y1 <= line.y0
      )
        throw new Error('ocrData');
    }
  }
}
export async function searchablePdf(
  pages: ScanPage[],
  fontBytes: Uint8Array | null,
): Promise<Uint8Array> {
  validateScanPages(pages);
  const p = await import('pdf-lib');
  const pdf = await p.PDFDocument.create();
  let font;
  if (fontBytes) {
    if (fontBytes.length > 20 * 1024 * 1024) throw new Error('size');
    pdf.registerFontkit((await import('@pdf-lib/fontkit')).default);
    font = await pdf.embedFont(fontBytes, { subset: true });
  } else font = await pdf.embedFont(p.StandardFonts.Helvetica);
  const supported = new Set(font.getCharacterSet());
  for (const source of pages) {
    const width = source.width / 2,
      height = source.height / 2;
    const page = pdf.addPage([width, height]);
    const image = await pdf.embedPng(source.image);
    page.drawImage(image, { x: 0, y: 0, width, height });
    const key = page.node.newFontDictionary(font.name, font.ref);
    for (const line of source.lines) {
      const text = line.text.replace(/[\r\n\t]+/g, ' ').trim();
      if (!text) continue;
      if ([...text].some((c) => !supported.has(c.codePointAt(0)!)))
        throw new Error(fontBytes ? 'fontMissing' : 'fontRequired');
      const size = Math.max(1, (line.y1 - line.y0) / 2),
        naturalWidth = font.widthOfTextAtSize(text, size),
        scale = naturalWidth ? (line.x1 - line.x0) / 2 / naturalWidth : 1;
      page.pushOperators(
        p.pushGraphicsState(),
        p.beginText(),
        p.setFontAndSize(key, size),
        p.setTextRenderingMode(p.TextRenderingMode.Invisible),
        p.setTextMatrix(
          scale,
          0,
          0,
          1,
          line.x0 / 2,
          height - line.y1 / 2 + size * 0.15,
        ),
        p.showText(font.encodeText(text)),
        p.endText(),
        p.popGraphicsState(),
      );
    }
  }
  return pdf.save();
}
