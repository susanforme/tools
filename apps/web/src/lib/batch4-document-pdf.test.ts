// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { rebuildPdf } from './batch4-document-pdf';
const mocks = vi.hoisted(() => ({ destroy: vi.fn(), fillRect: vi.fn() }));
vi.mock('./runtime-assets', () => ({
  loadRuntimeAssetUrl: async () => '/pdf.worker.js',
}));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({
    destroy: mocks.destroy,
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 200, height: 300 }),
        render: () => ({ promise: Promise.resolve() }),
        cleanup: () => {},
      }),
    }),
  }),
}));
it('burns redaction into a fresh image-only PDF without source text, attachment or forms', async () => {
  const source = await PDFDocument.create();
  source.addPage([100, 150]).drawText('SECRET');
  await source.attach(new Uint8Array([1, 2]), 'secret.bin');
  source.getForm().createTextField('secretField');
  const bytes = await source.save();
  const file = new File([new Uint8Array(bytes)], 'source.pdf');
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => bytes.buffer,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() =>
      ({
        fillRect: mocks.fillRect,
        drawImage: () => {},
        fillText: () => {},
      }) as unknown as CanvasRenderingContext2D) as unknown as typeof HTMLCanvasElement.prototype.getContext,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
  );
  try {
    const output = await PDFDocument.load(
      await rebuildPdf(file, {
        crop: false,
        paper: 'original',
        header: '',
        footer: '',
        numbers: false,
        rectangles: [{ page: 1, x: 10, y: 20, width: 30, height: 40 }],
      }),
    );
    expect(mocks.fillRect).toHaveBeenCalledWith(20, 60, 60, 120);
    expect(output.catalog.get(PDFName.of('Names'))).toBeUndefined();
    expect(output.catalog.get(PDFName.of('AcroForm'))).toBeUndefined();
    const page = output.getPages()[0];
    expect(page.getSize()).toEqual({ width: 100, height: 150 });
    const objects = output.context.enumerateIndirectObjects();
    expect(
      objects.some(([, object]) => object.toString().includes('SECRET')),
    ).toBe(false);
    expect(
      objects.some(([, object]) =>
        object.toString().includes('/Subtype /Image'),
      ),
    ).toBe(true);
    expect(mocks.destroy).toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});
