import { describe, it, expect } from 'vitest';
import {
  countNonogramSolutions,
  generatePuzzles,
  nonogramClues,
} from './puzzle-book-generator';
const words =
  'REACT | UI library\nCANVAS | Drawing surface\nBROWSER | Web app\nSCRIPT | Program\nARRAY | Ordered values\nSTATE | Current data';
describe('puzzle book generation', () => {
  it('makes reproducible connected perfect mazes with valid entrance-to-exit answers', () => {
    const req = {
      mode: 'maze' as const,
      difficulty: 'medium',
      seed: 42,
      count: 2,
      words: '',
    };
    const pages = generatePuzzles(req);
    expect(pages).toEqual(generatePuzzles(req));
    expect(pages[0].grid).not.toEqual(pages[1].grid);
    for (const page of pages) {
      const open = page.grid
          .map((v, i) => (v === '#' ? -1 : i))
          .filter((i) => i >= 0),
        seen = new Set([open[0]]),
        stack = [open[0]];
      let edges = 0;
      while (stack.length) {
        const at = stack.pop()!;
        for (const next of [
          at - page.size,
          at + page.size,
          at % page.size ? at - 1 : -1,
          at % page.size < page.size - 1 ? at + 1 : -1,
        ]) {
          if (next < 0 || next >= page.grid.length || page.grid[next] === '#')
            continue;
          edges++;
          if (!seen.has(next)) {
            seen.add(next);
            stack.push(next);
          }
        }
      }
      expect(seen.size).toBe(open.length);
      expect(edges / 2).toBe(open.length - 1);
      expect(new Set(page.path).size).toBe(page.path.length);
      for (let i = 1; i < page.path.length; i++)
        expect([1, page.size]).toContain(
          Math.abs(page.path[i] - page.path[i - 1]),
        );
      expect(page.path.every((i) => page.grid[i] !== '#')).toBe(true);
    }
  });
  it('counts nonogram solutions against every 3x3 binary board', () => {
    const cases = new Map<
      string,
      { rows: number[][]; columns: number[][]; count: number }
    >();
    for (let bits = 0; bits < 512; bits++) {
      const rows = Array.from({ length: 3 }, (_, r) =>
          nonogramClues(
            Array.from({ length: 3 }, (_, c) => (bits >> (r * 3 + c)) & 1),
          ),
        ),
        columns = Array.from({ length: 3 }, (_, c) =>
          nonogramClues(
            Array.from({ length: 3 }, (_, r) => (bits >> (r * 3 + c)) & 1),
          ),
        );
      const key = JSON.stringify([rows, columns]);
      const previous = cases.get(key);
      cases.set(key, { rows, columns, count: (previous?.count ?? 0) + 1 });
    }
    for (const item of cases.values())
      expect(countNonogramSolutions(item.rows, item.columns)).toBe(
        Math.min(2, item.count),
      );
    expect(countNonogramSolutions([[1], [1]], [[1], [1]])).toBe(2);
  });
  it('only returns uniquely solvable nonograms for every difficulty', () => {
    for (const difficulty of ['easy', 'medium', 'hard'])
      for (const page of generatePuzzles({
        mode: 'nonogram',
        difficulty,
        seed: 813,
        count: 3,
        words: '',
      })) {
        expect(countNonogramSolutions(page.rows, page.columns)).toBe(1);
        expect(page.rows).toEqual(
          Array.from({ length: page.size }, (_, r) =>
            nonogramClues(
              page.grid.slice(r * page.size, (r + 1) * page.size).map(Number),
            ),
          ),
        );
      }
  });
  it('crosswords contain only declared across/down words and report omissions', () => {
    const page = generatePuzzles({
      mode: 'crossword',
      difficulty: 'medium',
      seed: 42,
      count: 1,
      words,
    })[0];
    expect(page.clues.length).toBeGreaterThan(2);
    expect(page.clues.length + page.unplaced.length).toBe(6);
    for (const direction of ['across', 'down'] as const) {
      const actual: string[] = [];
      for (let n = 0; n < page.size; n++) {
        const line = Array.from(
          { length: page.size },
          (_, m) =>
            page.grid[
              (direction === 'across' ? n : m) * page.size +
                (direction === 'across' ? m : n)
            ] || ' ',
        );
        actual.push(
          ...line
            .join('')
            .split(/ +/)
            .filter((word) => word.length > 1),
        );
      }
      expect(actual.sort()).toEqual(
        page.clues
          .filter((c) => c.direction === direction)
          .map((c) => c.word)
          .sort(),
      );
    }
  });
});
