export type PuzzleMode = 'maze' | 'crossword' | 'nonogram';
export type PuzzleRequest = {
  mode: PuzzleMode;
  difficulty: string;
  seed: number;
  count: number;
  words: string;
};
export type CrosswordClue = {
  number: number;
  word: string;
  clue: string;
  row: number;
  column: number;
  direction: 'across' | 'down';
};
export type PuzzlePage = {
  mode: PuzzleMode;
  size: number;
  grid: string[];
  path: number[];
  clues: CrosswordClue[];
  unplaced: string[];
  rows: number[][];
  columns: number[][];
};
const blank = (mode: PuzzleMode, size: number): PuzzlePage => ({
  mode,
  size,
  grid: Array<string>(size * size).fill(''),
  path: [],
  clues: [],
  unplaced: [],
  rows: [],
  columns: [],
});
function randomSource(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function nonogramClues(values: number[]): number[] {
  const result: number[] = [];
  let run = 0;
  for (const value of [...values, 0]) {
    if (value) run++;
    else if (run) {
      result.push(run);
      run = 0;
    }
  }
  return result;
}
export function countNonogramSolutions(
  rows: number[][],
  columns: number[][],
  maxNodes = 20000,
): number {
  const n = rows.length;
  if (n < 1 || n > 10 || columns.length !== n) throw new Error('puzzleInvalid');
  const patterns = new Map<string, number[]>();
  const candidates = (clue: number[]) => {
    const key = clue.join(',');
    if (!patterns.has(key)) {
      const options: number[] = [];
      for (let bits = 0; bits < 1 << n; bits++)
        if (
          nonogramClues(
            Array.from({ length: n }, (_, i) => (bits >> i) & 1),
          ).join(',') === key
        )
          options.push(bits);
      patterns.set(key, options);
    }
    return patterns.get(key)!;
  };
  let nodes = 0;
  let solutions = 0;
  const solve = (r: number[][], c: number[][]) => {
    if (++nodes > maxNodes) throw new Error('generationFailed');
    let changed = true;
    while (changed) {
      changed = false;
      if ([...r, ...c].some((line) => !line.length)) return;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const rp = r[y].reduce(
            (mask, bits) => mask | (1 << ((bits >> x) & 1)),
            0,
          );
          const cp = c[x].reduce(
            (mask, bits) => mask | (1 << ((bits >> y) & 1)),
            0,
          );
          const allowed = rp & cp;
          if (!allowed) return;
          if (rp !== allowed) {
            const next = r[y].filter(
              (bits) => allowed & (1 << ((bits >> x) & 1)),
            );
            if (next.length !== r[y].length) {
              r[y] = next;
              changed = true;
            }
          }
          if (cp !== allowed) {
            const next = c[x].filter(
              (bits) => allowed & (1 << ((bits >> y) & 1)),
            );
            if (next.length !== c[x].length) {
              c[x] = next;
              changed = true;
            }
          }
        }
    }
    let axis = 0,
      index = -1,
      min = Infinity;
    for (const [a, lines] of [
      [0, r],
      [1, c],
    ] as const)
      lines.forEach((line, i) => {
        if (line.length > 1 && line.length < min) {
          axis = a;
          index = i;
          min = line.length;
        }
      });
    if (index < 0) {
      solutions++;
      return;
    }
    for (const value of (axis ? c : r)[index]) {
      const nextR = r.map((line) => [...line]),
        nextC = c.map((line) => [...line]);
      (axis ? nextC : nextR)[index] = [value];
      solve(nextR, nextC);
      if (solutions >= 2) return;
    }
  };
  solve(rows.map(candidates), columns.map(candidates));
  return solutions;
}
function nonogram(size: number, random: () => number): PuzzlePage {
  for (let attempt = 0; attempt < 100; attempt++) {
    const page = blank('nonogram', size);
    const density = size === 5 ? 0.65 : size === 8 ? 0.6 : 0.55;
    page.grid = page.grid.map(() => (random() < density ? '1' : '0'));
    page.rows = Array.from({ length: size }, (_, y) =>
      nonogramClues(page.grid.slice(y * size, (y + 1) * size).map(Number)),
    );
    page.columns = Array.from({ length: size }, (_, x) =>
      nonogramClues(
        Array.from({ length: size }, (_, y) => +page.grid[y * size + x]),
      ),
    );
    try {
      if (countNonogramSolutions(page.rows, page.columns) === 1) return page;
    } catch (cause) {
      if ((cause as Error).message !== 'generationFailed') throw cause;
    }
  }
  throw new Error('generationFailed');
}
function maze(cells: number, random: () => number): PuzzlePage {
  const size = cells * 2 + 1,
    page = blank('maze', size);
  page.grid.fill('#');
  const seen = new Set<number>([0]),
    stack = [0],
    parents = new Map<number, number>();
  page.grid[size + 1] = '';
  while (stack.length) {
    const at = stack.at(-1)!,
      x = at % cells,
      y = Math.floor(at / cells);
    const next = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]
      .map(([dx, dy]) => ({ x: x + dx, y: y + dy, dx, dy }))
      .filter(
        (p) =>
          p.x >= 0 &&
          p.y >= 0 &&
          p.x < cells &&
          p.y < cells &&
          !seen.has(p.y * cells + p.x),
      );
    if (!next.length) {
      stack.pop();
      continue;
    }
    const p = next[Math.floor(random() * next.length)],
      id = p.y * cells + p.x;
    seen.add(id);
    parents.set(id, at);
    stack.push(id);
    page.grid[(y * 2 + 1 + p.dy) * size + x * 2 + 1 + p.dx] = '';
    page.grid[(p.y * 2 + 1) * size + p.x * 2 + 1] = '';
  }
  page.grid[1] = '';
  page.grid[(size - 1) * size + size - 2] = '';
  let at = cells * cells - 1;
  page.path = [(size - 1) * size + size - 2];
  while (true) {
    const x = at % cells,
      y = Math.floor(at / cells);
    page.path.push((y * 2 + 1) * size + x * 2 + 1);
    if (!at) break;
    const parent = parents.get(at)!;
    page.path.push(
      (y + Math.floor(parent / cells) + 1) * size + x + (parent % cells) + 1,
    );
    at = parent;
  }
  page.path.push(1);
  return page;
}
function crossword(
  size: number,
  source: string,
  random: () => number,
): PuzzlePage {
  if (source.length > 10000) throw new Error('puzzleInvalid');
  const words = source
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const at = line.indexOf('|');
      return {
        word: (at < 0 ? line : line.slice(0, at)).trim().toUpperCase(),
        clue: (at < 0 ? '' : line.slice(at + 1)).trim(),
      };
    });
  if (
    words.length < 2 ||
    words.length > 30 ||
    words.some(
      (w) => !/^[A-Z]{3,15}$/.test(w.word) || !w.clue || w.clue.length > 150,
    ) ||
    new Set(words.map((w) => w.word)).size !== words.length
  )
    throw new Error('puzzleInvalid');
  const page = blank('crossword', size),
    axes = Array<number>(size * size).fill(0);
  const ordered = words
    .map((w) => ({ ...w, order: random() }))
    .sort((a, b) => b.word.length - a.word.length || a.order - b.order);
  const put = (
    entry: (typeof words)[number],
    row: number,
    column: number,
    axis: number,
  ) => {
    for (let n = 0; n < entry.word.length; n++) {
      const index =
        (row + (axis === 2 ? n : 0)) * size + column + (axis === 1 ? n : 0);
      page.grid[index] = entry.word[n];
      axes[index] |= axis;
    }
    page.clues.push({
      ...entry,
      number: 0,
      row,
      column,
      direction: axis === 1 ? 'across' : 'down',
    });
  };
  put(
    ordered[0],
    Math.floor(size / 2),
    Math.floor((size - ordered[0].word.length) / 2),
    1,
  );
  const remaining = ordered.slice(1);
  for (let pass = 0; pass < words.length && remaining.length; pass++) {
    let placed = false;
    for (let w = 0; w < remaining.length; w++) {
      const entry = remaining[w];
      const candidates: { row: number; column: number; axis: number }[] = [];
      for (let cell = 0; cell < page.grid.length; cell++) {
        if (!page.grid[cell] || axes[cell] === 3) continue;
        const axis = axes[cell] === 1 ? 2 : 1;
        for (let k = 0; k < entry.word.length; k++) {
          if (entry.word[k] !== page.grid[cell]) continue;
          const row = Math.floor(cell / size) - (axis === 2 ? k : 0),
            column = (cell % size) - (axis === 1 ? k : 0),
            endRow = row + (axis === 2 ? entry.word.length - 1 : 0),
            endCol = column + (axis === 1 ? entry.word.length - 1 : 0);
          if (row < 0 || column < 0 || endRow >= size || endCol >= size)
            continue;
          const get = (r: number, c: number) =>
            r >= 0 && c >= 0 && r < size && c < size
              ? page.grid[r * size + c]
              : '';
          if (
            get(row - (axis === 2 ? 1 : 0), column - (axis === 1 ? 1 : 0)) ||
            get(endRow + (axis === 2 ? 1 : 0), endCol + (axis === 1 ? 1 : 0))
          )
            continue;
          let valid = true;
          for (let n = 0; n < entry.word.length; n++) {
            const r = row + (axis === 2 ? n : 0),
              c = column + (axis === 1 ? n : 0),
              i = r * size + c;
            if (page.grid[i]) {
              if (page.grid[i] !== entry.word[n] || axes[i] & axis) {
                valid = false;
                break;
              }
            } else if (
              axis === 1
                ? get(r - 1, c) || get(r + 1, c)
                : get(r, c - 1) || get(r, c + 1)
            ) {
              valid = false;
              break;
            }
          }
          if (valid) candidates.push({ row, column, axis });
        }
      }
      if (candidates.length) {
        const position = candidates[Math.floor(random() * candidates.length)];
        put(entry, position.row, position.column, position.axis);
        remaining.splice(w--, 1);
        placed = true;
      }
    }
    if (!placed) break;
  }
  const starts = [
    ...new Set(page.clues.map((c) => c.row * size + c.column)),
  ].sort((a, b) => a - b);
  page.clues.forEach((clue) => {
    clue.number = starts.indexOf(clue.row * size + clue.column) + 1;
  });
  page.clues.sort((a, b) => a.number - b.number);
  page.unplaced = remaining.map((w) => w.word);
  return page;
}
export function generatePuzzles(request: PuzzleRequest): PuzzlePage[] {
  const level = ['easy', 'medium', 'hard'].indexOf(request.difficulty);
  if (
    level < 0 ||
    !Number.isInteger(request.count) ||
    request.count < 1 ||
    request.count > 12 ||
    !Number.isInteger(request.seed) ||
    request.seed < 0 ||
    request.seed > 4294967295 ||
    !['maze', 'crossword', 'nonogram'].includes(request.mode)
  )
    throw new Error('puzzleInvalid');
  const random = randomSource(request.seed);
  return Array.from({ length: request.count }, () =>
    request.mode === 'maze'
      ? maze([8, 14, 20][level], random)
      : request.mode === 'nonogram'
        ? nonogram([5, 8, 10][level], random)
        : crossword([15, 19, 23][level], request.words, random),
  );
}
