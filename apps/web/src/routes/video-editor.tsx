import { FileDropzone, type DroppedFile } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useTheme } from '@/hooks/use-theme';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  disposeFfmpegExporter,
  exportWithFfmpeg,
  type FfmpegExportFormat,
} from '@/lib/ffmpeg-export';
import { formatMediaBytes, formatMediaTime } from '@/lib/media-tools';
import { parseSubtitles } from '@/lib/subtitles';
import {
  analyzeEditorAsset,
  type EditorAssetAnalysis,
} from '@/lib/video-editor-analysis';
import { VIDEO_EDITOR_CONFIG } from '@/lib/video-editor-config';
import {
  DEFAULT_VIDEO_EDITOR_PREFERENCES,
  loadVideoEditorPreferences,
  saveVideoEditorPreferences,
  type VideoEditorPanelId,
  type VideoEditorPreferences,
} from '@/lib/video-editor-preferences';
import { useVideoEditorStore } from '@/lib/video-editor-store';
import {
  duplicateTimelineClip,
  createEditorTrack,
  exportEditorTimeline,
  extractTimelineAudio,
  getEditorOutputHandle,
  getEditorAssetKind,
  isWebAvCompatibleFile,
  loadEditorProject,
  loadEditorThumbnails,
  moveTimelineClip,
  readEditorAsset,
  removeEditorOutput,
  resolveExportConfig,
  saveEditorProject,
  snapTimelineClip,
  storeEditorAsset,
  timelineDuration,
  type EditorAsset,
  type EditorExportSettings,
  type EditorSubtitleStyle,
  type EditorTrack,
  type TimelineClip,
} from '@/lib/webav-editor';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import {
  AudioLines,
  Captions,
  Clapperboard,
  ClipboardCopy,
  Copy,
  Download,
  Eye,
  EyeOff,
  Film,
  GripVertical,
  Lock,
  LoaderCircle,
  Magnet,
  Maximize2,
  Minimize2,
  Music2,
  Moon,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Scissors,
  Search,
  Settings2,
  Sun,
  Trash2,
  Type,
  Undo2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';

export const Route = createFileRoute('/video-editor')({
  beforeLoad: ({ search }) => {
    if ((search as { tab?: unknown }).tab === 'manifest') {
      throw redirect({ to: '/streaming-manifest' });
    }
  },
  component: VideoEditorPage,
});

type EditorPanel = 'assets' | 'subtitles' | 'settings';
type TimelineTool = 'select' | 'razor';
type PreviewFit = 'fit' | 'fill' | 'actual';
type PreviewSource = { url: string; clip: TimelineClip };
type TimelineThumbnail = { ts: number; url: string };
const RAZOR_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27white%27 stroke=%27black%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Ccircle cx=%276%27 cy=%277%27 r=%273%27/%3E%3Cpath d=%27M8.7 8.3 19 14.5%27/%3E%3Ccircle cx=%276%27 cy=%2717%27 r=%273%27/%3E%3Cpath d=%27m8.7 15.7 10.3-6.2%27/%3E%3C/svg%3E") 6 7, crosshair';

function VideoEditorPage() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [panel, setPanel] = useQueryParam<EditorPanel>(
    'panel',
    StringParam,
    'assets',
  );
  const sessionId = VIDEO_EDITOR_CONFIG.sessionId;
  const project = useVideoEditorStore(({ project }) => project);
  const setProject = useVideoEditorStore(({ setProject }) => setProject);
  const hydrateProject = useVideoEditorStore(
    ({ hydrateProject }) => hydrateProject,
  );
  const undo = useVideoEditorStore(({ undoProject }) => undoProject);
  const redo = useVideoEditorStore(({ redoProject }) => redoProject);
  const { name, assets, clips, tracks, playhead, zoom } = project;
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [revealedAssetId, setRevealedAssetId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [timelineTool, setTimelineTool] = useState<TimelineTool>('select');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [videoSource, setVideoSource] = useState<PreviewSource | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const exportingRef = useRef(false);
  const clipboardClip = useRef<TimelineClip | null>(null);
  const replaceClipId = useRef<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [preferences, setPreferences] = useState<VideoEditorPreferences>(
    DEFAULT_VIDEO_EDITOR_PREFERENCES,
  );
  const [draggedPanel, setDraggedPanel] = useState<VideoEditorPanelId | null>(
    null,
  );
  const [draggedAssetKind, setDraggedAssetKind] = useState<
    'video' | 'audio' | null
  >(null);

  const duration = timelineDuration(clips);
  const selectedClip = clips.find(({ id }) => id === selectedClipId) ?? null;
  const selectedAsset =
    (selectedClip
      ? assets.find(({ id }) => id === selectedClip.assetId)
      : assets.find(({ id }) => id === selectedAssetId)) ?? null;
  const activeVideo = findActiveVideoClip(clips, tracks, playhead);
  const activeAudioClips = clips.filter((clip) => {
    const track = tracks.find(({ id }) => id === clip.trackId);
    return (
      (clip.kind === 'audio' ||
        (clip.id !== activeVideo?.id && !clip.hidden && !track?.hidden)) &&
      !clip.muted &&
      !track?.muted &&
      playhead >= clip.offset &&
      playhead < clip.offset + clip.duration
    );
  });
  const thumbnails = useTimelineThumbnails(sessionId, assets);
  const analyses = useAssetAnalyses(sessionId, assets);
  useEditorFont(sessionId, project.subtitleStyle, assets);
  const canUndo = useStore(
    useVideoEditorStore.temporal,
    ({ pastStates }) => pastStates.length > 0,
  );
  const canRedo = useStore(
    useVideoEditorStore.temporal,
    ({ futureStates }) => futureStates.length > 0,
  );

  useEffect(() => {
    const source = assets.find(({ kind }) => kind === 'video');
    const video = source ? analyses[source.id]?.video : null;
    if (!video) return;
    setProject((current) => {
      if (current.exportSettings.resolution !== 'source') return current;
      const exportSettings = {
        ...current.exportSettings,
        width: video.width,
        height: video.height,
        fps: Math.max(1, Math.round(video.fps)),
      };
      return current.exportSettings.width === exportSettings.width &&
        current.exportSettings.height === exportSettings.height &&
        current.exportSettings.fps === exportSettings.fps
        ? current
        : { ...current, exportSettings };
    }, false);
  }, [analyses, assets, setProject]);

  useEffect(() => {
    let cancelled = false;
    void navigator.storage.persist?.();
    void loadEditorProject(sessionId).then((storedProject) => {
      if (cancelled || !storedProject) {
        if (!cancelled) setHydrated(true);
        return;
      }
      hydrateProject({
        ...storedProject,
        playhead: Math.min(
          storedProject.playhead,
          timelineDuration(storedProject.clips),
        ),
      });
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateProject, sessionId]);

  useEffect(() => {
    void loadVideoEditorPreferences().then(setPreferences);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveVideoEditorPreferences(preferences);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [preferences]);

  useEffect(() => {
    if (!hydrated || playing) return;
    const timer = window.setTimeout(() => {
      void saveEditorProject(sessionId, project).catch(() =>
        setError(t('videoEditor.opencut.saveError')),
      );
    }, 50);
    return () => window.clearTimeout(timer);
  }, [hydrated, playing, project, sessionId, t]);

  useEffect(() => {
    if (!hydrated || !playing) return;
    const timer = window.setInterval(() => {
      void saveEditorProject(sessionId, useVideoEditorStore.getState().project);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [hydrated, playing, sessionId]);

  usePreviewSource(sessionId, activeVideo, assets, setVideoSource);

  useEffect(() => {
    if (!playing) return;
    const startTime = performance.now();
    const startPlayhead = playhead >= duration ? 0 : playhead;
    if (startPlayhead !== playhead) {
      setProject((current) => ({ ...current, playhead: startPlayhead }), false);
    }
    let frame = 0;
    const update = (now: number) => {
      const next = startPlayhead + (now - startTime) / 1000;
      if (next >= duration) {
        setProject((current) => ({ ...current, playhead: duration }), false);
        setPlaying(false);
        return;
      }
      setProject((current) => ({ ...current, playhead: next }), false);
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    syncMedia(videoRef.current, videoSource, playhead, playing);
  }, [videoSource, playhead, playing]);

  const importFiles = async (items: DroppedFile[]) => {
    const files = items.map(({ file }) => file);
    if (files.length === 0) return;
    if (
      files.some((file) => !isWebAvCompatibleFile(file)) ||
      (!assets.some(({ kind }) => kind === 'video') &&
        !files.some((file) => getEditorAssetKind(file) === 'video'))
    ) {
      setError(t('videoEditor.opencut.unsupportedImport'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextAssets = [...assets];
      const nextClips = [...clips];
      const nextTracks = [...tracks];
      const nextSubtitles = [...project.subtitles];
      let nextName = name;
      let nextExportSettings = project.exportSettings;
      let nextSubtitleStyle = project.subtitleStyle;
      for (const file of files) {
        const asset = await storeEditorAsset(sessionId, file);
        nextAssets.push(asset);
        if (asset.kind === 'subtitle') {
          let subtitleTrack = nextTracks.find(
            (track) => track.kind === 'subtitle',
          );
          if (!subtitleTrack) {
            subtitleTrack = createEditorTrack('subtitle', 1);
            nextTracks.push(subtitleTrack);
          }
          nextSubtitles.push(
            ...parseSubtitles(await file.text()).map((cue) => ({
              ...cue,
              id: crypto.randomUUID(),
              trackId: subtitleTrack.id,
            })),
          );
          continue;
        }
        if (asset.kind === 'font') {
          nextSubtitleStyle = {
            ...nextSubtitleStyle,
            fontFamily: asset.name.replace(/\.[^.]+$/, ''),
            fontAssetId: asset.id,
          };
          continue;
        }
        const track =
          nextTracks.find((item) => item.kind === asset.kind) ??
          createEditorTrack(
            asset.kind,
            nextTracks.filter((item) => item.kind === asset.kind).length + 1,
          );
        if (!nextTracks.includes(track)) nextTracks.push(track);
        const offset =
          asset.kind === 'video'
            ? timelineDuration(
                nextClips.filter((clip) => clip.kind === 'video'),
              )
            : playhead;
        const clip = createTimelineClip(asset, offset, track.id);
        nextClips.push(clip);
        setSelectedClipId(clip.id);
        if (
          asset.kind === 'video' &&
          nextAssets.filter(({ kind }) => kind === 'video').length === 1
        ) {
          nextName = asset.name.replace(/\.[^.]+$/, '');
          nextExportSettings = {
            ...nextExportSettings,
            width: asset.width,
            height: asset.height,
          };
        }
      }
      setProject((current) => ({
        ...current,
        name: nextName,
        assets: nextAssets,
        clips: nextClips,
        tracks: nextTracks,
        subtitles: nextSubtitles,
        subtitleStyle: nextSubtitleStyle,
        exportSettings: nextExportSettings,
      }));
    } catch {
      setError(t('videoEditor.opencut.importError'));
    } finally {
      setLoading(false);
    }
  };

  const addAssetAgain = (asset: EditorAsset) => {
    if (asset.kind !== 'video' && asset.kind !== 'audio') return;
    const track = tracks.find((item) => item.kind === asset.kind);
    if (!track) return;
    const offset =
      asset.kind === 'video'
        ? timelineDuration(clips.filter((clip) => clip.kind === 'video'))
        : playhead;
    const clip = createTimelineClip(asset, offset, track.id);
    setProject((current) => ({
      ...current,
      clips: [...current.clips, clip],
    }));
    setSelectedClipId(clip.id);
  };

  const updateClip = (next: TimelineClip) => {
    setProject((current) => ({
      ...current,
      clips: current.clips.map((clip) => (clip.id === next.id ? next : clip)),
    }));
  };

  const deleteClip = (clipId: string) => {
    setProject((current) => ({
      ...current,
      clips: current.clips.filter(({ id }) => id !== clipId),
    }));
    if (selectedClipId === clipId) setSelectedClipId(null);
  };

  const splitClip = (clipId: string, at: number) => {
    const clip = clips.find(({ id }) => id === clipId);
    if (
      !clip ||
      at <= clip.offset + 0.05 ||
      at >= clip.offset + clip.duration - 0.05
    )
      return;
    const leftDuration = at - clip.offset;
    const right = {
      ...clip,
      id: crypto.randomUUID(),
      offset: at,
      sourceStart: clip.sourceStart + leftDuration,
      duration: clip.duration - leftDuration,
    };
    setProject((current) => ({
      ...current,
      clips: [
        ...current.clips.map((clip) =>
          clip.id === clipId ? { ...clip, duration: leftDuration } : clip,
        ),
        right,
      ],
    }));
    setSelectedClipId(right.id);
  };

  const duplicateClip = (clipId: string) => {
    const clip = clips.find(({ id }) => id === clipId);
    if (!clip) return;
    const copy = duplicateTimelineClip(clip);
    setProject((current) => ({
      ...current,
      clips: [...current.clips, copy],
    }));
    setSelectedClipId(copy.id);
  };

  const copyClip = (clipId: string) => {
    const clip = clips.find(({ id }) => id === clipId);
    if (clip) clipboardClip.current = { ...clip };
  };

  const pasteClip = () => {
    const clip = clipboardClip.current;
    if (!clip || !assets.some(({ id }) => id === clip.assetId)) return;
    const copy = duplicateTimelineClip(clip, playhead);
    setProject((current) => ({
      ...current,
      clips: [...current.clips, copy],
    }));
    setSelectedClipId(copy.id);
  };

  const toggleClipMuted = (clipId: string) => {
    const clip = clips.find(({ id }) => id === clipId);
    if (clip) updateClip({ ...clip, muted: !clip.muted });
  };

  const toggleClipHidden = (clipId: string) => {
    const clip = clips.find(({ id }) => id === clipId);
    if (clip?.kind === 'video') updateClip({ ...clip, hidden: !clip.hidden });
  };

  const extractClipAudio = (clipId: string) => {
    const clip = clips.find(({ id }) => id === clipId);
    if (clip?.kind !== 'video') return;
    const extracted = extractTimelineAudio(clip);
    setProject((current) => {
      const existing = current.tracks.find((track) => track.kind === 'audio');
      const audioTrack = existing ?? createEditorTrack('audio', 1);
      return {
        ...current,
        tracks: existing ? current.tracks : [...current.tracks, audioTrack],
        clips: [
          ...current.clips.map((item) =>
            item.id === clipId ? extracted.video : item,
          ),
          { ...extracted.audio, trackId: audioTrack.id },
        ],
      };
    });
    setSelectedClipId(extracted.audio.id);
  };

  const revealClipMedia = (clipId: string) => {
    const clip = clips.find(({ id }) => id === clipId);
    const asset = clip
      ? assets.find(({ id }) => id === clip.assetId)
      : undefined;
    if (!asset) return;
    setPanel('assets');
    setRevealedAssetId(asset.id);
    window.requestAnimationFrame(() =>
      document
        .getElementById(`editor-asset-${asset.id}`)
        ?.scrollIntoView({ block: 'nearest' }),
    );
  };

  const requestReplaceClipMedia = (clipId: string) => {
    replaceClipId.current = clipId;
    replaceInputRef.current?.click();
  };

  const replaceClipMedia = async (file: File) => {
    const clipId = replaceClipId.current;
    replaceClipId.current = null;
    const clip = clips.find(({ id }) => id === clipId);
    const previousAsset = clip
      ? assets.find(({ id }) => id === clip.assetId)
      : undefined;
    const nextKind = getEditorAssetKind(file);
    if (
      !clip ||
      !previousAsset ||
      (nextKind !== 'video' && nextKind !== 'audio') ||
      nextKind !== previousAsset.kind ||
      !isWebAvCompatibleFile(file)
    ) {
      setError(t('videoEditor.opencut.replaceError'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const asset = await storeEditorAsset(sessionId, file);
      setProject((current) => ({
        ...current,
        assets: [...current.assets, asset],
        clips: current.clips.map((item) => {
          if (item.id !== clipId) return item;
          const sourceStart = Math.min(
            item.sourceStart,
            Math.max(0, asset.duration - 0.05),
          );
          return {
            ...item,
            assetId: asset.id,
            sourceStart,
            duration: Math.min(item.duration, asset.duration - sourceStart),
          };
        }),
      }));
      setRevealedAssetId(asset.id);
    } catch {
      setError(t('videoEditor.opencut.replaceError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 's') {
        event.preventDefault();
        void saveEditorProject(
          sessionId,
          useVideoEditorStore.getState().project,
        );
      } else if ((event.metaKey || event.ctrlKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if ((event.metaKey || event.ctrlKey) && key === 'c') {
        if (!selectedClipId) return;
        event.preventDefault();
        copyClip(selectedClipId);
      } else if ((event.metaKey || event.ctrlKey) && key === 'v') {
        event.preventDefault();
        pasteClip();
      } else if ((event.metaKey || event.ctrlKey) && key === 'd') {
        if (!selectedClipId) return;
        event.preventDefault();
        duplicateClip(selectedClipId);
      } else if ((event.metaKey || event.ctrlKey) && key === 'b') {
        event.preventDefault();
        if (selectedClipId) splitClip(selectedClipId, playhead);
      } else if (key === 's') {
        if (selectedClipId) splitClip(selectedClipId, playhead);
      } else if (key === 'b') {
        setTimelineTool('razor');
      } else if (key === 'v') {
        setTimelineTool('select');
      } else if (event.code === 'Space') {
        event.preventDefault();
        setPlaying((current) => !current);
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedClipId
      ) {
        event.preventDefault();
        deleteClip(selectedClipId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clips, playhead, selectedClipId]);

  const exportVideo = async () => {
    if (clips.length === 0 || exportingRef.current) return;
    exportingRef.current = true;
    const temporaryOutputs: string[] = [];
    setLoading(true);
    setExporting(true);
    setProgress(0);
    setError(null);
    try {
      const output = await exportEditorTimeline(
        sessionId,
        {
          assets,
          clips,
          tracks: project.tracks,
          subtitles: project.subtitles,
          subtitleStyle: project.subtitleStyle,
        },
        name,
        project.exportSettings,
        (value) => setProgress(value * 0.75),
      );
      temporaryOutputs.push(output.name);
      const settings = project.exportSettings;
      const firstVideo = assets.find(({ kind }) => kind === 'video');
      if (!firstVideo) throw new Error('VIDEO_REQUIRED');
      const resolved = resolveExportConfig(firstVideo, settings);
      let finalOutput = output;
      if (settings.format !== 'mp4') {
        const finalName = `${name}.${settings.format}`;
        temporaryOutputs.push(finalName);
        finalOutput = await exportWithFfmpeg(
          output,
          await getEditorOutputHandle(sessionId, finalName),
          {
            format: settings.format as FfmpegExportFormat,
            width: resolved.width,
            height: resolved.height,
            fps: resolved.fps,
            videoBitrateKbps: settings.videoBitrateKbps,
            audioBitrateKbps: settings.audioBitrateKbps,
            onProgress: (value) => setProgress(0.75 + value * 0.25),
          },
        );
      }
      setProgress(1);
      downloadBlob(finalOutput, finalOutput.name);
    } catch (cause) {
      console.error('Video export failed', cause);
      setError(t('videoEditor.opencut.exportError'));
    } finally {
      await Promise.all(
        temporaryOutputs.map((fileName) =>
          removeEditorOutput(sessionId, fileName),
        ),
      );
      disposeFfmpegExporter();
      exportingRef.current = false;
      setLoading(false);
      setExporting(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="grid h-[100dvh] place-items-center bg-[#f5f6f8]">
        <LoaderCircle className="size-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!assets.some(({ kind }) => kind === 'video')) {
    return (
      <EmptyEditor loading={loading} error={error} onFiles={importFiles} />
    );
  }

  const movePanel = (target: VideoEditorPanelId) => {
    if (!draggedPanel || draggedPanel === target) return;
    setPreferences((current) => {
      const panelOrder = current.panelOrder.filter(
        (item) => item !== draggedPanel,
      );
      panelOrder.splice(panelOrder.indexOf(target), 0, draggedPanel);
      return { ...current, panelOrder };
    });
    setDraggedPanel(null);
  };

  const renderPanel = (id: VideoEditorPanelId) => {
    if (id === 'assets') {
      return (
        <AssetPanel
          panel={panel}
          setPanel={setPanel}
          assets={assets}
          selectedAssetId={selectedAsset?.id ?? null}
          revealedAssetId={revealedAssetId}
          exportSettings={project.exportSettings}
          subtitleStyle={project.subtitleStyle}
          loading={loading}
          onFiles={importFiles}
          onSelect={(assetId) => {
            setSelectedAssetId(assetId);
            setSelectedClipId(null);
          }}
          onAssetDragStart={setDraggedAssetKind}
          onAssetDragEnd={() => setDraggedAssetKind(null)}
          onAdd={addAssetAgain}
          onChangeSubtitleStyle={(subtitleStyle) =>
            setProject((current) => ({ ...current, subtitleStyle }))
          }
          onChangeExportSettings={(exportSettings) =>
            setProject((current) => ({ ...current, exportSettings }))
          }
        />
      );
    }
    if (id === 'preview') {
      return (
        <Preview
          source={videoSource}
          videoMuted={
            Boolean(activeVideo?.muted) ||
            Boolean(tracks.find(({ id }) => id === activeVideo?.trackId)?.muted)
          }
          videoRef={videoRef}
          sessionId={sessionId}
          assets={assets}
          audioClips={activeAudioClips}
          subtitles={project.subtitles.filter(
            (cue) => playhead >= cue.start && playhead < cue.end,
          )}
          subtitleStyle={project.subtitleStyle}
          playhead={playhead}
          duration={duration}
          fps={project.exportSettings.fps}
          playing={playing}
          onSeek={(time) =>
            setProject((current) => ({ ...current, playhead: time }), false)
          }
          onToggle={() => setPlaying((current) => !current)}
          onRestart={() =>
            setProject((current) => ({ ...current, playhead: 0 }), false)
          }
        />
      );
    }
    return (
      <Inspector
        clip={selectedClip}
        asset={selectedAsset}
        analysis={selectedAsset ? (analyses[selectedAsset.id] ?? null) : null}
        onChange={updateClip}
      />
    );
  };

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
      onContextMenuCapture={(event) => {
        if (
          !(event.target as HTMLElement).closest(
            '[data-slot=context-menu-trigger]',
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <EditorHeader
        name={name}
        setName={(nextName) =>
          setProject((current) => ({ ...current, name: nextName }))
        }
        loading={loading}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSave={() => void saveEditorProject(sessionId, project)}
        onExport={() => void exportVideo()}
      />
      {error && (
        <div className="flex shrink-0 items-center justify-between border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            aria-label={t('videoEditor.opencut.dismiss')}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
        <ResizablePanel
          id="workspace"
          minSize="45%"
          defaultSize={`${100 - preferences.timelineSize}%`}
        >
          <ResizablePanelGroup orientation="horizontal">
            {preferences.panelOrder.map((id, index) => (
              <Fragment key={id}>
                {index > 0 && <ResizableHandle withHandle />}
                <ResizablePanel
                  id={id}
                  minSize={id === 'preview' ? '30%' : '10%'}
                  defaultSize={`${preferences.panelSizes[id]}%`}
                  groupResizeBehavior="preserve-relative-size"
                  onResize={({ asPercentage }) =>
                    setPreferences((current) =>
                      Math.abs(current.panelSizes[id] - asPercentage) < 0.01
                        ? current
                        : {
                            ...current,
                            panelSizes: {
                              ...current.panelSizes,
                              [id]: Math.round(asPercentage * 100) / 100,
                            },
                          },
                    )
                  }
                >
                  <div
                    className="relative h-full"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => movePanel(id)}
                  >
                    <button
                      draggable
                      title={t('videoEditor.opencut.movePanel')}
                      onDragStart={() => setDraggedPanel(id)}
                      className="absolute right-2 top-2 z-40 grid size-6 cursor-grab place-items-center rounded bg-white/80 text-zinc-400 shadow-sm hover:text-zinc-900 dark:bg-zinc-800/80 dark:hover:text-white"
                    >
                      <GripVertical className="size-3.5" />
                    </button>
                    {renderPanel(id)}
                  </div>
                </ResizablePanel>
              </Fragment>
            ))}
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="timeline"
          minSize="18%"
          maxSize="55%"
          defaultSize={`${preferences.timelineSize}%`}
          groupResizeBehavior="preserve-relative-size"
          onResize={({ asPercentage }) =>
            setPreferences((current) => ({
              ...current,
              timelineSize: Math.round(asPercentage * 100) / 100,
            }))
          }
        >
          <Timeline
            assets={assets}
            analyses={analyses}
            thumbnails={thumbnails}
            clips={clips}
            tracks={tracks}
            subtitles={project.subtitles}
            duration={duration}
            playhead={playhead}
            zoom={zoom}
            setZoom={(nextZoom) =>
              setProject((current) => ({ ...current, zoom: nextZoom }), false)
            }
            selectedClipId={selectedClipId}
            setSelectedClipId={setSelectedClipId}
            setPlayhead={(nextPlayhead) =>
              setProject(
                (current) => ({
                  ...current,
                  playhead: nextPlayhead,
                }),
                false,
              )
            }
            onChangeClip={updateClip}
            tool={timelineTool}
            setTool={setTimelineTool}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onSplit={(clipId, at) => splitClip(clipId, at)}
            onDuplicate={duplicateClip}
            onCopy={copyClip}
            onToggleMuted={toggleClipMuted}
            onExtractAudio={extractClipAudio}
            onToggleHidden={toggleClipHidden}
            onRevealMedia={revealClipMedia}
            onReplaceMedia={requestReplaceClipMedia}
            onDelete={deleteClip}
            snapping={preferences.snapping}
            onToggleSnapping={() =>
              setPreferences((current) => ({
                ...current,
                snapping: !current.snapping,
              }))
            }
            onChangeTrack={(track) =>
              setProject((current) => ({
                ...current,
                tracks: current.tracks.map((item) =>
                  item.id === track.id ? track : item,
                ),
              }))
            }
            onAddTrack={(kind) =>
              setProject((current) => ({
                ...current,
                tracks: [
                  ...current.tracks,
                  createEditorTrack(
                    kind,
                    current.tracks.filter((track) => track.kind === kind)
                      .length + 1,
                  ),
                ],
              }))
            }
            onDropAsset={(assetId, trackId, offset) => {
              const asset = assets.find(({ id }) => id === assetId);
              const track = tracks.find(({ id }) => id === trackId);
              if (
                !asset ||
                !track ||
                (asset.kind !== 'video' && asset.kind !== 'audio') ||
                asset.kind !== track.kind
              )
                return;
              const clip = createTimelineClip(asset, offset, track.id);
              setProject((current) => ({
                ...current,
                clips: [...current.clips, clip],
              }));
              setSelectedClipId(clip.id);
              setDraggedAssetKind(null);
            }}
            onDropNewTrack={(kind, assetId, offset) => {
              const asset = assets.find(({ id }) => id === assetId);
              if (!asset || asset.kind !== kind) return;
              const track = createEditorTrack(
                kind,
                tracks.filter((item) => item.kind === kind).length + 1,
              );
              const clip = createTimelineClip(asset, offset, track.id);
              setProject((current) => ({
                ...current,
                tracks: [...current.tracks, track],
                clips: [...current.clips, clip],
              }));
              setSelectedClipId(clip.id);
              setDraggedAssetKind(null);
            }}
            draggedAssetKind={draggedAssetKind}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      <input
        ref={replaceInputRef}
        type="file"
        accept={VIDEO_EDITOR_CONFIG.mediaAccept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void replaceClipMedia(file);
          event.target.value = '';
        }}
      />

      {exporting && (
        <div className="absolute inset-0 z-[200] grid place-items-center bg-zinc-950/75 text-white backdrop-blur-sm">
          <div className="w-[min(420px,80vw)] space-y-4 text-center">
            <LoaderCircle className="mx-auto size-10 animate-spin" />
            <p className="text-sm font-medium">
              {t('videoEditor.opencut.exporting')}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${Math.max(2, progress * 100)}%` }}
              />
            </div>
            <span className="font-mono text-xs">
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function EditorHeader({
  name,
  setName,
  loading,
  theme,
  onToggleTheme,
  onSave,
  onExport,
}: {
  name: string;
  setName: (name: string) => void;
  loading: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSave: () => void;
  onExport: () => void;
}) {
  const { t } = useTranslation();
  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
      <Input
        aria-label={t('videoEditor.opencut.name')}
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="h-8 max-w-56 border-transparent px-2 text-sm font-medium shadow-none hover:border-zinc-200 focus-visible:ring-0"
      />
      <Link
        to="/"
        aria-label={t('shell.home')}
        className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold hover:bg-zinc-100"
      >
        <span className="grid size-7 place-items-center rounded-md bg-zinc-950 text-white">
          <Clapperboard className="size-4" />
        </span>
        Breeze Tools
      </Link>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onSave}
          title={t('videoEditor.opencut.save')}
        >
          <Save />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleTheme}
          title={t('settingsPreferences.theme')}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <Button size="sm" disabled={loading} onClick={onExport}>
          {loading ? <LoaderCircle className="animate-spin" /> : <Download />}
          {t('videoEditor.export')}
        </Button>
      </div>
    </header>
  );
}

function EmptyEditor({
  loading,
  error,
  onFiles,
}: {
  loading: boolean;
  error: string | null;
  onFiles: (files: DroppedFile[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-zinc-100 p-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <Link
          to="/"
          className="mx-auto grid size-12 place-items-center rounded-xl bg-zinc-950 text-white"
        >
          <Clapperboard className="size-6" />
        </Link>
        <h1 className="mt-5 text-xl font-semibold">
          {t('videoEditor.opencut.title')}
        </h1>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <FileDropzone
          accept={VIDEO_EDITOR_CONFIG.videoAccept}
          disabled={loading}
          onFiles={onFiles}
          className="mt-6 flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 hover:border-blue-400 hover:bg-blue-50"
        >
          {loading ? (
            <LoaderCircle className="size-8 animate-spin text-blue-600" />
          ) : (
            <Upload className="size-8 text-blue-600" />
          )}
          <span className="text-sm font-medium">
            {t('videoEditor.opencut.importVideo')}
          </span>
        </FileDropzone>
      </div>
    </div>
  );
}

function AssetPanel({
  panel,
  setPanel,
  assets,
  selectedAssetId,
  revealedAssetId,
  exportSettings,
  subtitleStyle,
  loading,
  onFiles,
  onSelect,
  onAssetDragStart,
  onAssetDragEnd,
  onAdd,
  onChangeSubtitleStyle,
  onChangeExportSettings,
}: {
  panel: EditorPanel;
  setPanel: (panel: EditorPanel) => void;
  assets: EditorAsset[];
  selectedAssetId: string | null;
  revealedAssetId: string | null;
  exportSettings: EditorExportSettings;
  subtitleStyle: EditorSubtitleStyle;
  loading: boolean;
  onFiles: (files: DroppedFile[]) => void;
  onSelect: (assetId: string) => void;
  onAssetDragStart: (kind: 'video' | 'audio') => void;
  onAssetDragEnd: () => void;
  onAdd: (asset: EditorAsset) => void;
  onChangeSubtitleStyle: (style: EditorSubtitleStyle) => void;
  onChangeExportSettings: (settings: EditorExportSettings) => void;
}) {
  const { t } = useTranslation();
  const visibleAssets = assets.filter(({ kind }) =>
    panel === 'assets'
      ? kind === 'video' || kind === 'audio'
      : kind === 'subtitle' || kind === 'font',
  );
  return (
    <aside className="grid h-full min-h-0 grid-cols-[54px_minmax(0,1fr)] border-r border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
      <nav className="flex flex-col items-center gap-1 border-r border-zinc-200 py-2 dark:border-zinc-700">
        {(
          [
            ['assets', Film],
            ['subtitles', Captions],
            ['settings', Settings2],
          ] as const
        ).map(([value, Icon]) => (
          <button
            key={value}
            title={t(`videoEditor.opencut.tools.${value}`)}
            onClick={() => setPanel(value)}
            className={`grid size-10 place-items-center rounded-lg ${panel === value ? 'bg-blue-50 text-blue-600' : 'text-zinc-500 hover:bg-zinc-100'}`}
          >
            <Icon className="size-[18px]" />
          </button>
        ))}
      </nav>
      <div className="min-h-0 overflow-y-auto p-3">
        <h2 className="mb-3 text-sm font-semibold">
          {t(`videoEditor.opencut.tools.${panel}`)}
        </h2>
        {panel === 'settings' ? (
          <ExportSettings
            value={exportSettings}
            onChange={onChangeExportSettings}
          />
        ) : (
          <>
            {panel === 'assets' ? (
              <FileDropzone
                accept={VIDEO_EDITOR_CONFIG.mediaAccept}
                multiple
                disabled={loading}
                onFiles={onFiles}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center text-xs text-zinc-500 hover:border-blue-400"
              >
                <Upload className="size-5" />
                {t('videoEditor.opencut.dropMedia')}
              </FileDropzone>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <FileDropzone
                  accept=".srt,.vtt"
                  multiple
                  disabled={loading}
                  onFiles={onFiles}
                  className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center text-xs text-zinc-500 hover:border-blue-400"
                >
                  <Captions className="size-5" />
                  {t('videoEditor.opencut.importSubtitles')}
                </FileDropzone>
                <FileDropzone
                  accept=".ttf,.otf,.woff,.woff2"
                  multiple
                  disabled={loading}
                  onFiles={onFiles}
                  className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center text-xs text-zinc-500 hover:border-blue-400"
                >
                  <Type className="size-5" />
                  {t('videoEditor.opencut.importFont')}
                </FileDropzone>
              </div>
            )}
            {panel === 'subtitles' && (
              <div className="mt-3 space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <label className="block space-y-1 text-xs text-zinc-500">
                  {t('videoEditor.opencut.fontFamily')}
                  <Input
                    value={subtitleStyle.fontFamily}
                    onChange={(event) =>
                      onChangeSubtitleStyle({
                        ...subtitleStyle,
                        fontFamily: event.target.value,
                      })
                    }
                    className="h-8"
                  />
                </label>
                <NumberField
                  label={t('videoEditor.opencut.fontSize')}
                  value={subtitleStyle.fontSize}
                  step={1}
                  onChange={(fontSize) =>
                    onChangeSubtitleStyle({
                      ...subtitleStyle,
                      fontSize: Math.max(8, Math.min(160, fontSize)),
                    })
                  }
                />
              </div>
            )}
            <div className="mt-3 space-y-2">
              {visibleAssets.map((asset) => (
                <ContextMenu key={asset.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      id={`editor-asset-${asset.id}`}
                      draggable={
                        asset.kind === 'video' || asset.kind === 'audio'
                      }
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          'application/x-editor-asset',
                          asset.id,
                        );
                        if (asset.kind === 'video' || asset.kind === 'audio') {
                          onAssetDragStart(asset.kind);
                        }
                      }}
                      onDragEnd={onAssetDragEnd}
                      onClick={() => onSelect(asset.id)}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 ${revealedAssetId === asset.id || selectedAssetId === asset.id ? 'border-blue-400 ring-2 ring-blue-100 dark:ring-blue-950' : 'border-zinc-200 dark:border-zinc-700'}`}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded bg-zinc-900 text-white">
                        {asset.kind === 'video' ? (
                          <Film className="size-4" />
                        ) : asset.kind === 'audio' ? (
                          <Music2 className="size-4" />
                        ) : asset.kind === 'subtitle' ? (
                          <Captions className="size-4" />
                        ) : (
                          <Type className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                          {asset.name}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {formatMediaTime(asset.duration)} ·{' '}
                          {formatMediaBytes(asset.size)}
                        </span>
                      </span>
                      {(asset.kind === 'video' || asset.kind === 'audio') && (
                        <button
                          title={t('videoEditor.opencut.addToTimeline')}
                          onClick={() => onAdd(asset)}
                          className="grid size-7 shrink-0 place-items-center rounded hover:bg-zinc-100"
                        >
                          <Plus className="size-4" />
                        </button>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => onAdd(asset)}>
                      <Plus />
                      {t('videoEditor.opencut.addToTimeline')}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function ExportSettings({
  value,
  onChange,
}: {
  value: EditorExportSettings;
  onChange: (settings: EditorExportSettings) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <SettingSelect
        label={t('videoEditor.opencut.resolution')}
        value={value.resolution}
        options={[
          ['source', t('videoEditor.opencut.sourceResolution')],
          ['720p', '720p'],
          ['1080p', '1080p'],
          ['custom', t('videoEditor.opencut.custom')],
        ]}
        onChange={(resolution) =>
          onChange({
            ...value,
            resolution: resolution as EditorExportSettings['resolution'],
          })
        }
      />
      {value.resolution === 'custom' && (
        <div className="space-y-2">
          <NumberField
            label={t('videoEditor.opencut.width')}
            value={value.width}
            step={1}
            onChange={(width) => onChange({ ...value, width })}
          />
          <NumberField
            label={t('videoEditor.opencut.height')}
            value={value.height}
            step={1}
            onChange={(height) => onChange({ ...value, height })}
          />
        </div>
      )}
      <NumberField
        label={t('videoEditor.opencut.frameRate')}
        value={value.fps}
        step={1}
        onChange={(fps) =>
          onChange({ ...value, fps: Math.max(1, Math.min(120, fps)) })
        }
      />
      <NumberField
        label={t('videoEditor.opencut.videoBitrate')}
        value={value.videoBitrateKbps}
        step={1}
        onChange={(videoBitrateKbps) =>
          onChange({ ...value, videoBitrateKbps })
        }
      />
      <NumberField
        label={t('videoEditor.opencut.audioBitrate')}
        value={value.audioBitrateKbps}
        step={1}
        onChange={(audioBitrateKbps) =>
          onChange({ ...value, audioBitrateKbps })
        }
      />
      <SettingSelect
        label={t('videoEditor.opencut.format')}
        value={value.format}
        options={[
          ['mp4', 'MP4 · H.264 / AAC'],
          ['webm', 'WebM · VP8 / Opus'],
          ['mov', 'MOV · H.264 / AAC'],
          ['mkv', 'MKV · H.264 / AAC'],
          ['avi', 'AVI · MPEG-4 / MP3'],
          ['ts', 'MPEG-TS · H.264 / AAC'],
        ]}
        onChange={(format) =>
          onChange({
            ...value,
            format: format as EditorExportSettings['format'],
          })
        }
      />
    </div>
  );
}

function SettingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5 text-xs text-zinc-500">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-white dark:bg-zinc-900" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([option, text]) => (
            <SelectItem key={option} value={option}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function Preview({
  source,
  videoMuted,
  videoRef,
  sessionId,
  assets,
  audioClips,
  subtitles,
  subtitleStyle,
  playhead,
  duration,
  fps,
  playing,
  onSeek,
  onToggle,
  onRestart,
}: {
  source: PreviewSource | null;
  videoMuted: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  sessionId: string;
  assets: EditorAsset[];
  audioClips: TimelineClip[];
  subtitles: Array<{ id: string; text: string }>;
  subtitleStyle: {
    fontFamily: string;
    fontSize: number;
    color: string;
  };
  playhead: number;
  duration: number;
  fps: number;
  playing: boolean;
  onSeek: (time: number) => void;
  onToggle: () => void;
  onRestart: () => void;
}) {
  const { t } = useTranslation();
  const [fit, setFit] = useQueryParam<PreviewFit>('fit', StringParam, 'fit');
  const previewRef = useRef<HTMLElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const updateFullscreen = () =>
      setFullscreen(document.fullscreenElement === previewRef.current);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () =>
      document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement === previewRef.current) {
      void document.exitFullscreen();
    } else {
      void previewRef.current?.requestFullscreen();
    }
  };

  return (
    <section
      ref={previewRef}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-zinc-100 p-4 dark:bg-zinc-900"
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950">
            {source ? (
              <video
                ref={videoRef}
                src={source.url}
                muted={videoMuted}
                className={`${
                  fit === 'actual'
                    ? 'h-auto max-h-none w-auto max-w-none object-contain'
                    : `h-full max-h-full w-full ${fit === 'fill' ? 'object-cover' : 'object-contain'}`
                } ${source.clip.hidden ? 'opacity-0' : ''}`}
                onCanPlay={() => {
                  if (playing) void videoRef.current?.play();
                }}
              />
            ) : (
              <Film className="size-10 text-zinc-700" />
            )}
            {audioClips.map((clip) => (
              <AudioClipPreview
                key={clip.id}
                sessionId={sessionId}
                clip={clip}
                assets={assets}
                playhead={playhead}
                playing={playing}
              />
            ))}
            {subtitles.length > 0 && (
              <div
                className="pointer-events-none absolute inset-x-[5%] bottom-[6%] text-center font-semibold [text-shadow:0_2px_4px_#000]"
                style={{
                  color: subtitleStyle.color,
                  fontFamily: subtitleStyle.fontFamily,
                  fontSize: subtitleStyle.fontSize,
                }}
              >
                {subtitles.map((cue) => (
                  <div key={cue.id}>{cue.text}</div>
                ))}
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onToggle}>
            {playing ? <Pause /> : <Play />}
            {playing
              ? t('videoEditor.opencut.pause')
              : t('videoEditor.opencut.play')}
            <ContextMenuShortcut>Space</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={onRestart}>
            {t('videoEditor.opencut.goToStart')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <div className="mt-2 grid h-8 shrink-0 grid-cols-[1fr_auto_1fr] items-center text-xs tabular-nums text-zinc-500">
        <span className="flex items-center font-mono">
          <TimecodeInput
            value={playhead}
            duration={duration}
            fps={fps}
            onChange={onSeek}
          />
          <span className="mx-2 text-zinc-400">/</span>
          {formatTimecode(duration, Math.max(1, Math.round(fps)))}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title={
            playing
              ? t('videoEditor.opencut.pause')
              : t('videoEditor.opencut.play')
          }
          aria-label={
            playing
              ? t('videoEditor.opencut.pause')
              : t('videoEditor.opencut.play')
          }
          onClick={onToggle}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <div className="flex items-center justify-end gap-2">
          <Select
            value={fit}
            onValueChange={(value) => setFit(value as PreviewFit)}
          >
            <SelectTrigger
              size="sm"
              aria-label={t('videoEditor.opencut.previewScale')}
              className="h-8 min-w-20 bg-white dark:bg-zinc-900"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="fit">
                {t('videoEditor.opencut.fit')}
              </SelectItem>
              <SelectItem value="fill">
                {t('videoEditor.opencut.fill')}
              </SelectItem>
              <SelectItem value="actual">
                {t('videoEditor.opencut.actualSize')}
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="h-5 w-px bg-zinc-300" />
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title={
              fullscreen
                ? t('videoEditor.opencut.exitFullscreen')
                : t('videoEditor.opencut.fullscreen')
            }
            aria-label={
              fullscreen
                ? t('videoEditor.opencut.exitFullscreen')
                : t('videoEditor.opencut.fullscreen')
            }
            onClick={toggleFullscreen}
          >
            {fullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

function AudioClipPreview({
  sessionId,
  clip,
  assets,
  playhead,
  playing,
}: {
  sessionId: string;
  clip: TimelineClip;
  assets: EditorAsset[];
  playhead: number;
  playing: boolean;
}) {
  const [source, setSource] = useState<PreviewSource | null>(null);
  const ref = useRef<HTMLAudioElement | null>(null);
  usePreviewSource(sessionId, clip, assets, setSource);
  useEffect(() => {
    syncMedia(ref.current, source, playhead, playing);
  }, [source, playhead, playing]);
  return source ? <audio ref={ref} src={source.url} /> : null;
}

function TimecodeInput({
  value,
  duration,
  fps,
  onChange,
}: {
  value: number;
  duration: number;
  fps: number;
  onChange: (time: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const safeFps = Math.max(1, Math.round(fps));
  const commit = () => {
    const match = draft.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2}):(\d{1,3})$/);
    if (match) {
      const [, hours, minutes, seconds, frames] = match.map(Number);
      if (
        minutes !== undefined &&
        seconds !== undefined &&
        frames !== undefined &&
        minutes < 60 &&
        seconds < 60 &&
        frames < safeFps
      ) {
        onChange(
          Math.min(
            duration,
            (hours ?? 0) * 3600 + minutes * 60 + seconds + frames / safeFps,
          ),
        );
      }
    }
    setEditing(false);
  };
  if (!editing) {
    return (
      <button
        className="rounded px-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
        onClick={() => {
          setDraft(formatTimecode(value, safeFps));
          setEditing(true);
        }}
      >
        {formatTimecode(value, safeFps)}
      </button>
    );
  }
  return (
    <Input
      autoFocus
      aria-label="HH:MM:SS:FF"
      inputMode="numeric"
      value={draft}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') setEditing(false);
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          const delta = event.key === 'ArrowUp' ? 1 / safeFps : -1 / safeFps;
          const next = Math.max(0, Math.min(duration, value + delta));
          onChange(next);
          setDraft(formatTimecode(next, safeFps));
        }
      }}
      className="h-7 w-28 px-1 font-mono text-blue-500"
    />
  );
}

function Inspector({
  clip,
  asset,
  analysis,
  onChange,
}: {
  clip: TimelineClip | null;
  asset: EditorAsset | null;
  analysis: EditorAssetAnalysis | null;
  onChange: (clip: TimelineClip) => void;
}) {
  const { t } = useTranslation();
  if (!asset)
    return (
      <aside className="h-full border-l border-zinc-200 bg-white p-4 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950">
        {t('videoEditor.opencut.selectClip')}
      </aside>
    );
  const setNumber = (
    key: 'offset' | 'sourceStart' | 'duration',
    value: number,
  ) => {
    if (!clip) return;
    if (key === 'sourceStart') {
      const sourceStart = Math.max(0, Math.min(value, asset.duration - 0.05));
      onChange({
        ...clip,
        sourceStart,
        duration: Math.min(clip.duration, asset.duration - sourceStart),
      });
      return;
    }
    const maxDuration = asset.duration - clip.sourceStart;
    onChange({
      ...clip,
      [key]:
        key === 'duration'
          ? Math.max(0.05, Math.min(value, maxDuration))
          : Math.max(0, value),
    });
  };
  return (
    <aside className="h-full min-h-0 overflow-y-auto border-l border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
      <p className="text-xs uppercase tracking-wide text-zinc-400">
        {t('videoEditor.opencut.inspector')}
      </p>
      <h2 className="mt-1 truncate text-sm font-semibold">{asset.name}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <InfoValue
          label={t('mediaTools.duration')}
          value={formatMediaTime(asset.duration)}
        />
        <InfoValue
          label={t('videoEditor.opencut.fileSize')}
          value={formatMediaBytes(asset.size)}
        />
        {analysis?.video && (
          <>
            <InfoValue
              label={t('videoEditor.opencut.resolution')}
              value={`${analysis.video.width} × ${analysis.video.height}`}
            />
            <InfoValue
              label={t('videoEditor.opencut.videoCodec')}
              value={
                analysis.video.codecParameter ?? analysis.video.codec ?? '—'
              }
            />
            <InfoValue
              label={t('videoEditor.opencut.frameRate')}
              value={`${analysis.video.fps} fps`}
            />
          </>
        )}
        {analysis?.audio && (
          <>
            <InfoValue
              label={t('videoEditor.opencut.audioCodec')}
              value={
                analysis.audio.codecParameter ?? analysis.audio.codec ?? '—'
              }
            />
            <InfoValue
              label={t('videoEditor.opencut.sampleRate')}
              value={`${analysis.audio.sampleRate} Hz`}
            />
            <InfoValue
              label={t('videoEditor.opencut.channels')}
              value={String(analysis.audio.channels)}
            />
          </>
        )}
      </div>
      {clip && (
        <div className="mt-5 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <NumberField
            label={t('videoEditor.opencut.timelineStart')}
            value={clip.offset}
            onChange={(value) => setNumber('offset', value)}
          />
          <NumberField
            label={t('videoEditor.opencut.sourceStart')}
            value={clip.sourceStart}
            onChange={(value) => setNumber('sourceStart', value)}
          />
          <NumberField
            label={t('mediaTools.duration')}
            value={clip.duration}
            onChange={(value) => setNumber('duration', value)}
          />
        </div>
      )}
    </aside>
  );
}

function InfoValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-zinc-100 p-2 dark:bg-zinc-800">
      <span className="block text-[10px] text-zinc-400">{label}</span>
      <span className="mt-0.5 block break-all font-medium">{value}</span>
    </div>
  );
}

function Timeline({
  assets,
  analyses,
  thumbnails,
  clips,
  tracks,
  subtitles,
  duration,
  playhead,
  zoom,
  setZoom,
  selectedClipId,
  setSelectedClipId,
  setPlayhead,
  onChangeClip,
  tool,
  setTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSplit,
  onDuplicate,
  onCopy,
  onToggleMuted,
  onExtractAudio,
  onToggleHidden,
  onRevealMedia,
  onReplaceMedia,
  onDelete,
  snapping,
  onToggleSnapping,
  onChangeTrack,
  onAddTrack,
  onDropAsset,
  onDropNewTrack,
  draggedAssetKind,
}: {
  assets: EditorAsset[];
  analyses: Record<string, EditorAssetAnalysis>;
  thumbnails: Record<string, TimelineThumbnail[]>;
  clips: TimelineClip[];
  tracks: EditorTrack[];
  subtitles: Array<{
    id: string;
    trackId: string;
    start: number;
    end: number;
    text: string;
  }>;
  duration: number;
  playhead: number;
  zoom: number;
  setZoom: (zoom: number) => void;
  selectedClipId: string | null;
  setSelectedClipId: (id: string) => void;
  setPlayhead: (time: number) => void;
  onChangeClip: (clip: TimelineClip) => void;
  tool: TimelineTool;
  setTool: (tool: TimelineTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSplit: (clipId: string, at: number) => void;
  onDuplicate: (clipId: string) => void;
  onCopy: (clipId: string) => void;
  onToggleMuted: (clipId: string) => void;
  onExtractAudio: (clipId: string) => void;
  onToggleHidden: (clipId: string) => void;
  onRevealMedia: (clipId: string) => void;
  onReplaceMedia: (clipId: string) => void;
  onDelete: (clipId: string) => void;
  snapping: boolean;
  onToggleSnapping: () => void;
  onChangeTrack: (track: EditorTrack) => void;
  onAddTrack: (kind: EditorTrack['kind']) => void;
  onDropAsset: (assetId: string, trackId: string, offset: number) => void;
  onDropNewTrack: (
    kind: 'video' | 'audio',
    assetId: string,
    offset: number,
  ) => void;
  draggedAssetKind: 'video' | 'audio' | null;
}) {
  const { t } = useTranslation();
  const pixelsPerSecond = 24 + zoom * 1.5;
  const contentWidth = Math.max(900, duration * pixelsPerSecond + 120);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const seeking = useRef(false);
  const [snapGuide, setSnapGuide] = useState<number | null>(null);
  const seekFromPointer = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPlayhead(
      Math.max(
        0,
        Math.min(duration, (event.clientX - rect.left) / pixelsPerSecond),
      ),
    );
  };
  const dropTime = (clientX: number) => {
    const rect = contentRef.current?.getBoundingClientRect();
    return rect ? Math.max(0, (clientX - rect.left) / pixelsPerSecond) : 0;
  };
  const trackIcon = (track: EditorTrack) => {
    if (track.kind === 'video') return <Film className="size-3.5" />;
    if (track.kind === 'audio') return <Music2 className="size-3.5" />;
    return <Captions className="size-3.5" />;
  };
  return (
    <section className="h-full min-h-0 border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
      <div className="flex h-10 items-center justify-between border-b border-zinc-200 px-3 dark:border-zinc-700">
        <div className="flex items-center gap-1">
          <button
            title={t('videoEditor.opencut.undo')}
            disabled={!canUndo}
            onClick={onUndo}
            className="grid size-7 place-items-center rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            title={t('videoEditor.opencut.redo')}
            disabled={!canRedo}
            onClick={onRedo}
            className="grid size-7 place-items-center rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
          >
            <Redo2 className="size-4" />
          </button>
          <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          <button
            title={t('videoEditor.opencut.selectTool')}
            aria-pressed={tool === 'select'}
            onClick={() => setTool('select')}
            className={`grid size-7 place-items-center rounded ${tool === 'select' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            <MousePointer2 className="size-4" />
          </button>
          <button
            title={t('videoEditor.opencut.razorTool')}
            aria-pressed={tool === 'razor'}
            onClick={() => setTool('razor')}
            className={`grid size-7 place-items-center rounded ${tool === 'razor' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            <Scissors className="size-4" />
          </button>
          <button
            title={t('videoEditor.opencut.deleteClip')}
            disabled={!selectedClipId}
            onClick={() => selectedClipId && onDelete(selectedClipId)}
            className="grid size-7 place-items-center rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
          >
            <Trash2 className="size-4" />
          </button>
          <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          <button
            title={t('videoEditor.opencut.snapping')}
            aria-pressed={snapping}
            onClick={onToggleSnapping}
            className={`grid size-7 place-items-center rounded ${snapping ? 'bg-blue-100 text-blue-600 dark:bg-blue-950' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            <Magnet className="size-4" />
          </button>
          <button
            title={t('videoEditor.opencut.addVideoTrack')}
            onClick={() => onAddTrack('video')}
            className="grid size-7 place-items-center rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Film className="size-4" />
          </button>
          <button
            title={t('videoEditor.opencut.addAudioTrack')}
            onClick={() => onAddTrack('audio')}
            className="grid size-7 place-items-center rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Music2 className="size-4" />
          </button>
        </div>
        <span className="text-xs font-medium">
          {t('videoEditor.opencut.timeline')}
        </span>
        <Slider
          aria-label={t('videoEditor.opencut.zoom')}
          className="w-28"
          value={[zoom]}
          max={100}
          onValueChange={(value) => setZoom(value[0] ?? 50)}
        />
      </div>
      <div className="grid h-[calc(100%-2.5rem)] min-h-0 grid-cols-[112px_minmax(0,1fr)]">
        <div className="overflow-hidden border-r border-zinc-200 bg-zinc-50 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <div className="h-7 border-b border-zinc-200 dark:border-zinc-700" />
          {tracks.map((track) => (
            <div
              key={track.id}
              className="mb-0.5 flex h-14 items-center gap-1 bg-white px-2 dark:bg-zinc-950"
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate font-medium">
                {trackIcon(track)}
                {track.name}
              </span>
              <button
                title={
                  track.kind === 'audio'
                    ? t('videoEditor.opencut.trackMute')
                    : t('videoEditor.opencut.trackVisibility')
                }
                aria-pressed={
                  track.kind === 'audio' ? track.muted : track.hidden
                }
                onClick={() =>
                  onChangeTrack(
                    track.kind === 'audio'
                      ? { ...track, muted: !track.muted }
                      : { ...track, hidden: !track.hidden },
                  )
                }
                className="grid size-6 place-items-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {track.kind === 'audio' ? (
                  track.muted ? (
                    <VolumeX className="size-3.5" />
                  ) : (
                    <Volume2 className="size-3.5" />
                  )
                ) : track.hidden ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
              <button
                title={t('videoEditor.opencut.trackLock')}
                aria-pressed={track.locked}
                onClick={() =>
                  onChangeTrack({ ...track, locked: !track.locked })
                }
                className={`grid size-6 place-items-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${track.locked ? 'text-blue-600' : ''}`}
              >
                <Lock className="size-3.5" />
              </button>
            </div>
          ))}
          {draggedAssetKind && (
            <button
              onClick={() => onAddTrack(draggedAssetKind)}
              className="mb-0.5 flex h-7 w-full items-center justify-center gap-1 border-y border-dashed border-zinc-300 text-[10px] text-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:text-zinc-200"
            >
              <Plus className="size-3" />
              {draggedAssetKind === 'video'
                ? t('videoEditor.opencut.addVideoTrack')
                : t('videoEditor.opencut.addAudioTrack')}
            </button>
          )}
        </div>
        <div
          ref={scrollRef}
          className="overflow-auto bg-zinc-50 dark:bg-zinc-900"
          onWheel={(event) => {
            if (event.deltaY === 0) return;
            event.preventDefault();
            const scroller = scrollRef.current;
            if (!scroller) return;
            const nextZoom = Math.max(
              0,
              Math.min(100, zoom - Math.sign(event.deltaY) * 5),
            );
            const nextPixelsPerSecond = 24 + nextZoom * 1.5;
            const anchorX =
              event.clientX - scroller.getBoundingClientRect().left;
            const anchorTime =
              (scroller.scrollLeft + anchorX) / pixelsPerSecond;
            setZoom(nextZoom);
            requestAnimationFrame(() => {
              scroller.scrollLeft = Math.max(
                0,
                anchorTime * nextPixelsPerSecond - anchorX,
              );
            });
          }}
        >
          <div
            ref={contentRef}
            className="relative min-h-full min-w-full bg-zinc-50 dark:bg-zinc-900"
            style={{
              width: contentWidth,
              minHeight: 28 + tracks.length * 58 + (draggedAssetKind ? 29 : 0),
            }}
          >
            <div
              className="sticky top-0 z-20 flex h-7 cursor-ew-resize select-none items-end border-b border-zinc-200 bg-zinc-50 text-[10px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                seeking.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                seekFromPointer(event);
              }}
              onPointerMove={(event) =>
                seeking.current && seekFromPointer(event)
              }
              onPointerUp={(event) => {
                seeking.current = false;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
            >
              {createRulerMarks(contentWidth, pixelsPerSecond).map((time) => (
                <span
                  key={time}
                  className="absolute top-2 border-l border-zinc-200 pl-1"
                  style={{ left: time * pixelsPerSecond }}
                >
                  {formatTimecode(time)}
                </span>
              ))}
            </div>
            {tracks.map((track) => (
              <div
                key={track.id}
                data-track-id={track.id}
                data-track-kind={track.kind}
                data-track-locked={track.locked ? 'true' : 'false'}
                className="relative mb-0.5 h-14 bg-white dark:bg-zinc-950"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const assetId = event.dataTransfer.getData(
                    'application/x-editor-asset',
                  );
                  if (assetId)
                    onDropAsset(assetId, track.id, dropTime(event.clientX));
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  seeking.current = true;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  seekFromPointer(event);
                }}
                onPointerMove={(event) =>
                  seeking.current && seekFromPointer(event)
                }
                onPointerUp={(event) => {
                  seeking.current = false;
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
              >
                {track.kind === 'subtitle'
                  ? subtitles
                      .filter((cue) => cue.trackId === track.id)
                      .map((cue) => (
                        <div
                          key={cue.id}
                          className="absolute inset-y-1 overflow-hidden rounded bg-amber-500 px-2 py-1 text-xs text-white"
                          style={{
                            left: cue.start * pixelsPerSecond,
                            width: Math.max(
                              12,
                              (cue.end - cue.start) * pixelsPerSecond,
                            ),
                          }}
                        >
                          {cue.text}
                        </div>
                      ))
                  : clips
                      .filter((clip) => {
                        if (clip.trackId) return clip.trackId === track.id;
                        return (
                          clip.kind === track.kind &&
                          tracks.find((item) => item.kind === clip.kind)?.id ===
                            track.id
                        );
                      })
                      .map((clip) => {
                        const asset = assets.find(
                          ({ id }) => id === clip.assetId,
                        );
                        if (!asset) return null;
                        return (
                          <TimelineClipView
                            key={clip.id}
                            clip={clip}
                            asset={asset}
                            analysis={analyses[clip.assetId]}
                            thumbnails={thumbnails[clip.assetId] ?? []}
                            pixelsPerSecond={pixelsPerSecond}
                            tool={tool}
                            selected={selectedClipId === clip.id}
                            locked={track.locked}
                            snapping={snapping}
                            allClips={clips}
                            playhead={playhead}
                            onSnapGuide={setSnapGuide}
                            onSelect={() => setSelectedClipId(clip.id)}
                            onSeek={setPlayhead}
                            onSplit={(at) => onSplit(clip.id, at)}
                            onDuplicate={() => onDuplicate(clip.id)}
                            onCopy={() => onCopy(clip.id)}
                            onToggleMuted={() => onToggleMuted(clip.id)}
                            onExtractAudio={() => onExtractAudio(clip.id)}
                            onToggleHidden={() => onToggleHidden(clip.id)}
                            onRevealMedia={() => onRevealMedia(clip.id)}
                            onReplaceMedia={() => onReplaceMedia(clip.id)}
                            onDelete={() => onDelete(clip.id)}
                            onChange={onChangeClip}
                          />
                        );
                      })}
              </div>
            ))}
            {draggedAssetKind && (
              <div
                className="mb-0.5 flex h-7 items-center justify-center border-y border-dashed border-zinc-300 text-[10px] text-zinc-400 dark:border-zinc-700"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const assetId = event.dataTransfer.getData(
                    'application/x-editor-asset',
                  );
                  if (assetId)
                    onDropNewTrack(
                      draggedAssetKind,
                      assetId,
                      dropTime(event.clientX),
                    );
                }}
              >
                {t('videoEditor.opencut.dropNewTrack')}
              </div>
            )}
            {snapGuide !== null && (
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-40 w-px bg-emerald-500"
                style={{ left: snapGuide * pixelsPerSecond }}
              />
            )}
            <div
              className="absolute bottom-0 top-0 z-30 w-3 -translate-x-1/2 cursor-ew-resize touch-none"
              style={{ left: playhead * pixelsPerSecond }}
              role="slider"
              aria-label={t('videoEditor.opencut.playhead')}
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={playhead}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                seeking.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                seekFromPointer(event);
              }}
              onPointerMove={(event) =>
                seeking.current && seekFromPointer(event)
              }
              onPointerUp={(event) => {
                seeking.current = false;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
            >
              <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-blue-600" />
              <span className="absolute left-1/2 top-5 size-3 -translate-x-1/2 rotate-45 rounded-sm bg-blue-600" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TimelineClipView({
  clip,
  asset,
  analysis,
  thumbnails,
  pixelsPerSecond,
  tool,
  selected,
  locked,
  snapping,
  allClips,
  playhead,
  onSnapGuide,
  onSelect,
  onSeek,
  onSplit,
  onDuplicate,
  onCopy,
  onToggleMuted,
  onExtractAudio,
  onToggleHidden,
  onRevealMedia,
  onReplaceMedia,
  onDelete,
  onChange,
}: {
  clip: TimelineClip;
  asset: EditorAsset;
  analysis: EditorAssetAnalysis | undefined;
  thumbnails: TimelineThumbnail[];
  pixelsPerSecond: number;
  tool: TimelineTool;
  selected: boolean;
  locked: boolean;
  snapping: boolean;
  allClips: TimelineClip[];
  playhead: number;
  onSnapGuide: (time: number | null) => void;
  onSelect: () => void;
  onSeek: (time: number) => void;
  onSplit: (time: number) => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onToggleMuted: () => void;
  onExtractAudio: () => void;
  onToggleHidden: () => void;
  onRevealMedia: () => void;
  onReplaceMedia: () => void;
  onDelete: () => void;
  onChange: (clip: TimelineClip) => void;
}) {
  const { t } = useTranslation();
  const contextTime = useRef(clip.offset);
  const [draft, setDraft] = useState<TimelineClip | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const drag = useRef<{
    mode: 'move' | 'left' | 'right';
    x: number;
    y: number;
    clip: TimelineClip;
    current: TimelineClip;
  } | null>(null);
  const displayedClip = draft ?? clip;
  const width = Math.max(12, displayedClip.duration * pixelsPerSecond);
  const startDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    mode: 'move' | 'left' | 'right',
  ) => {
    event.stopPropagation();
    if (event.button !== 0 || locked) return;
    if (tool === 'razor') {
      const rect = event.currentTarget.getBoundingClientRect();
      const at = Math.max(
        clip.offset,
        Math.min(
          clip.offset + clip.duration,
          clip.offset + (event.clientX - rect.left) / pixelsPerSecond,
        ),
      );
      onSeek(at);
      onSelect();
      onSplit(at);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      mode,
      x: event.clientX,
      y: event.clientY,
      clip,
      current: clip,
    };
    setDragOffsetY(0);
    onSelect();
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = (event.clientX - drag.current.x) / pixelsPerSecond;
    const initial = drag.current.clip;
    let next: TimelineClip;
    if (drag.current.mode === 'move') {
      setDragOffsetY(event.clientY - drag.current.y);
      const desiredOffset = Math.max(0, initial.offset + delta);
      if (snapping && !event.altKey) {
        const snapped = snapTimelineClip(
          initial,
          desiredOffset,
          allClips,
          pixelsPerSecond,
          playhead,
        );
        next = moveTimelineClip(initial, snapped.offset);
        onSnapGuide(snapped.guide);
      } else {
        next = moveTimelineClip(initial, desiredOffset);
        onSnapGuide(null);
      }
    } else if (drag.current.mode === 'left') {
      const change = Math.max(
        -initial.sourceStart,
        Math.min(delta, initial.duration - 0.05),
      );
      next = {
        ...initial,
        offset: Math.max(0, initial.offset + change),
        sourceStart: initial.sourceStart + change,
        duration: initial.duration - change,
      };
    } else {
      next = {
        ...initial,
        duration: Math.max(
          0.05,
          Math.min(
            initial.duration + delta,
            asset.duration - initial.sourceStart,
          ),
        ),
      };
    }
    drag.current.current = next;
    setDraft(next);
  };
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      const row = Array.from(
        document.querySelectorAll<HTMLElement>(
          `[data-track-kind="${clip.kind}"]`,
        ),
      ).find((candidate) => {
        const bounds = candidate.getBoundingClientRect();
        return event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      });
      const nextTrackId = row?.dataset.trackId;
      const nextTrackKind = row?.dataset.trackKind;
      onChange({
        ...drag.current.current,
        trackId:
          nextTrackId &&
          nextTrackKind === clip.kind &&
          row.dataset.trackLocked !== 'true'
            ? nextTrackId
            : drag.current.current.trackId,
      });
    }
    drag.current = null;
    setDraft(null);
    setDragOffsetY(0);
    onSnapGuide(null);
  };
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`absolute inset-y-1 flex min-w-3 select-none items-center overflow-hidden rounded text-xs text-white shadow-sm ${tool === 'select' ? 'cursor-grab active:cursor-grabbing' : ''} ${clip.kind === 'video' ? 'bg-blue-500' : 'bg-violet-500'} ${clip.hidden ? 'opacity-55' : ''} ${selected ? 'ring-2 ring-zinc-900 ring-offset-1' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={asset.name}
          style={{
            left: displayedClip.offset * pixelsPerSecond,
            width,
            transform:
              draft && dragOffsetY !== 0
                ? `translateY(${dragOffsetY}px)`
                : undefined,
            zIndex: draft ? 50 : undefined,
            cursor: tool === 'razor' ? RAZOR_CURSOR : undefined,
          }}
          onContextMenu={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            contextTime.current = Math.max(
              clip.offset,
              Math.min(
                clip.offset + clip.duration,
                clip.offset + (event.clientX - rect.left) / pixelsPerSecond,
              ),
            );
            onSelect();
          }}
          onPointerDown={(event) => startDrag(event, 'move')}
          onPointerMove={move}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          {tool === 'select' && (
            <div
              className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize bg-white/35"
              onPointerDown={(event) => startDrag(event, 'left')}
              onPointerMove={move}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            />
          )}
          {clip.kind === 'video' && thumbnails.length > 0 ? (
            <Filmstrip
              clip={displayedClip}
              thumbnails={thumbnails}
              width={width}
            />
          ) : clip.kind === 'audio' && analysis?.waveform.length ? (
            <Waveform
              peaks={analysis.waveform}
              sourceStart={displayedClip.sourceStart}
              duration={displayedClip.duration}
              sourceDuration={asset.duration}
            />
          ) : (
            <span className="truncate px-3">{asset.name}</span>
          )}
          {(clip.muted || clip.hidden) && (
            <span className="pointer-events-none absolute right-2 top-1 flex gap-1 rounded bg-black/55 p-1">
              {clip.muted && <VolumeX className="size-3" />}
              {clip.hidden && <EyeOff className="size-3" />}
            </span>
          )}
          {tool === 'select' && (
            <div
              className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize bg-white/35"
              onPointerDown={(event) => startDrag(event, 'right')}
              onPointerMove={move}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent
        className="z-[100] w-64 shadow-xl"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <ContextMenuItem
          onSelect={() => {
            onSeek(contextTime.current);
            onSplit(contextTime.current);
          }}
        >
          <Scissors />
          {t('videoEditor.opencut.splitHere')}
          <ContextMenuShortcut>S</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCopy}>
          <ClipboardCopy />
          {t('videoEditor.opencut.copyClip')}
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onDuplicate}>
          <Copy />
          {t('videoEditor.opencut.duplicateClip')}
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onToggleMuted}>
          {clip.muted ? <Volume2 /> : <VolumeX />}
          {clip.muted
            ? t('videoEditor.opencut.unmuteClip')
            : t('videoEditor.opencut.muteClip')}
        </ContextMenuItem>
        <ContextMenuItem
          disabled={clip.kind !== 'video'}
          onSelect={onExtractAudio}
        >
          <AudioLines />
          {t('videoEditor.opencut.extractAudio')}
        </ContextMenuItem>
        <ContextMenuItem
          disabled={clip.kind !== 'video'}
          onSelect={onToggleHidden}
        >
          {clip.hidden ? <Eye /> : <EyeOff />}
          {clip.hidden
            ? t('videoEditor.opencut.showClip')
            : t('videoEditor.opencut.hideClip')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onRevealMedia}>
          <Search />
          {t('videoEditor.opencut.revealMedia')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onReplaceMedia}>
          <RefreshCw />
          {t('videoEditor.opencut.replaceMedia')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          {t('videoEditor.opencut.deleteClip')}
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function Filmstrip({
  clip,
  thumbnails,
  width,
}: {
  clip: TimelineClip;
  thumbnails: TimelineThumbnail[];
  width: number;
}) {
  const count = Math.max(1, Math.ceil(width / 72));
  return (
    <span className="pointer-events-none absolute inset-0 flex overflow-hidden">
      {Array.from({ length: count }, (_, index) => {
        const time = clip.sourceStart + clip.duration * ((index + 0.5) / count);
        const thumbnail = thumbnails.reduce((nearest, candidate) =>
          Math.abs(candidate.ts / 1_000_000 - time) <
          Math.abs(nearest.ts / 1_000_000 - time)
            ? candidate
            : nearest,
        );
        return (
          <img
            key={`${index}-${thumbnail.ts}`}
            src={thumbnail.url}
            alt=""
            draggable={false}
            className="min-w-0 flex-1 border-r border-white/20 object-cover"
          />
        );
      })}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-2 py-0.5 text-[10px]">
        {formatTimecode(clip.sourceStart)}
      </span>
    </span>
  );
}

function Waveform({
  peaks,
  sourceStart,
  duration,
  sourceDuration,
}: {
  peaks: number[];
  sourceStart: number;
  duration: number;
  sourceDuration: number;
}) {
  const start = Math.floor((sourceStart / sourceDuration) * peaks.length);
  const end = Math.max(
    start + 1,
    Math.ceil(((sourceStart + duration) / sourceDuration) * peaks.length),
  );
  const visible = peaks.slice(start, end);
  return (
    <svg
      viewBox={`0 0 ${visible.length} 2`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)]"
      aria-hidden="true"
    >
      {visible.map((peak, index) => (
        <line
          key={index}
          x1={index}
          x2={index}
          y1={1 - Math.max(0.04, peak)}
          y2={1 + Math.max(0.04, peak)}
          stroke="currentColor"
          strokeWidth="0.7"
          className="text-white/80"
        />
      ))}
    </svg>
  );
}

function NumberField({
  label,
  value,
  step = 0.05,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[1fr_100px] items-center gap-3 text-xs text-zinc-500">
      {label}
      <Input
        type="number"
        min={0}
        step={step}
        value={Number(value.toFixed(2))}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 text-right text-zinc-900 dark:text-zinc-100"
      />
    </label>
  );
}

function createTimelineClip(
  asset: EditorAsset,
  offset: number,
  trackId: string,
): TimelineClip {
  if (asset.kind !== 'video' && asset.kind !== 'audio') {
    throw new Error('MEDIA_ASSET_REQUIRED');
  }
  return {
    id: crypto.randomUUID(),
    assetId: asset.id,
    kind: asset.kind,
    trackId,
    offset,
    sourceStart: 0,
    duration: asset.duration,
  };
}

function findActiveVideoClip(
  clips: TimelineClip[],
  tracks: EditorTrack[],
  playhead: number,
): TimelineClip | null {
  const visibleTracks = tracks.filter(
    (track) => track.kind === 'video' && !track.hidden,
  );
  for (let index = visibleTracks.length - 1; index >= 0; index -= 1) {
    const track = visibleTracks[index];
    const clip = clips.find(
      (item) =>
        item.kind === 'video' &&
        !item.hidden &&
        item.trackId === track?.id &&
        playhead >= item.offset &&
        playhead < item.offset + item.duration,
    );
    if (clip) return clip;
  }
  return null;
}

function usePreviewSource(
  sessionId: string,
  clip: TimelineClip | null,
  assets: EditorAsset[],
  setSource: (source: PreviewSource | null) => void,
) {
  const asset = clip
    ? (assets.find(({ id }) => id === clip.assetId) ?? null)
    : null;
  useEffect(() => {
    if (!clip || !asset) {
      setSource(null);
      return;
    }
    let active = true;
    let url: string | null = null;
    void readEditorAsset(sessionId, asset).then((file) => {
      if (!active) return;
      url = URL.createObjectURL(file);
      setSource({ url, clip });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [
    sessionId,
    clip?.id,
    clip?.offset,
    clip?.sourceStart,
    clip?.duration,
    clip?.muted,
    clip?.hidden,
    asset?.id,
  ]);
}

function useTimelineThumbnails(
  sessionId: string,
  assets: EditorAsset[],
): Record<string, TimelineThumbnail[]> {
  const [thumbnails, setThumbnails] = useState<
    Record<string, TimelineThumbnail[]>
  >({});

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    void (async () => {
      const next: Record<string, TimelineThumbnail[]> = {};
      for (const asset of assets) {
        if (asset.kind !== 'video') continue;
        try {
          const files = await loadEditorThumbnails(sessionId, asset);
          next[asset.id] = files.map(({ ts, file }) => {
            const url = URL.createObjectURL(file);
            urls.push(url);
            return { ts, url };
          });
        } catch {
          next[asset.id] = [];
        }
      }
      if (cancelled) urls.forEach(URL.revokeObjectURL);
      else setThumbnails(next);
    })();
    return () => {
      cancelled = true;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [assets, sessionId]);

  return thumbnails;
}

function useAssetAnalyses(
  sessionId: string,
  assets: EditorAsset[],
): Record<string, EditorAssetAnalysis> {
  const [analyses, setAnalyses] = useState<Record<string, EditorAssetAnalysis>>(
    {},
  );
  useEffect(() => {
    let cancelled = false;
    const media = assets.filter(
      (asset) => asset.kind === 'video' || asset.kind === 'audio',
    );
    void Promise.all(
      media.map(async (asset) => {
        try {
          return await analyzeEditorAsset(sessionId, asset);
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setAnalyses(
        Object.fromEntries(
          results
            .filter((result): result is EditorAssetAnalysis => Boolean(result))
            .map((result) => [result.assetId, result]),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [assets, sessionId]);
  return analyses;
}

function useEditorFont(
  sessionId: string,
  style: EditorSubtitleStyle,
  assets: EditorAsset[],
) {
  const asset = assets.find(({ id }) => id === style.fontAssetId);
  useEffect(() => {
    if (!asset || asset.kind !== 'font') return;
    let font: FontFace | null = null;
    let cancelled = false;
    void readEditorAsset(sessionId, asset).then(async (file) => {
      font = new FontFace(style.fontFamily, await file.arrayBuffer());
      await font.load();
      if (!cancelled) document.fonts.add(font);
    });
    return () => {
      cancelled = true;
      if (font) document.fonts.delete(font);
    };
  }, [asset?.id, sessionId, style.fontFamily]);
}

function syncMedia(
  media: HTMLMediaElement | null,
  source: PreviewSource | null,
  playhead: number,
  playing: boolean,
) {
  if (!media || !source) return;
  const target = source.clip.sourceStart + playhead - source.clip.offset;
  if (!playing || Math.abs(media.currentTime - target) > 0.25) {
    media.currentTime = Math.max(0, target);
  }
  if (playing) void media.play().catch(() => undefined);
  else media.pause();
}

function createRulerMarks(width: number, pixelsPerSecond: number): number[] {
  const step = pixelsPerSecond >= 80 ? 1 : pixelsPerSecond >= 45 ? 2 : 5;
  return Array.from(
    { length: Math.ceil(width / pixelsPerSecond / step) + 1 },
    (_, index) => index * step,
  );
}

function formatTimecode(value: number, fps = 30): string {
  const safe = Math.max(0, value);
  const frames = Math.floor((safe % 1) * fps);
  return `${formatMediaTime(safe)}:${String(frames).padStart(2, '0')}`;
}
