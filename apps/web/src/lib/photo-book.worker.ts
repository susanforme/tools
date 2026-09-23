import {
  drawBookPage,
  type BookPage,
  type BookOptions,
} from './photo-book-layout';
export type BookRequest = {
  pages: BookPage[];
  images: Record<string, Blob>;
  options: BookOptions;
};
self.onmessage = async (event: MessageEvent<BookRequest>) => {
  try {
    const { pages, images, options } = event.data;
    if (
      !pages.length ||
      pages.length > 30 ||
      pages.some((p) => p.text.length > 1000)
    )
      throw new Error('bookLimit');
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    for (const page of pages) {
      const canvas = new OffscreenCanvas(1, 1);
      const layout = await drawBookPage(canvas, page, images, options);
      const blob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: 0.95,
      });
      canvas.width = canvas.height = 0;
      const image = await pdf.embedJpg(await blob.arrayBuffer());
      const p = pdf.addPage([
        (layout.width * 72) / 25.4,
        (layout.height * 72) / 25.4,
      ]);
      p.drawImage(image, {
        x: 0,
        y: 0,
        width: p.getWidth(),
        height: p.getHeight(),
      });
      p.setTrimBox(
        (options.bleed * 72) / 25.4,
        (options.bleed * 72) / 25.4,
        (options.width * 72) / 25.4,
        (options.height * 72) / 25.4,
      );
      p.setBleedBox(0, 0, p.getWidth(), p.getHeight());
    }
    const bytes = await pdf.save();
    self.postMessage({ result: bytes }, [bytes.buffer]);
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
