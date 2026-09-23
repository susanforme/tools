import { describe, it, expect } from 'vitest';
import { bookletSheets, createBooklet } from './practical-pdf';
import {
  compareManifests,
  duplicateGroups,
  relativeFiles,
  convertTextEncoding,
} from './practical-files';
import {
  generateSudoku,
  sudokuSolutions,
  wordSearch,
} from './practical-puzzles';
import {
  validateHabits,
  validateMeals,
  shoppingList,
  habitStreak,
  weekDays,
} from './practical-organizers';
import {
  decodeBands,
  encodeBands,
  decodeSmd,
  clockRemaining,
  switchClock,
  type ClockState,
} from './practical-resistor';
import { parseOutline, visibleOutline, escapeHtml } from './practical-outline';
import { spriteLayout } from './practical-sprites';
import {
  chordNotes,
  guitarShapes,
  transposeChart,
  stepTime,
  validateDrum,
} from './practical-music';
describe('practical tools', () => {
  it('imposes each original page exactly once and pads blank pages', () => {
    expect(bookletSheets(5)).toEqual([
      [null, 0],
      [1, null],
      [null, 2],
      [3, 4],
    ]);
    expect(bookletSheets(4, true)).toEqual([
      [0, 3],
      [2, 1],
    ]);
    expect(() => bookletSheets(201)).toThrow();
  });
  it('exports front/back booklet PDFs, including rotated pages', async () => {
    const { PDFDocument, degrees } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 5; i++) {
      const page = pdf.addPage([300, 500]);
      page.drawText(String(i + 1));
      page.setRotation(degrees((i % 4) * 90));
    }
    const file = new File([new Uint8Array(await pdf.save())], 'input.pdf');
    for (const [sides, count] of [
      ['all', 4],
      ['front', 2],
      ['back', 2],
    ] as const) {
      const result = await PDFDocument.load(
        await createBooklet(file, 'a4', 5, 'left', sides),
      );
      expect(result.getPageCount()).toBe(count);
      expect(result.getPage(0).getWidth()).toBeCloseTo(841.89);
    }
  });
  it('compares paths and content, and only groups identical hashes and sizes', () => {
    const before = [
        { path: 'a', size: 2, hash: 'x' },
        { path: 'b', size: 3, hash: 'y' },
      ],
      after = [
        { path: 'a', size: 2, hash: 'z' },
        { path: 'c', size: 2, hash: 'x' },
      ];
    expect(compareManifests(before, after).map((c) => c.status)).toEqual([
      'modified',
      'removed',
      'added',
    ]);
    expect(
      duplicateGroups([...before, { path: 'copy', size: 2, hash: 'x' }])[0]
        .paths,
    ).toEqual(['a', 'copy']);
    expect(
      relativeFiles([{ file: new File(['a'], 'a'), path: 'root/a' }], true)[0]
        .path,
    ).toBe('a');
    expect(() =>
      relativeFiles([{ file: new File([], 'a'), path: '../a' }], true),
    ).toThrow();
  });
  it('round-trips GB18030 and UTF-16 BOM, preserves line endings, rejects loss', async () => {
    const source = '你好🌍\r\nnext';
    const encoded = await convertTextEncoding(
      new TextEncoder().encode(source),
      'utf-8',
      'gb18030',
      false,
      'lf',
    );
    expect(new TextDecoder('gb18030').decode(encoded.bytes)).toBe(
      '你好🌍\nnext',
    );
    const utf16 = await convertTextEncoding(
      encoded.bytes,
      'gb18030',
      'utf-16be',
      true,
      'crlf',
    );
    expect(Array.from(utf16.bytes.slice(0, 2))).toEqual([254, 255]);
    expect(new TextDecoder('utf-16be').decode(utf16.bytes)).toBe(source);
    await expect(
      convertTextEncoding(
        encoded.bytes,
        'gb18030',
        'windows-1252',
        false,
        'keep',
      ),
    ).rejects.toThrow('replacement');
    await expect(
      convertTextEncoding(
        new Uint8Array([255]),
        'utf-8',
        'utf-8',
        false,
        'keep',
      ),
    ).rejects.toThrow('replacement');
  });
  it('generates unique sudoku and detects contradictory input', () => {
    const { board, solution } = generateSudoku('hard');
    expect(sudokuSolutions(board)).toEqual([solution]);
    expect(board.filter(Boolean).length).toBeLessThan(40);
    const invalid = [...board];
    invalid[0] = invalid[1] = 1;
    expect(() => sudokuSolutions(invalid)).toThrow('conflict');
  });
  it('places every word within bounds and does not overwrite shared letters', () => {
    const result = wordSearch(
      'REACT\nTYPESCRIPT\nCANVAS\nREACT',
      15,
      true,
      true,
    );
    expect(result.placements).toHaveLength(3);
    for (const placement of result.placements)
      expect(placement.cells.map((i) => result.grid[i]).join('')).toBe(
        placement.word,
      );
    expect(() => wordSearch('TOOLONG', 5, false, false)).toThrow();
  });
  it('validates stored data and aggregates matching ingredient units', () => {
    expect(
      validateHabits([
        { id: 'a', name: 'Walk', target: 7, dates: ['2026-02-30'] },
      ]),
    ).toBe(false);
    expect(habitStreak(['2026-09-20', '2026-09-21'], '2026-09-22')).toBe(2);
    expect(weekDays('2026-09-23')[0]).toBe('2026-09-21');
    const data = {
      recipes: [
        {
          id: 'r',
          name: 'Rice',
          servings: 2,
          ingredients: [{ name: 'rice', amount: 100, unit: 'g' }],
        },
      ],
      meals: [{ date: '2026-09-23', slot: 'lunch', recipe: 'r', servings: 3 }],
    };
    expect(validateMeals(data)).toBe(true);
    expect(shoppingList(data, ['2026-09-23'])[0].amount).toBe(150);
    expect(
      validateMeals({ ...data, meals: [...data.meals, ...data.meals] }),
    ).toBe(false);
  });
  it('decodes and reverses resistor bands without rounding unsupported values', () => {
    expect(decodeBands([1, 0, 2, 10]).value).toBe(1000);
    expect(decodeBands(encodeBands(4.7, 4)).value).toBeCloseTo(4.7);
    expect(() => encodeBands(123, 4)).toThrow();
    expect(decodeSmd('4R7')).toBe(4.7);
    expect(decodeSmd('1002')).toBe(10000);
    expect(decodeSmd('000')).toBe(0);
  });
  it('clock delay is spent before main time; increment cannot revive timeout', () => {
    const state: ClockState = {
      remaining: [10000, 10000],
      active: 0,
      running: true,
      started: 1000,
      delayLeft: 2000,
      moves: [0, 0],
    };
    expect(clockRemaining(state, 2000)).toEqual([10000, 10000]);
    expect(clockRemaining(state, 5000)).toEqual([8000, 10000]);
    expect(switchClock(state, 5000, 1000, 2000)).toMatchObject({
      remaining: [9000, 10000],
      active: 1,
      moves: [1, 0],
    });
    expect(switchClock(state, 14000, 1000, 2000).running).toBe(false);
  });
  it('parses headings and nested lists and hides descendants of collapsed nodes', () => {
    const nodes = parseOutline('# Root\n- Child\n  - Leaf\n## Other');
    expect(nodes.map((n) => n.parent)).toEqual([null, 0, 1, 0]);
    expect(visibleOutline(nodes, [1]).map((n) => n.label)).toEqual([
      'Root',
      'Child',
      'Other',
    ]);
    expect(escapeHtml('<script>"')).toBe('&lt;script&gt;&quot;');
  });
  it('packs sprites in bounded grid cells', () => {
    expect(
      spriteLayout(
        [
          { name: 'a', width: 10, height: 20 },
          { name: 'b', width: 20, height: 10 },
        ],
        2,
        2,
      ),
    ).toMatchObject({
      width: 42,
      height: 20,
      frames: [
        { x: 0, y: 0 },
        { x: 22, y: 0 },
      ],
    });
    expect(() =>
      spriteLayout([{ name: 'a', width: 10000, height: 10000 }], 1, 0),
    ).toThrow();
  });
  it('transposes chord roots and slash bass, finds all chord tones, and offsets swung steps', () => {
    expect(transposeChart('C Am F G/B Dm7 Cmaj7', 2)).toBe(
      'D Bm G A/C# Em7 Dmaj7',
    );
    const notes = chordNotes(0, 'major');
    const shapes = guitarShapes(notes);
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      const pitches = new Set(
        shape.flatMap((f, i) =>
          f < 0 ? [] : [([4, 9, 2, 7, 11, 4][i] + f) % 12],
        ),
      );
      expect([...pitches].sort()).toEqual([...notes].sort());
    }
    expect(stepTime(1, 120, 0.5)).toBe(0.1875);
    expect(stepTime(2, 120, 0.5)).toBe(0.25);
    expect(
      validateDrum({
        bpm: 120,
        swing: 0,
        steps: Array.from({ length: 4 }, () => Array<boolean>(16).fill(false)),
      }),
    ).toBe(true);
  });
});
