export type AlgorithmFrame = {
  values: number[];
  active: number[];
  comparisons: number;
  writes: number;
  found: number | null;
  visited: number[];
  path: number[];
  cost: number | null;
};
const frame = (values: number[]): AlgorithmFrame => ({
  values: [...values],
  active: [],
  comparisons: 0,
  writes: 0,
  found: null,
  visited: [],
  path: [],
  cost: null,
});
export function parseAlgorithmNumbers(source: string): number[] {
  const values = source
    .trim()
    .split(/[\s,;]+/)
    .map(Number);
  if (
    !source.trim() ||
    values.length > 40 ||
    values.some((n) => !Number.isFinite(n) || Math.abs(n) > 1_000_000)
  )
    throw new Error('algorithmLimit');
  return values;
}
export function sortTrace(
  input: number[],
  algorithm: string,
): AlgorithmFrame[] {
  if (
    !['bubble', 'insertion', 'selection'].includes(algorithm) ||
    !input.length ||
    input.length > 40 ||
    input.some((n) => !Number.isFinite(n))
  )
    throw new Error('algorithmLimit');
  const values = [...input];
  let comparisons = 0,
    writes = 0;
  const result = [frame(values)];
  const snap = (active: number[]) =>
    result.push({ ...frame(values), active, comparisons, writes });
  const swap = (a: number, b: number) => {
    [values[a], values[b]] = [values[b], values[a]];
    writes += 2;
  };
  if (algorithm === 'bubble') {
    for (let end = values.length - 1; end > 0; end--) {
      let changed = false;
      for (let i = 0; i < end; i++) {
        comparisons++;
        if (values[i] > values[i + 1]) {
          swap(i, i + 1);
          changed = true;
        }
        snap([i, i + 1]);
      }
      if (!changed) break;
    }
  } else if (algorithm === 'selection') {
    for (let i = 0; i < values.length - 1; i++) {
      let min = i;
      for (let j = i + 1; j < values.length; j++) {
        comparisons++;
        if (values[j] < values[min]) min = j;
        snap([min, j]);
      }
      if (min !== i) {
        swap(i, min);
        snap([i, min]);
      }
    }
  } else {
    for (let i = 1; i < values.length; i++) {
      const value = values[i];
      let j = i - 1;
      while (j >= 0) {
        comparisons++;
        if (values[j] <= value) {
          snap([j, j + 1]);
          break;
        }
        values[j + 1] = values[j];
        writes++;
        snap([j, j + 1]);
        j--;
      }
      values[j + 1] = value;
      writes++;
      snap([j + 1]);
    }
  }
  snap([]);
  return result;
}
export function binaryTrace(input: number[], target: number): AlgorithmFrame[] {
  if (
    !input.length ||
    input.length > 40 ||
    !Number.isFinite(target) ||
    input.some((n) => !Number.isFinite(n)) ||
    input.some((n, i) => i > 0 && n < input[i - 1])
  )
    throw new Error('sortedRequired');
  const result = [frame(input)];
  let low = 0,
    high = input.length - 1,
    comparisons = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    comparisons++;
    const found = input[mid] === target ? mid : null;
    result.push({
      ...frame(input),
      active: [low, mid, high],
      comparisons,
      found,
    });
    if (found !== null) return result;
    if (input[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  result.push({ ...frame(input), comparisons });
  return result;
}
export function pathTrace(
  costs: number[],
  size: number,
  algorithm: string,
): AlgorithmFrame[] {
  if (
    !Number.isInteger(size) ||
    size < 2 ||
    size > 20 ||
    costs.length !== size ** 2 ||
    costs.some((n) => !Number.isInteger(n) || n < 0 || n > 9) ||
    !['bfs', 'dijkstra'].includes(algorithm) ||
    costs[0] === 0 ||
    costs.at(-1) === 0
  )
    throw new Error('gridInvalid');
  const result = [frame(costs)];
  const distance = costs.map(() => Infinity);
  distance[0] = 0;
  const parents = costs.map(() => -1);
  const open = new Set([0]),
    visited = new Set<number>();
  let comparisons = 0;
  while (open.size) {
    const current = [...open].reduce((best, value) =>
      distance[value] < distance[best] ? value : best,
    );
    open.delete(current);
    visited.add(current);
    if (current === costs.length - 1) {
      const path: number[] = [];
      let index = current;
      while (index !== -1) {
        path.unshift(index);
        index = parents[index];
      }
      result.push({
        ...frame(costs),
        active: [current],
        comparisons,
        visited: [...visited],
        path,
        cost: distance[current],
        found: current,
      });
      return result;
    }
    const row = Math.floor(current / size),
      col = current % size;
    for (const [r, c] of [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ]) {
      if (r < 0 || c < 0 || r >= size || c >= size) continue;
      const next = r * size + c;
      if (costs[next] === 0 || visited.has(next)) continue;
      comparisons++;
      const cost = distance[current] + (algorithm === 'bfs' ? 1 : costs[next]);
      if (cost < distance[next]) {
        distance[next] = cost;
        parents[next] = current;
        open.add(next);
      }
    }
    result.push({
      ...frame(costs),
      active: [current],
      comparisons,
      visited: [...visited],
    });
  }
  result.push({ ...frame(costs), comparisons, visited: [...visited] });
  return result;
}
