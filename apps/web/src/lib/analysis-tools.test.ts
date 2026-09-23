import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { aggregateChart, parseChartData } from './analysis-charts';
import {
  analyzeLogic,
  assignment,
  evaluateLogic,
  karnaughRows,
  parseLogic,
} from './analysis-logic';
import {
  binaryTrace,
  parseAlgorithmNumbers,
  pathTrace,
  sortTrace,
} from './analysis-algorithms';
import { packagingPdf, packagingPlan } from './analysis-packaging';
import { processCitations, type CitationRequest } from './analysis-citations';
describe('analysis workbench tools', () => {
  it('parses CSV/JSON and aggregates without coercing missing values', async () => {
    const parsed = await parseChartData(
      'Category,Value\nA,12\nB,18\nA,8',
      'csv',
    );
    expect(
      aggregateChart(parsed.rows, 'Category', 'Value', 'sum', 'bar'),
    ).toEqual([
      { label: 'A', x: 0, y: 20, count: 2 },
      { label: 'B', x: 1, y: 18, count: 1 },
    ]);
    expect(
      aggregateChart(parsed.rows, 'Category', 'Value', 'mean', 'line')[0].y,
    ).toBe(10);
    expect(
      aggregateChart(parsed.rows, 'Category', 'Value', 'count', 'pie')[0].y,
    ).toBe(2);
    const points = await parseChartData(
      '[{"x":-1,"y":2},{"x":3,"y":4}]',
      'json',
    );
    expect(
      aggregateChart(points.rows, 'x', 'y', 'sum', 'scatter').map(
        ({ x, y }) => [x, y],
      ),
    ).toEqual([
      [-1, 2],
      [3, 4],
    ]);
    await expect(parseChartData('a,a\n1,2', 'csv')).rejects.toThrow(
      'dataFormat',
    );
    await expect(
      parseChartData('[{"x":{"nested":1}}]', 'json'),
    ).rejects.toThrow('dataFormat');
    expect(() =>
      aggregateChart([{ x: 'a', y: '' }], 'x', 'y', 'sum', 'bar'),
    ).toThrow('numericColumn');
    expect(() =>
      aggregateChart([{ x: 'a', y: -1 }], 'x', 'y', 'sum', 'pie'),
    ).toThrow('pieValues');
  });
  it('simplifies logic equivalently, respects precedence and gives Gray-code maps', () => {
    expect(analyzeLogic('(A & B) | (A & !B)', 'A').equivalent).toBe(true);
    expect(analyzeLogic('NOT A AND B XOR C OR D').variables).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    for (const expression of [
      'A ^ B',
      '!(A | B) & C',
      '(A | B) & (!A | C)',
      'A ^ B ^ C ^ D ^ E ^ F',
      'A & !A',
      'A | !A',
      '1',
      '0',
    ]) {
      const result = analyzeLogic(expression);
      const simplified = parseLogic(result.simplified);
      result.rows.forEach((row, i) =>
        expect(evaluateLogic(simplified, assignment(result.variables, i))).toBe(
          row.output,
        ),
      );
    }
    expect(karnaughRows(4).columns).toEqual([0, 1, 3, 2]);
    expect(analyzeLogic('A', '!A').equivalent).toBe(false);
    expect(() => parseLogic('A && B')).toThrow('expressionInvalid');
    expect(() => analyzeLogic('A|B|C|D|E|F|G')).toThrow('variableLimit');
  });
  it('records real sorting, binary search, and weighted pathfinding steps', () => {
    for (const algorithm of ['bubble', 'selection', 'insertion']) {
      const trace = sortTrace([3, -1, 3, 0], algorithm);
      expect(trace[0].values).toEqual([3, -1, 3, 0]);
      expect(trace.at(-1)?.values).toEqual([-1, 0, 3, 3]);
      expect(trace.at(-1)?.comparisons).toBeGreaterThan(0);
    }
    expect(binaryTrace([-2, 0, 4, 9], 4).at(-1)?.found).toBe(2);
    expect(binaryTrace([-2, 0, 4, 9], 8).at(-1)?.found).toBeNull();
    expect(() => binaryTrace([3, 1], 1)).toThrow('sortedRequired');
    expect(() => parseAlgorithmNumbers('1,wat')).toThrow('algorithmLimit');
    const grid = [1, 5, 1, 1, 0, 1, 1, 1, 1];
    const path = pathTrace(grid, 3, 'dijkstra').at(-1)!;
    expect(path.path).toEqual([0, 3, 6, 7, 8]);
    expect(path.cost).toBe(4);
    expect(pathTrace([1, 0, 0, 1], 2, 'bfs').at(-1)?.found).toBeNull();
  });
  it('generates bounded dielines and actual-size / tiled PDF pages', async () => {
    for (const kind of ['box', 'bag', 'envelope']) {
      const plan = packagingPlan(kind, 80, 100, 50, 10);
      expect(plan.lines.some((line) => line.fold)).toBe(true);
      expect(
        plan.lines.every(
          (line) =>
            [line.x1, line.x2].every((x) => x >= 0 && x <= plan.width) &&
            [line.y1, line.y2].every((y) => y >= 0 && y <= plan.height),
        ),
      ).toBe(true);
      const pdf = await PDFDocument.load(await packagingPdf(plan, false));
      expect(pdf.getPageCount()).toBe(1);
      expect(pdf.getPage(0).getWidth()).toBeCloseTo((plan.width * 72) / 25.4);
    }
    const plan = packagingPlan('box', 180, 300, 90, 10);
    const tiled = await PDFDocument.load(await packagingPdf(plan, true));
    expect(tiled.getPageCount()).toBe(
      Math.ceil(plan.width / 190) * Math.ceil(plan.height / 277),
    );
    expect(() => packagingPlan('box', 0, 100, 50, 10)).toThrow(
      'packageDimensions',
    );
  });
  it('uses CSL styles and round-trips bibliography metadata through BibTeX and RIS', async () => {
    const entry = {
      id: 'one',
      type: 'book',
      title: 'Computing History',
      author: [{ family: 'Lovelace', given: 'Ada' }],
      issued: { 'date-parts': [[2024]] },
      publisher: 'Example Press',
      DOI: '10.1234/example',
    };
    const request: CitationRequest = {
      source: JSON.stringify([
        entry,
        { ...entry, id: 'two', DOI: 'https://doi.org/10.1234/EXAMPLE' },
      ]),
      input: 'json',
      output: 'bibtex',
      style: 'apa',
      locale: 'en-US',
      deduplicate: true,
      entry: 0,
    };
    const result = await processCitations(request);
    expect(result.count).toBe(1);
    expect(result.removed).toEqual(['Computing History']);
    expect(result.bibliography).toContain('Lovelace');
    expect(result.citation).toContain('2024');
    expect(result.output).toContain('@book');
    const ris = await processCitations({
      ...request,
      source: result.output,
      input: 'bibtex',
      output: 'ris',
      style: 'vancouver',
    });
    expect(ris.output).toContain('TY  - BOOK');
    const json = await processCitations({
      ...request,
      source: ris.output,
      input: 'ris',
      output: 'json',
      style: 'harvard1',
    });
    expect(JSON.parse(json.output)[0].title).toBe('Computing History');
    await expect(
      processCitations({
        ...request,
        source: 'https://example.com/refs',
        input: 'bibtex',
      }),
    ).rejects.toThrow('citationFormat');
    await expect(processCitations({ ...request, entry: 4 })).rejects.toThrow(
      'citationEntry',
    );
  });
});
