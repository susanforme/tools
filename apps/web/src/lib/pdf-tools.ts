import { parsePageSelection } from './pdf-pages';
import { loadRuntimeAssetUrl } from './runtime-assets';

export type ExtractedPdfImage = { blob: Blob; name: string };

export type PdfTextItem = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
};

export type PdfPagePreview = {
  dataUrl: string;
  width: number;
  height: number;
  items: PdfTextItem[];
};

export class PdfPasswordRequiredError extends Error {
  constructor() {
    super('PDF 需要密码');
    this.name = 'PdfPasswordRequiredError';
  }
}

export class PdfInvalidPasswordError extends Error {
  constructor() {
    super('PDF 密码错误');
    this.name = 'PdfInvalidPasswordError';
  }
}

export type PdfLoadOptions = {
  ignoreEncryption?: boolean;
  updateMetadata?: boolean;
};

async function loadPdfDocument(file: File, options: PdfLoadOptions = {}) {
  const { PDFDocument } = await import('pdf-lib');
  return PDFDocument.load(await file.arrayBuffer(), options);
}

export async function renderPdfPage(
  file: File,
  pageNumber = 1,
  password?: string,
): Promise<{ pageCount: number; page: PdfPagePreview }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = await loadRuntimeAssetUrl(
    'pdfWorker',
    'text/javascript',
  );
  const loading = pdfjs.getDocument({
    data: await file.arrayBuffer(),
    ...(password ? { password } : {}),
  });
  loading.onPassword = (
    updatePassword: (value: string) => void,
    reason: number,
  ) => {
    if (!password) throw new PdfPasswordRequiredError();
    if (reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD) {
      throw new PdfInvalidPasswordError();
    }
    updatePassword(password);
  };
  try {
    const document = await loading.promise;
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.25 });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器不支持 Canvas');
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const content = await page.getTextContent();
    const items: PdfTextItem[] = [];
    content.items.forEach((item, index) => {
      if (!('str' in item) || !item.str.trim()) return;
      const transform = item.transform;
      const scaleX = Math.hypot(transform[0]!, transform[1]!);
      const fontSize = Math.max(6, scaleX || item.height || 12);
      items.push({
        id: `${pageNumber}-${index}`,
        text: item.str,
        x: transform[4]! * 1.25,
        y: viewport.height - transform[5]! * 1.25 - fontSize * 1.25,
        width: Math.max(item.width * 1.25, 12),
        height: Math.max(item.height * 1.25, fontSize * 1.25),
        fontSize: fontSize * 1.25,
      });
    });
    return {
      pageCount: document.numPages,
      page: {
        dataUrl: canvas.toDataURL('image/png'),
        width: viewport.width,
        height: viewport.height,
        items,
      },
    };
  } finally {
    await loading.destroy();
  }
}

export async function editPdfText(
  file: File,
  edits: Record<string, PdfTextItem>,
  options: PdfLoadOptions = {},
): Promise<Uint8Array> {
  // ponytail: whiteout + Helvetica overlay; full content-stream editing needs a PDF engine.
  const { StandardFonts, rgb } = await import('pdf-lib');
  const document = await loadPdfDocument(file, options);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pages = document.getPages();
  for (const page of pages) {
    for (const [key, metadata] of Object.entries(edits)) {
      const [pageNumber] = key.split('-').map(Number);
      if (pageNumber !== pages.indexOf(page) + 1) continue;
      page.drawRectangle({
        x: metadata.x / 1.25,
        y: page.getHeight() - (metadata.y + metadata.height) / 1.25,
        width: metadata.width / 1.25,
        height: metadata.height / 1.25,
        color: rgb(1, 1, 1),
      });
      if (metadata.text.trim()) {
        page.drawText(metadata.text, {
          x: metadata.x / 1.25,
          y: page.getHeight() - (metadata.y + metadata.height * 0.85) / 1.25,
          size: metadata.fontSize / 1.25,
          font,
          color: rgb(0, 0, 0),
          maxWidth: metadata.width / 1.25,
        });
      }
    }
  }
  return document.save();
}

export async function getPdfPageCount(
  file: File,
  options: PdfLoadOptions = {},
): Promise<number> {
  return (await loadPdfDocument(file, options)).getPageCount();
}

export async function mergePdfs(
  files: File[],
  options: PdfLoadOptions = {},
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const output = await PDFDocument.create();
  for (const file of files) {
    const source = await loadPdfDocument(file, options);
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }
  return output.save();
}

export async function organizePdf(
  file: File,
  selection: string,
  rotation: number,
  options: PdfLoadOptions = {},
): Promise<Uint8Array> {
  const { degrees, PDFDocument } = await import('pdf-lib');
  const source = await loadPdfDocument(file, options);
  const output = await PDFDocument.create();
  const pages = await output.copyPages(
    source,
    parsePageSelection(selection, source.getPageCount()),
  );
  pages.forEach((page) => {
    page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
    output.addPage(page);
  });
  return output.save();
}

export async function splitPdf(
  file: File,
  options: PdfLoadOptions = {},
): Promise<Uint8Array[]> {
  const { PDFDocument } = await import('pdf-lib');
  const source = await loadPdfDocument(file, options);
  return Promise.all(
    source.getPageIndices().map(async (index) => {
      const output = await PDFDocument.create();
      const [page] = await output.copyPages(source, [index]);
      output.addPage(page!);
      return output.save();
    }),
  );
}

async function watermarkPng(text: string): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 180;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器不支持 Canvas');
  context.font = '700 72px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = 'rgba(80, 80, 80, 0.32)';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve),
  );
  if (!blob) throw new Error('水印生成失败');
  return new Uint8Array(await blob.arrayBuffer());
}

export async function watermarkPdf(
  file: File,
  text: string,
  options: PdfLoadOptions = {},
): Promise<Uint8Array> {
  const { degrees } = await import('pdf-lib');
  const document = await loadPdfDocument(file, options);
  const image = await document.embedPng(await watermarkPng(text));
  document.getPages().forEach((page) => {
    const width = Math.min(page.getWidth() * 0.7, 520);
    const height = (image.height / image.width) * width;
    page.drawImage(image, {
      x: (page.getWidth() - width) / 2,
      y: (page.getHeight() - height) / 2,
      width,
      height,
      rotate: degrees(-30),
    });
  });
  return document.save();
}

export async function cleanPdfMetadata(
  file: File,
  options: PdfLoadOptions = {},
): Promise<Uint8Array> {
  const { PDFDict, PDFName } = await import('pdf-lib');
  const document = await loadPdfDocument(file, {
    ...options,
    updateMetadata: false,
  });
  const info = document.context.trailerInfo.Info;
  if (info) {
    const dictionary = document.context.lookup(info, PDFDict);
    [
      'Title',
      'Author',
      'Subject',
      'Keywords',
      'Creator',
      'Producer',
      'CreationDate',
      'ModDate',
      'Trapped',
    ].forEach((key) => dictionary.delete(PDFName.of(key)));
  }
  return document.save();
}

type PdfImageSource = {
  bitmap?: ImageBitmap;
  data?: Uint8ClampedArray;
  height: number;
  width: number;
};

function isPdfImageSource(value: unknown): value is PdfImageSource {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'width') === 'number' &&
    typeof Reflect.get(value, 'height') === 'number'
  );
}

async function sourceToBlob(source: PdfImageSource): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器不支持 Canvas');
  if (source.bitmap) {
    context.drawImage(source.bitmap, 0, 0);
  } else if (source.data) {
    const rgba = new Uint8ClampedArray(source.width * source.height * 4);
    const channels = source.data.length / (source.width * source.height);
    for (let pixel = 0; pixel < source.width * source.height; pixel += 1) {
      rgba[pixel * 4] = source.data[pixel * channels]!;
      rgba[pixel * 4 + 1] =
        source.data[pixel * channels + (channels > 1 ? 1 : 0)]!;
      rgba[pixel * 4 + 2] =
        source.data[pixel * channels + (channels > 2 ? 2 : 0)]!;
      rgba[pixel * 4 + 3] =
        channels > 3 ? source.data[pixel * channels + 3]! : 255;
    }
    context.putImageData(
      new ImageData(rgba, source.width, source.height),
      0,
      0,
    );
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve),
  );
  if (!blob) throw new Error('图片导出失败');
  return blob;
}

export async function extractPdfImages(
  file: File,
  password?: string,
): Promise<ExtractedPdfImage[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = await loadRuntimeAssetUrl(
    'pdfWorker',
    'text/javascript',
  );
  const loading = pdfjs.getDocument({
    data: await file.arrayBuffer(),
    ...(password ? { password } : {}),
  });
  loading.onPassword = (updatePassword: (value: string) => void) => {
    if (!password) throw new PdfPasswordRequiredError();
    updatePassword(password);
  };
  const document = await loading.promise;
  const images: ExtractedPdfImage[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const operators = await page.getOperatorList();
    const seen = new Set<string>();
    for (let index = 0; index < operators.fnArray.length; index += 1) {
      const operation = operators.fnArray[index];
      const args = operators.argsArray[index];
      let source: unknown = null;
      let id = `inline-${index}`;
      if (operation === pdfjs.OPS.paintInlineImageXObject) {
        source = args?.[0];
      } else if (operation === pdfjs.OPS.paintImageXObject) {
        id = String(args?.[0]);
        if (seen.has(id)) continue;
        source = await new Promise<unknown>((resolve) =>
          page.objs.get(id, resolve),
        );
      }
      if (!isPdfImageSource(source)) continue;
      seen.add(id);
      images.push({
        blob: await sourceToBlob(source),
        name: `page-${pageNumber}-image-${images.length + 1}.png`,
      });
    }
  }
  await loading.destroy();
  return images;
}
