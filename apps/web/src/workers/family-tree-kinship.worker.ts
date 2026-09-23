import { familyKinship, type FamilyTree } from '../lib/family-tree-model';
self.onmessage = async (
  e: MessageEvent<{ tree: FamilyTree; from: string; to: string }>,
) => {
  try {
    self.postMessage({
      result: await familyKinship(e.data.tree, e.data.from, e.data.to),
    });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
