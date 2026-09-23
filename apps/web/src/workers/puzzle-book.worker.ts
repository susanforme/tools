import { generatePuzzles, type PuzzleRequest } from '@/lib/puzzle-book-generator';
self.onmessage = (event: MessageEvent<PuzzleRequest>) => {
  try {
    self.postMessage({ result: generatePuzzles(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
