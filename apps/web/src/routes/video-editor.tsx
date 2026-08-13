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
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { formatMediaBytes, formatMediaTime } from '@/lib/media-tools';
import { VIDEO_EDITOR_CONFIG } from '@/lib/video-editor-config';
import { useVideoEditorStore } from '@/lib/video-editor-store';
import {
  duplicateTimelineClip,
  exportEditorTimeline,
  extractTimelineAudio,
  isWebAvCompatibleFile,
  loadEditorProject,
  loadEditorThumbnails,
  moveTimelineClip,
  readEditorAsset,
  saveEditorProject,
  storeEditorAsset,
  timelineDuration,
  type EditorAsset,
  type EditorExportSettings,
  type TimelineClip,
} from '@/lib/webav-editor';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import {
  AudioLines,
  Clapperboard,
  ClipboardCopy,
  Copy,
  Download,
  Eye,
  EyeOff,
  Film,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Music2,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  Scissors,
  Search,
  Settings2,
  Trash2,
  Undo2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
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

type EditorPanel = 'media' | 'audio' | 'settings';
type TimelineTool = 'select' | 'razor';
type PreviewFit = 'fit' | 'fill' | 'actual';
type PreviewSource = { url: string; clip: TimelineClip };
type TimelineThumbnail = { ts: number; url: string };
const RAZOR_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27white%27 stroke=%27black%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Ccircle cx=%276%27 cy=%277%27 r=%273%27/%3E%3Cpath d=%27M8.7 8.3 19 14.5%27/%3E%3Ccircle cx=%276%27 cy=%2717%27 r=%273%27/%3E%3Cpath d=%27m8.7 15.7 10.3-6.2%27/%3E%3C/svg%3E") 6 7, crosshair';

function VideoEditorPage() {
  const { t } = useTranslation();
  const [panel, setPanel] = useQueryParam<EditorPanel>(
    'panel',
    StringParam,
    'media',
  );
  const sessionId = VIDEO_EDITOR_CONFIG.sessionId;
  const project = useVideoEditorStore(({ project }) => project);
  const setProject = useVideoEditorStore(({ setProject }) => setProject);
  const hydrateProject = useVideoEditorStore(
    ({ hydrateProject }) => hydrateProject,
  );
  const undo = useVideoEditorStore(({ undoProject }) => undoProject);
  const redo = useVideoEditorStore(({ redoProject }) => redoProject);
  const { name, assets, clips, playhead, zoom } = project;
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [revealedAssetId, setRevealedAssetId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [timelineTool, setTimelineTool] = useState<TimelineTool>('select');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [videoSource, setVideoSource] = useState<PreviewSource | null>(null);
  const [audioSource, setAudioSource] = useState<PreviewSource | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipboardClip = useRef<TimelineClip | null>(null);
  const replaceClipId = useRef<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const duration = timelineDuration(clips);
  const selectedClip = clips.find(({ id }) => id === selectedClipId) ?? null;
  const selectedAsset = selectedClip
    ? (assets.find(({ id }) => id === selectedClip.assetId) ?? null)
    : null;
  const activeVideo = findActiveClip(clips, playhead, 'video');
  const activeAudio = findActiveClip(clips, playhead, 'audio');
  const thumbnails = useTimelineThumbnails(sessionId, assets);
  const canUndo = useStore(
    useVideoEditorStore.temporal,
    ({ pastStates }) => pastStates.length > 0,
  );
  const canRedo = useStore(
    useVideoEditorStore.temporal,
    ({ futureStates }) => futureStates.length > 0,
  );

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
    if (!hydrated || playing) return;
    const timer = window.setTimeout(() => {
      void saveEditorProject(sessionId, project).catch(() =>
        setError(t('videoEditor.opencut.saveError')),
      );
    }, 50);
    return () => window.clearTimeout(timer);
  }, [hydrated, playing, project, sessionId, t]);

  usePreviewSource(sessionId, activeVideo, assets, setVideoSource);
  usePreviewSource(sessionId, activeAudio, assets, setAudioSource);

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

  useEffect(() => {
    syncMedia(audioRef.current, audioSource, playhead, playing);
  }, [audioSource, playhead, playing]);

  const importFiles = async (items: DroppedFile[]) => {
    const files = items.map(({ file }) => file);
    if (files.length === 0) return;
    if (
      files.some((file) => !isWebAvCompatibleFile(file)) ||
      (!assets.some(({ kind }) => kind === 'video') &&
        !files.some((file) => !file.type.startsWith('audio/')))
    ) {
      setError(t('videoEditor.opencut.unsupportedImport'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextAssets = [...assets];
      const nextClips = [...clips];
      let nextName = name;
      for (const file of files) {
        const asset = await storeEditorAsset(sessionId, file);
        nextAssets.push(asset);
        const offset =
          asset.kind === 'video'
            ? timelineDuration(
                nextClips.filter((clip) => clip.kind === 'video'),
              )
            : playhead;
        const clip = createTimelineClip(asset, offset);
        nextClips.push(clip);
        setSelectedClipId(clip.id);
        if (
          asset.kind === 'video' &&
          nextAssets.filter(({ kind }) => kind === 'video').length === 1
        ) {
          nextName = asset.name.replace(/\.mp4$/i, '');
        }
      }
      setProject((current) => ({
        ...current,
        name: nextName,
        assets: nextAssets,
        clips: nextClips,
      }));
    } catch {
      setError(t('videoEditor.opencut.importError'));
    } finally {
      setLoading(false);
    }
  };

  const addAssetAgain = (asset: EditorAsset) => {
    const offset =
      asset.kind === 'video'
        ? timelineDuration(clips.filter((clip) => clip.kind === 'video'))
        : playhead;
    const clip = createTimelineClip(asset, offset);
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
    setProject((current) => ({
      ...current,
      clips: [
        ...current.clips.map((item) =>
          item.id === clipId ? extracted.video : item,
        ),
        extracted.audio,
      ],
    }));
    setSelectedClipId(extracted.audio.id);
  };

  const revealClipMedia = (clipId: string) => {
    const clip = clips.find(({ id }) => id === clipId);
    const asset = clip
      ? assets.find(({ id }) => id === clip.assetId)
      : undefined;
    if (!asset) return;
    setPanel(asset.kind === 'video' ? 'media' : 'audio');
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
    const nextKind = file.type.startsWith('audio/') ? 'audio' : 'video';
    if (
      !clip ||
      !previousAsset ||
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
      if ((event.metaKey || event.ctrlKey) && key === 'z') {
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
    if (clips.length === 0) return;
    setLoading(true);
    setProgress(0);
    setError(null);
    try {
      const output = await exportEditorTimeline(
        sessionId,
        { assets, clips },
        name,
        project.exportSettings,
        setProgress,
      );
      const url = URL.createObjectURL(output);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = output.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('videoEditor.opencut.exportError'));
    } finally {
      setLoading(false);
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

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f5f6f8] text-zinc-900">
      <EditorHeader
        name={name}
        setName={(nextName) =>
          setProject((current) => ({ ...current, name: nextName }))
        }
        loading={loading}
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

      <main className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_280px]">
        <AssetPanel
          panel={panel}
          setPanel={setPanel}
          assets={assets}
          revealedAssetId={revealedAssetId}
          exportSettings={project.exportSettings}
          loading={loading}
          onFiles={importFiles}
          onAdd={addAssetAgain}
          onChangeExportSettings={(exportSettings) =>
            setProject((current) => ({ ...current, exportSettings }))
          }
        />
        <Preview
          source={videoSource}
          videoRef={videoRef}
          audioRef={audioRef}
          audioSource={audioSource}
          playhead={playhead}
          duration={duration}
          playing={playing}
          onToggle={() => setPlaying((current) => !current)}
          onRestart={() =>
            setProject((current) => ({ ...current, playhead: 0 }), false)
          }
        />
        <Inspector
          clip={selectedClip}
          asset={selectedAsset}
          onChange={updateClip}
        />
      </main>

      <Timeline
        assets={assets}
        thumbnails={thumbnails}
        clips={clips}
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
      />

      <input
        ref={replaceInputRef}
        type="file"
        accept="video/mp4,.mp4,audio/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void replaceClipMedia(file);
          event.target.value = '';
        }}
      />

      {loading && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-100">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${Math.max(5, progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function EditorHeader({
  name,
  setName,
  loading,
  onExport,
}: {
  name: string;
  setName: (name: string) => void;
  loading: boolean;
  onExport: () => void;
}) {
  const { t } = useTranslation();
  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
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
      <Button size="sm" disabled={loading} onClick={onExport}>
        {loading ? <LoaderCircle className="animate-spin" /> : <Download />}
        {t('videoEditor.export')}
      </Button>
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
    <div className="grid min-h-[100dvh] place-items-center bg-[#f5f6f8] p-6 text-zinc-900">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
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
          accept="video/mp4,.mp4"
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
  revealedAssetId,
  exportSettings,
  loading,
  onFiles,
  onAdd,
  onChangeExportSettings,
}: {
  panel: EditorPanel;
  setPanel: (panel: EditorPanel) => void;
  assets: EditorAsset[];
  revealedAssetId: string | null;
  exportSettings: EditorExportSettings;
  loading: boolean;
  onFiles: (files: DroppedFile[]) => void;
  onAdd: (asset: EditorAsset) => void;
  onChangeExportSettings: (settings: EditorExportSettings) => void;
}) {
  const { t } = useTranslation();
  const visibleAssets = assets.filter(({ kind }) =>
    panel === 'media' ? kind === 'video' : kind === 'audio',
  );
  return (
    <aside className="grid min-h-0 grid-cols-[54px_minmax(0,1fr)] border-r border-zinc-200 bg-white">
      <nav className="flex flex-col items-center gap-1 border-r border-zinc-200 py-2">
        {(
          [
            ['media', Film],
            ['audio', Music2],
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
            <FileDropzone
              accept={panel === 'media' ? 'video/mp4,.mp4' : 'audio/*'}
              multiple
              disabled={loading}
              onFiles={onFiles}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center text-xs text-zinc-500 hover:border-blue-400"
            >
              <Upload className="size-5" />
              {t('videoEditor.opencut.dropMedia')}
            </FileDropzone>
            <div className="mt-3 space-y-2">
              {visibleAssets.map((asset) => (
                <ContextMenu key={asset.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      id={`editor-asset-${asset.id}`}
                      className={`flex items-center gap-2 rounded-lg border p-2 ${revealedAssetId === asset.id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-zinc-200'}`}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded bg-zinc-900 text-white">
                        {asset.kind === 'video' ? (
                          <Film className="size-4" />
                        ) : (
                          <Music2 className="size-4" />
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
                      <button
                        title={t('videoEditor.opencut.addToTimeline')}
                        onClick={() => onAdd(asset)}
                        className="grid size-7 shrink-0 place-items-center rounded hover:bg-zinc-100"
                      >
                        <Plus className="size-4" />
                      </button>
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
        ]}
        onChange={(resolution) =>
          onChange({
            ...value,
            resolution: resolution as EditorExportSettings['resolution'],
          })
        }
      />
      <SettingSelect
        label={t('videoEditor.opencut.frameRate')}
        value={String(value.fps)}
        options={[
          ['24', '24 fps'],
          ['30', '30 fps'],
          ['60', '60 fps'],
        ]}
        onChange={(fps) =>
          onChange({
            ...value,
            fps: Number(fps) as EditorExportSettings['fps'],
          })
        }
      />
      <SettingSelect
        label={t('videoEditor.opencut.quality')}
        value={value.quality}
        options={[
          ['compact', t('videoEditor.opencut.qualityCompact')],
          ['balanced', t('videoEditor.opencut.qualityBalanced')],
          ['high', t('videoEditor.opencut.qualityHigh')],
        ]}
        onChange={(quality) =>
          onChange({
            ...value,
            quality: quality as EditorExportSettings['quality'],
          })
        }
      />
      <div className="flex items-center justify-between border-t border-zinc-200 pt-3 text-xs">
        <span className="text-zinc-500">{t('videoEditor.opencut.format')}</span>
        <span className="font-medium">MP4 · H.264</span>
      </div>
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
        <SelectTrigger className="w-full bg-white" size="sm">
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
  videoRef,
  audioRef,
  audioSource,
  playhead,
  duration,
  playing,
  onToggle,
  onRestart,
}: {
  source: PreviewSource | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  audioSource: PreviewSource | null;
  playhead: number;
  duration: number;
  playing: boolean;
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
      className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#eef0f3] p-4"
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950">
            {source ? (
              <video
                ref={videoRef}
                src={source.url}
                muted={Boolean(source.clip.muted)}
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
            {audioSource && (
              <audio
                ref={audioRef}
                src={audioSource.url}
                muted={Boolean(audioSource.clip.muted)}
                onCanPlay={() => {
                  if (playing) void audioRef.current?.play();
                }}
              />
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
        <span className="font-mono">
          <span className="text-blue-500">{formatTimecode(playhead)}</span>
          <span className="mx-2 text-zinc-400">/</span>
          {formatTimecode(duration)}
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
              className="h-8 min-w-20 bg-white"
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

function Inspector({
  clip,
  asset,
  onChange,
}: {
  clip: TimelineClip | null;
  asset: EditorAsset | null;
  onChange: (clip: TimelineClip) => void;
}) {
  const { t } = useTranslation();
  if (!clip || !asset)
    return (
      <aside className="border-l border-zinc-200 bg-white p-4 text-sm text-zinc-400">
        {t('videoEditor.opencut.selectClip')}
      </aside>
    );
  const setNumber = (
    key: 'offset' | 'sourceStart' | 'duration',
    value: number,
  ) => {
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
    <aside className="min-h-0 overflow-y-auto border-l border-zinc-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-400">
        {t('videoEditor.opencut.inspector')}
      </p>
      <h2 className="mt-1 truncate text-sm font-semibold">{asset.name}</h2>
      <div className="mt-5 space-y-4">
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
    </aside>
  );
}

function Timeline({
  assets,
  thumbnails,
  clips,
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
}: {
  assets: EditorAsset[];
  thumbnails: Record<string, TimelineThumbnail[]>;
  clips: TimelineClip[];
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
}) {
  const { t } = useTranslation();
  const pixelsPerSecond = 24 + zoom * 1.5;
  const contentWidth = Math.max(900, duration * pixelsPerSecond + 120);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const seeking = useRef(false);
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
  return (
    <section className="h-64 shrink-0 border-t border-zinc-200 bg-white">
      <div className="flex h-10 items-center justify-between border-b border-zinc-200 px-3">
        <div className="flex items-center gap-1">
          <button
            title={t('videoEditor.opencut.undo')}
            disabled={!canUndo}
            onClick={onUndo}
            className="grid size-7 place-items-center rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            title={t('videoEditor.opencut.redo')}
            disabled={!canRedo}
            onClick={onRedo}
            className="grid size-7 place-items-center rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
          >
            <Redo2 className="size-4" />
          </button>
          <span className="mx-1 h-5 w-px bg-zinc-200" />
          <button
            title={t('videoEditor.opencut.selectTool')}
            aria-pressed={tool === 'select'}
            onClick={() => setTool('select')}
            className={`grid size-7 place-items-center rounded ${tool === 'select' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
          >
            <MousePointer2 className="size-4" />
          </button>
          <button
            title={t('videoEditor.opencut.razorTool')}
            aria-pressed={tool === 'razor'}
            onClick={() => setTool('razor')}
            className={`grid size-7 place-items-center rounded ${tool === 'razor' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
          >
            <Scissors className="size-4" />
          </button>
          <button
            title={t('videoEditor.opencut.deleteClip')}
            disabled={!selectedClipId}
            onClick={() => selectedClipId && onDelete(selectedClipId)}
            className="grid size-7 place-items-center rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
          >
            <Trash2 className="size-4" />
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
      <div className="grid h-[216px] grid-cols-[104px_minmax(0,1fr)]">
        <div className="border-r border-zinc-200 pt-7 text-xs font-medium text-zinc-600">
          <div className="flex h-[72px] items-center gap-2 border-y border-zinc-100 px-3">
            <Film className="size-4 text-blue-500" />
            {t('videoEditor.opencut.videoTrack')}
          </div>
          <div className="flex h-[58px] items-center gap-2 border-b border-zinc-100 px-3">
            <Music2 className="size-4 text-violet-500" />
            {t('videoEditor.opencut.audioTrack')}
          </div>
        </div>
        <div
          className="overflow-x-auto overflow-y-hidden"
          onWheel={(event) => {
            if (event.deltaY === 0) return;
            event.preventDefault();
            setZoom(
              Math.max(0, Math.min(100, zoom - Math.sign(event.deltaY) * 5)),
            );
          }}
        >
          <div
            ref={contentRef}
            className="relative h-full"
            style={{ width: contentWidth }}
          >
            <div
              className="flex h-7 cursor-ew-resize select-none items-end border-b border-zinc-100 text-[10px] text-zinc-400"
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
            {(['video', 'audio'] as const).map((kind, row) => (
              <ContextMenu key={kind}>
                <ContextMenuTrigger asChild>
                  <div
                    className={`relative border-b border-zinc-100 bg-zinc-50/60 ${row === 0 ? 'h-[72px]' : 'h-[58px]'}`}
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
                      event.currentTarget.releasePointerCapture(
                        event.pointerId,
                      );
                    }}
                  >
                    {clips
                      .filter((clip) => clip.kind === kind)
                      .map((clip) => (
                        <TimelineClipView
                          key={clip.id}
                          clip={clip}
                          asset={assets.find(({ id }) => id === clip.assetId)!}
                          thumbnails={thumbnails[clip.assetId] ?? []}
                          pixelsPerSecond={pixelsPerSecond}
                          tool={tool}
                          selected={selectedClipId === clip.id}
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
                      ))}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent
                  className="z-[100] bg-white shadow-xl"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <ContextMenuItem disabled={!canUndo} onSelect={onUndo}>
                    <Undo2 />
                    {t('videoEditor.opencut.undo')}
                  </ContextMenuItem>
                  <ContextMenuItem disabled={!canRedo} onSelect={onRedo}>
                    <Redo2 />
                    {t('videoEditor.opencut.redo')}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onSelect={() => setPlayhead(0)}>
                    {t('videoEditor.opencut.goToStart')}
                  </ContextMenuItem>
                  {selectedClipId && (
                    <>
                      <ContextMenuItem
                        onSelect={() => onSplit(selectedClipId, playhead)}
                      >
                        <Scissors />
                        {t('videoEditor.opencut.split')}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        variant="destructive"
                        onSelect={() => onDelete(selectedClipId)}
                      >
                        <Trash2 />
                        {t('videoEditor.opencut.deleteClip')}
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            ))}
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
  thumbnails,
  pixelsPerSecond,
  tool,
  selected,
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
  thumbnails: TimelineThumbnail[];
  pixelsPerSecond: number;
  tool: TimelineTool;
  selected: boolean;
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
  const drag = useRef<{
    mode: 'move' | 'left' | 'right';
    x: number;
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
    if (event.button !== 0) return;
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
    drag.current = { mode, x: event.clientX, clip, current: clip };
    onSelect();
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = (event.clientX - drag.current.x) / pixelsPerSecond;
    const initial = drag.current.clip;
    let next: TimelineClip;
    if (drag.current.mode === 'move') {
      next = moveTimelineClip(initial, initial.offset + delta);
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
  const finishDrag = () => {
    if (drag.current) onChange(drag.current.current);
    drag.current = null;
    setDraft(null);
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
        className="z-[100] w-64 bg-white shadow-xl"
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

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[1fr_100px] items-center gap-3 text-xs text-zinc-500">
      {label}
      <Input
        type="number"
        min={0}
        step={0.05}
        value={Number(value.toFixed(2))}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 text-right text-zinc-900"
      />
    </label>
  );
}

function createTimelineClip(asset: EditorAsset, offset: number): TimelineClip {
  return {
    id: crypto.randomUUID(),
    assetId: asset.id,
    kind: asset.kind,
    offset,
    sourceStart: 0,
    duration: asset.duration,
  };
}

function findActiveClip(
  clips: TimelineClip[],
  playhead: number,
  kind: TimelineClip['kind'],
): TimelineClip | null {
  return (
    clips
      .filter(
        (clip) =>
          clip.kind === kind &&
          playhead >= clip.offset &&
          playhead < clip.offset + clip.duration,
      )
      .at(-1) ?? null
  );
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

function formatTimecode(value: number): string {
  const safe = Math.max(0, value);
  const frames = Math.floor((safe % 1) * 30);
  return `${formatMediaTime(safe)}:${String(frames).padStart(2, '0')}`;
}
