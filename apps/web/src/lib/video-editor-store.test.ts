import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_EDITOR_PROJECT,
  useVideoEditorStore,
} from './video-editor-store';

describe('video editor history', () => {
  beforeEach(() => {
    useVideoEditorStore.getState().hydrateProject(EMPTY_EDITOR_PROJECT);
  });

  it('tracks edits but ignores playhead updates', () => {
    const store = useVideoEditorStore.getState();
    store.setProject((project) => ({ ...project, name: 'Cut 1' }));
    store.setProject((project) => ({ ...project, playhead: 3 }), false);
    expect(useVideoEditorStore.temporal.getState().pastStates).toHaveLength(1);

    store.undoProject();

    expect(useVideoEditorStore.getState().project.name).toBe('Untitled video');
    expect(useVideoEditorStore.getState().project.playhead).toBe(3);
    expect(useVideoEditorStore.temporal.getState().pastStates).toHaveLength(0);

    store.redoProject();
    expect(useVideoEditorStore.getState().project.name).toBe('Cut 1');
    expect(useVideoEditorStore.getState().project.playhead).toBe(3);
  });
});
