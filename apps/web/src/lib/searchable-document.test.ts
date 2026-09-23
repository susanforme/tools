import { it, expect } from 'vitest';
import {
  PDFDocument,
  PDFArray,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from 'pdf-lib';
import {
  searchablePdf,
  validateScanPages,
  type ScanPage,
} from './searchable-document';
const png = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
    'base64',
  ),
);
const page: ScanPage = {
  name: 'scan',
  image: png,
  width: 1000,
  height: 600,
  lines: [
    { text: 'Corrected searchable text', x0: 50, y0: 40, x1: 700, y1: 80 },
  ],
};
it('writes corrected text as real invisible PDF text operators over the image', async () => {
  const pdf = await PDFDocument.load(await searchablePdf([page], null));
  const first = pdf.getPages()[0];
  expect(first.getSize()).toEqual({ width: 500, height: 300 });
  const contents = first.node
    .lookup(PDFName.of('Contents'), PDFArray)
    .asArray()
    .map((ref) => {
      const stream = pdf.context.lookup(ref);
      if (!(stream instanceof PDFRawStream)) throw new Error('expected stream');
      return new TextDecoder().decode(decodePDFRawStream(stream).decode());
    })
    .join('');
  expect(contents).toContain('3 Tr');
  expect(contents).toContain('Tj');
  expect(contents).toContain(
    Buffer.from('Corrected searchable text').toString('hex').toUpperCase(),
  );
  expect(first.node.Resources()?.lookup(PDFName.of('Font'))).toBeDefined();
});
it('requires a covering Unicode font and rejects out-of-page OCR geometry', async () => {
  await expect(
    searchablePdf(
      [{ ...page, lines: [{ ...page.lines[0], text: '中文' }] }],
      null,
    ),
  ).rejects.toThrow('fontRequired');
  expect(() =>
    validateScanPages([{ ...page, lines: [{ ...page.lines[0], x1: 1001 }] }]),
  ).toThrow('ocrData');
});
