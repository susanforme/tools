export function sudokuCandidates(board: number[], index: number): number[] {
  const row = Math.floor(index / 9),
    col = index % 9;
  return Array.from({ length: 9 }, (_, n) => n + 1).filter(
    (n) =>
      !board.some(
        (value, i) =>
          value === n &&
          i !== index &&
          (Math.floor(i / 9) === row ||
            i % 9 === col ||
            (Math.floor(i / 27) === Math.floor(row / 3) &&
              Math.floor((i % 9) / 3) === Math.floor(col / 3))),
      ),
  );
}
export function sudokuSolutions(input: number[], limit = 2): number[][] {
  if (
    input.length !== 81 ||
    input.some((n) => !Number.isInteger(n) || n < 0 || n > 9)
  )
    throw new Error('invalid');
  if (input.some((n, i) => n && !sudokuCandidates(input, i).includes(n)))
    throw new Error('conflict');
  const board = [...input],
    found: number[][] = [];
  let visits = 0;
  const search = (): void => {
    if (++visits > 1_000_000) throw new Error('TIMEOUT');
    let cell = -1,
      options = Array.from({ length: 10 }, (_, n) => n);
    for (let i = 0; i < 81; i++)
      if (!board[i]) {
        const values = sudokuCandidates(board, i);
        if (!values.length) return;
        if (values.length < options.length) {
          cell = i;
          options = values;
          if (values.length === 1) break;
        }
      }
    if (cell < 0) {
      found.push([...board]);
      return;
    }
    for (const n of options) {
      board[cell] = n;
      search();
      if (found.length >= limit) break;
    }
    board[cell] = 0;
  };
  search();
  return found;
}
function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function generateSudoku(difficulty: string): {
  board: number[];
  solution: number[];
} {
  const digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const groups = () =>
    shuffled([0, 1, 2]).flatMap((group) =>
      shuffled([0, 1, 2]).map((n) => group * 3 + n),
    );
  const rows = groups(),
    cols = groups();
  const solution = rows.flatMap((row) =>
    cols.map((col) => digits[(row * 3 + Math.floor(row / 3) + col) % 9]),
  );
  const board = [...solution],
    target = difficulty === 'hard' ? 28 : difficulty === 'medium' ? 35 : 44;
  // ponytail: 难度按提示数分档；需要教学级难度时增加逻辑解法评级。
  let clues = 81;
  for (const i of shuffled(Array.from({ length: 81 }, (_, n) => n))) {
    const old = board[i];
    board[i] = 0;
    if (sudokuSolutions(board).length !== 1) board[i] = old;
    else clues--;
    if (clues <= target) break;
  }
  return { board, solution };
}
export type WordPlacement = { word: string; cells: number[] };
export function wordSearch(
  source: string,
  size: number,
  diagonal: boolean,
  reverse: boolean,
): { grid: string[]; placements: WordPlacement[]; size: number } {
  if (!Number.isInteger(size) || size < 5 || size > 30)
    throw new Error('puzzleLimit');
  const words = [
    ...new Set(
      source
        .toUpperCase()
        .split(/[\n,，]+/)
        .map((word) => word.replace(/\s/g, ''))
        .filter(Boolean),
    ),
  ];
  if (
    !words.length ||
    words.length > 30 ||
    words.some(
      (word) =>
        Array.from(word).length > size || !/^[\p{L}\p{N}]+$/u.test(word),
    )
  )
    throw new Error('puzzleLimit');
  const directions = [
    [1, 0],
    [0, 1],
    ...(diagonal
      ? [
          [1, 1],
          [-1, 1],
        ]
      : []),
  ];
  if (reverse) directions.push(...directions.map(([x, y]) => [-x, -y]));
  for (let attempt = 0; attempt < 100; attempt++) {
    const grid = Array<string>(size * size).fill(''),
      placements: WordPlacement[] = [];
    for (const word of [...words].sort(
      (a, b) => Array.from(b).length - Array.from(a).length,
    )) {
      const chars = Array.from(word);
      let placed = false;
      for (const start of shuffled(
        Array.from({ length: grid.length }, (_, n) => n),
      )) {
        for (const [dx, dy] of shuffled(directions)) {
          const x = start % size,
            y = Math.floor(start / size),
            ex = x + dx * (chars.length - 1),
            ey = y + dy * (chars.length - 1);
          if (ex < 0 || ey < 0 || ex >= size || ey >= size) continue;
          const cells = chars.map((_, i) => (y + dy * i) * size + x + dx * i);
          if (cells.some((cell, i) => grid[cell] && grid[cell] !== chars[i]))
            continue;
          cells.forEach((cell, i) => {
            grid[cell] = chars[i];
          });
          placements.push({ word, cells });
          placed = true;
          break;
        }
        if (placed) break;
      }
      if (!placed) break;
    }
    if (placements.length === words.length) {
      const alphabet = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      return {
        grid: grid.map(
          (char) =>
            char || alphabet[Math.floor(Math.random() * alphabet.length)],
        ),
        placements,
        size,
      };
    }
  }
  throw new Error('unplaced');
}
export type PuzzleTask =
  | { kind: 'generate'; difficulty: string }
  | { kind: 'solve'; board: number[] }
  | {
      kind: 'words';
      source: string;
      size: number;
      diagonal: boolean;
      reverse: boolean;
    };
export function processPuzzle(task: PuzzleTask) {
  if (task.kind === 'generate')
    return {
      kind: 'sudoku' as const,
      ...generateSudoku(task.difficulty),
      unique: true,
    };
  if (task.kind === 'solve') {
    const solutions = sudokuSolutions(task.board);
    if (!solutions.length) throw new Error('conflict');
    return {
      kind: 'sudoku' as const,
      board: task.board,
      solution: solutions[0],
      unique: solutions.length === 1,
    };
  }
  return {
    kind: 'words' as const,
    ...wordSearch(task.source, task.size, task.diagonal, task.reverse),
  };
}
