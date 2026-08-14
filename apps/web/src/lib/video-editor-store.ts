import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  DEFAULT_EXPORT_SETTINGS,
  DEFAULT_SUBTITLE_STYLE,
  createEditorTrack,
  ensureDefaultAudioTracks,
  type EditorProjectState,
} from './webav-editor';

const DEFAULT_VIDEO_TRACK = createEditorTrack('video', 1);

export const EMPTY_EDITOR_PROJECT: EditorProjectState = {
  version: 3,
  name: 'Untitled video',
  assets: [],
  clips: [],
  tracks: ensureDefaultAudioTracks([DEFAULT_VIDEO_TRACK]),
  subtitles: [],
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  playhead: 0,
  zoom: 50,
  exportSettings: DEFAULT_EXPORT_SETTINGS,
};

type ProjectUpdater =
  | EditorProjectState
  | ((project: EditorProjectState) => EditorProjectState);

type VideoEditorStore = {
  project: EditorProjectState;
  setProject: (updater: ProjectUpdater, recordHistory?: boolean) => void;
  hydrateProject: (project: EditorProjectState) => void;
  undoProject: () => void;
  redoProject: () => void;
};

export const useVideoEditorStore = create<VideoEditorStore>()(
  temporal(
    (set, get) => {
      const restoreHistory = (direction: 'undo' | 'redo') => {
        const { playhead, zoom } = get().project;
        const history = useVideoEditorStore.temporal.getState();
        history.pause();
        try {
          history[direction]();
          set(({ project }) => ({
            project: { ...project, playhead, zoom },
          }));
        } finally {
          history.resume();
        }
      };

      return {
        project: EMPTY_EDITOR_PROJECT,
        setProject: (updater, recordHistory = true) => {
          const history = useVideoEditorStore.temporal.getState();
          if (!recordHistory) history.pause();
          try {
            set(({ project }) => ({
              project:
                typeof updater === 'function' ? updater(project) : updater,
            }));
          } finally {
            if (!recordHistory) history.resume();
          }
        },
        hydrateProject: (project) => {
          const history = useVideoEditorStore.temporal.getState();
          history.pause();
          try {
            set({ project });
            history.clear();
          } finally {
            history.resume();
          }
        },
        undoProject: () => restoreHistory('undo'),
        redoProject: () => restoreHistory('redo'),
      };
    },
    {
      limit: 100,
      partialize: ({ project }) => ({ project }),
    },
  ),
);
