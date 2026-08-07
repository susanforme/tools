import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parsePageSelection } from './pdf-pages';

export type ExtractedPdfImage = { blob: Blob; name: string };

export async function getPdfPageCount(file: File): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  return (await PDFDocument.load(await file.arrayBuffer())).getPageCount();
}

export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const output = await PDFDocument.create();
  for (const file of files) {
    const source = await PDFDocument.load(await file.arrayBuffer());
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }
  return output.save();
}

export async function organizePdf(
  file: File,
  selection: string,
  rotation: number,
): Promise<Uint8Array> {
  const { degrees, PDFDocument } = await import('pdf-lib');
  const source = await PDFDocument.load(await file.arrayBuffer());
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

export async function splitPdf(file: File): Promise<Uint8Array[]> {
  const { PDFDocument } = await import('pdf-lib');
  const source = await PDFDocument.load(await file.arrayBuffer());
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
): Promise<Uint8Array> {
  const { degrees, PDFDocument } = await import('pdf-lib');
  const document = await PDFDocument.load(await file.arrayBuffer());
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

export async function cleanPdfMetadata(file: File): Promise<Uint8Array> {
  const { PDFDict, PDFDocument, PDFName } = await import('pdf-lib');
  const document = await PDFDocument.load(await file.arrayBuffer(), {
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
): Promise<ExtractedPdfImage[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const loading = pdfjs.getDocument({ data: await file.arrayBuffer() });
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
