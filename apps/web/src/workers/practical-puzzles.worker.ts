import { processPuzzle, type PuzzleTask } from '@/lib/practical-puzzles';
self.onmessage = (event: MessageEvent<PuzzleTask>) => {
  try {
    self.postMessage({ result: processPuzzle(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
