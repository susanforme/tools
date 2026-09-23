import { describe, expect, it } from 'vitest';
import {
  recolorSvg,
  shiftSubtitles,
  stampPdf,
  stereoCorrelation,
} from './next-media-tools';

describe('media finishing', () => {
  it('shifts SRT cues without changing their duration', () => {
    const result = shiftSubtitles('1\n00:00:01,000 --> 00:00:03,000\nHello', 2);
    expect(result).toContain('00:00:03,000 --> 00:00:05,000');
    expect(() =>
      shiftSubtitles('1\n00:00:01,000 --> 00:00:03,000\nHello', -2),
    ).toThrow();
  });
  it('recolors exact hex tokens only', () => {
    expect(
      recolorSvg('<svg fill="#fff" stroke="#ffffff"/>', '#fff', '#000'),
    ).toBe('<svg fill="#000" stroke="#ffffff"/>');
  });
  it('detects stereo phase inversion and mono cancellation', () => {
    const report = stereoCorrelation(
      new Float32Array([1, -1, 1, -1]),
      new Float32Array([-1, 1, -1, 1]),
    );
    expect(report.correlation).toBe(-1);
    expect(report.monoMixRms).toBe(0);
  });
  it('adds vector page text while retaining original PDF text', async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const source = await PDFDocument.create();
    source
      .addPage()
      .drawText('Original', {
        x: 20,
        y: 100,
        font: await source.embedFont(StandardFonts.Helvetica),
      });
    const file = new File([new Uint8Array(await source.save()).buffer], 'sample.pdf', {
      type: 'application/pdf',
    });
    const result = await stampPdf(file, 3);
    const output = await PDFDocument.load(result.download.bytes);
    expect(output.getPageCount()).toBe(1);
    expect(result.download.name).toBe('sample-numbered.pdf');
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loading = pdfjs.getDocument({
      data: result.download.bytes,
      useSystemFonts: true,
    });
    const document = await loading.promise;
    const text = await (await document.getPage(1)).getTextContent();
    expect(
      text.items.filter((item) => 'str' in item).map((item) => item.str),
    ).toContain('Original');
    await loading.destroy();
  });
});
