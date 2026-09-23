import { generatePuzzles, type PuzzleRequest } from '@/lib/batch4-puzzles';
self.onmessage = (event: MessageEvent<PuzzleRequest>) => {
  try {
    self.postMessage({ result: generatePuzzles(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
