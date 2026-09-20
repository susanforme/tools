import { loadRuntimeAssetUrl } from './runtime-assets';

export type OcrLanguage = 'eng' | 'chi_sim' | 'eng+chi_sim';
export type OcrProgress = { page: number; pages: number; progress: number };
const MAX_PIXELS = 16_000_000;

export function validateOcrFile(
  file: Pick<File, 'size' | 'type' | 'name'>,
): void {
  if (file.size > 20 * 1024 * 1024) throw new Error('文件不能超过 20 MiB');
  if (
    !file.type.startsWith('image/') &&
    file.type !== 'application/pdf' &&
    !/\.pdf$/i.test(file.name)
  ) {
    throw new Error('请选择图片或 PDF');
  }
}

export function ocrPdfScale(width: number, height: number): number {
  if (!Number.isFinite(width * height) || width <= 0 || height <= 0) {
    throw new Error('页面尺寸无效');
  }
  return Math.min(2, Math.sqrt(MAX_PIXELS / (width * height)));
}

export async function recognizeFile(
  file: File,
  language: OcrLanguage,
  signal: AbortSignal,
  onProgress: (progress: OcrProgress) => void,
  onPage: (text: string, page: number) => void,
): Promise<void> {
  validateOcrFile(file);
  signal.throwIfAborted();
  const worker = new Worker(
    new URL('../workers/ocr.worker.ts', import.meta.url),
    { type: 'module' },
  );
  let pending: {
    resolve: (text: string) => void;
    reject: (error: Error) => void;
  } | null = null;
  let pageNumber = 1;
  let pageCount = 1;
  const stop = () => {
    worker.terminate();
    pending?.reject(new DOMException('Aborted', 'AbortError'));
    pending = null;
  };
  const request = (message: { language: OcrLanguage } | { image: Blob }) =>
    new Promise<string>((resolve, reject) => {
      signal.throwIfAborted();
      pending = { resolve, reject };
      worker.postMessage(message);
    });
  worker.onmessage = (
    event: MessageEvent<{ progress?: number; text?: string; error?: string }>,
  ) => {
    if (signal.aborted) return;
    if (event.data.progress !== undefined)
      onProgress({
        page: pageNumber,
        pages: pageCount,
        progress: event.data.progress,
      });
    if (event.data.error) {
      pending?.reject(new Error(event.data.error));
      pending = null;
    }
    if (event.data.text !== undefined) {
      pending?.resolve(event.data.text);
      pending = null;
    }
  };
  worker.onerror = (event) => {
    pending?.reject(new Error(event.message));
    pending = null;
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    await request({ language });
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
      const pdfjs = await import('pdfjs-dist');
      signal.throwIfAborted();
      pdfjs.GlobalWorkerOptions.workerSrc = await loadRuntimeAssetUrl(
        'pdfWorker',
        'text/javascript',
      );
      const loading = pdfjs.getDocument({ data: await file.arrayBuffer() });
      const stopPdf = () => {
        void loading.destroy();
      };
      signal.addEventListener('abort', stopPdf, { once: true });
      try {
        signal.throwIfAborted();
        const pdf = await loading.promise;
        pageCount = pdf.numPages;
        if (pageCount > 50) throw new Error('PDF 不能超过 50 页');
        for (pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          signal.throwIfAborted();
          const page = await pdf.getPage(pageNumber);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: ocrPdfScale(base.width, base.height),
          });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          try {
            const context = canvas.getContext('2d');
            if (!context) throw new Error('浏览器不支持 Canvas');
            await page.render({ canvas, canvasContext: context, viewport })
              .promise;
            signal.throwIfAborted();
            const blob = await new Promise<Blob>((resolve, reject) =>
              canvas.toBlob(
                (value) =>
                  value ? resolve(value) : reject(new Error('页面渲染失败')),
                'image/png',
              ),
            );
            const text = await request({ image: blob });
            signal.throwIfAborted();
            onPage(text, pageNumber);
          } finally {
            canvas.width = canvas.height = 0;
            page.cleanup();
          }
        }
      } finally {
        signal.removeEventListener('abort', stopPdf);
        await loading.destroy();
      }
    } else {
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > MAX_PIXELS)
          throw new Error('图片不能超过 1600 万像素');
        signal.throwIfAborted();
        const text = await request({ image: file });
        signal.throwIfAborted();
        onPage(text, 1);
      } finally {
        bitmap.close();
      }
    }
  } finally {
    signal.removeEventListener('abort', stop);
    worker.terminate();
  }
}
