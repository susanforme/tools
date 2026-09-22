import { PDFDocument } from 'pdf-lib';
import { expect, it } from 'vitest';
import {
  createPaperPdf,
  createPaperSheets,
  PAPER_TYPES,
  type PaperOptions,
} from './printable-paper';

const options: PaperOptions = {
  type: 'grid',
  spacing: 10,
  margin: 15,
  color: '#94a3b8',
  pages: 2,
  text: '春风',
};
it('keeps all paper geometry within A4 margins and paginates practice without dropping characters', async () => {
  for (const type of PAPER_TYPES)
    for (const sheet of createPaperSheets({ ...options, type })) {
      for (const line of sheet.lines) {
        expect(line.x1).toBeGreaterThanOrEqual(15);
        expect(line.x2).toBeLessThanOrEqual(195);
        expect(line.y1).toBeGreaterThanOrEqual(15);
        expect(line.y2).toBeLessThanOrEqual(282);
      }
      for (const dot of sheet.dots) expect(dot.y).toBeLessThanOrEqual(282);
    }
  const sheets = createPaperSheets({
    ...options,
    type: 'practice',
    spacing: 30,
    text: '一二三四五六七八九十',
  });
  expect(sheets).toHaveLength(2);
  expect(sheets[1]!.glyphs[0]!.text).toBe('九');
  expect(sheets[1]!.glyphs.some((glyph) => glyph.text === '十')).toBe(true);
  const combined = createPaperSheets({
    ...options,
    type: 'practice',
    pages: 0,
    text: 'e\u0301',
  });
  expect(combined).toHaveLength(1);
  expect(combined[0]!.glyphs.every((glyph) => glyph.text === 'e\u0301')).toBe(
    true,
  );
  expect(() => createPaperSheets({ ...options, spacing: 0 })).toThrow(
    'invalidOptions',
  );
  expect(() => createPaperSheets({ ...options, margin: Infinity })).toThrow();
  expect(() =>
    createPaperSheets({ ...options, type: 'practice', text: '' }),
  ).toThrow('invalidText');
  const pdf = await PDFDocument.load(await createPaperPdf(options));
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo((210 * 72) / 25.4);
});
