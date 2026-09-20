import { describe, expect, it, vi } from 'vitest';
import { ocrPdfScale, recognizeFile, validateOcrFile } from './ocr';
import { filterParquetRows, parquetCell, parquetCsv } from './parquet-viewer';

describe('file inspection limits and data fidelity', () => {
  it('bounds OCR rendering and rejects unsupported inputs', () => {
    expect(ocrPdfScale(1000, 1000)).toBe(2);
    const scale = ocrPdfScale(10000, 10000);
    expect(10000 * 10000 * scale * scale).toBeLessThanOrEqual(16_000_000);
    expect(() => ocrPdfScale(0, 20)).toThrow();
    expect(() =>
      validateOcrFile({ name: 'document', type: 'application/pdf', size: 100 }),
    ).not.toThrow();
    expect(() =>
      validateOcrFile({ name: 'a.txt', type: 'text/plain', size: 10 }),
    ).toThrow();
    expect(() =>
      validateOcrFile({
        name: 'a.png',
        type: 'image/png',
        size: 21 * 1024 * 1024,
      }),
    ).toThrow();
  });
  it('rejects pending initialization and terminates the OCR worker on cancellation', async () => {
    const terminate = vi.fn();
    class PendingWorker {
      postMessage = vi.fn();
      terminate = terminate;
    }
    vi.stubGlobal('Worker', PendingWorker);
    try {
      const controller = new AbortController();
      const result = recognizeFile(
        new File(['image'], 'image.png', { type: 'image/png' }),
        'eng',
        controller.signal,
        () => {},
        () => {},
      );
      controller.abort();
      await expect(result).rejects.toMatchObject({ name: 'AbortError' });
      expect(terminate).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('preserves bigint/nested values and safely exports matching CSV rows', () => {
    expect(parquetCell(9007199254740993n)).toBe('9007199254740993');
    expect(parquetCell({ value: 12n })).toBe('{"value":"12"}');
    expect(parquetCell(null)).toBe('NULL');
    const rows = [
      ['Alice', '=1+1'],
      ['Bob', 'say "hi",\n世界'],
    ];
    expect(filterParquetRows(rows, ' ALICE ')).toEqual([rows[0]]);
    expect(parquetCsv(['name', 'value'], rows)).toContain('"\'=1+1"');
    expect(parquetCsv(['name', 'value'], rows)).toContain(
      '"say ""hi"",\n世界"',
    );
  });
});
