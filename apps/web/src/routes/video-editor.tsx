import { FileDropzone } from '@/components/file-dropzone';
import { MediaResult } from '@/components/media-result';
import { StreamingManifestPanel } from '@/components/tool-expansion-panels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  MAX_MEDIA_FILE_SIZE,
  formatMediaBytes,
  formatMediaTime,
  readStoredMedia,
  runMediaWorker,
  type MediaInfo,
} from '@/lib/media-tools';
import { createFileRoute } from '@tanstack/react-router';
import {
  AudioLines,
  ImageIcon,
  Layers,
  LoaderCircle,
  UploadCloud,
  Video,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/video-editor')({
  component: VideoEditorPage,
});

type VideoTab =
  | 'transform'
  | 'merge'
  | 'audio'
  | 'thumbnail'
  | 'info'
  | 'manifest';
type AudioAction = 'extract' | 'replace';
type Rotation = '0' | '90' | '180' | '270';
type Aspect = 'original' | '16:9' | '9:16' | '1:1';
type Result = { url: string; fileName: string; mimeType: string; size: number };

function VideoEditorPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<VideoTab>(
    'tab',
    StringParam,
    'transform',
  );
  const [rotation, setRotation] = useQueryParam<Rotation>(
    'rotation',
    StringParam,
    '0',
  );
  const [aspect, setAspect] = useQueryParam<Aspect>(
    'aspect',
    StringParam,
    'original',
  );
  const [audioAction, setAudioAction] = useQueryParam<AudioAction>(
    'audio',
    StringParam,
    'extract',
  );
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [replacementAudio, setReplacementAudio] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const sourceRef = useRef<string | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [timestamp, setTimestamp] = useState(0);
  const [mute, setMute] = useState(false);
  const [clearMetadata, setClearMetadata] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void runMediaWorker({ type: 'cleanup' }).catch(() => undefined);
    return () => {
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    };
  }, []);

  const clearResult = () => {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    resultRef.current = null;
    setResult(null);
  };

  const selectVideo = async (nextFile: File) => {
    setError(null);
    clearResult();
    if (nextFile.size > MAX_MEDIA_FILE_SIZE) {
      setError(t('mediaTools.tooLarge'));
      return;
    }
    setLoading(true);
    try {
      const response = await runMediaWorker({
        type: 'inspect',
        file: nextFile,
      });
      if (response.type !== 'inspected') throw new Error('INSPECT_FAILED');
      if (
        tab !== 'info' &&
        !response.info.tracks.some((track) => track.type === 'video')
      ) {
        throw new Error('VIDEO_REQUIRED');
      }
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current);
      const url = URL.createObjectURL(nextFile);
      sourceRef.current = url;
      setFile(nextFile);
      setSourceUrl(url);
      setInfo(response.info);
      setTimestamp(Math.min(response.info.duration / 2, 5));
    } catch {
      setError(t('mediaTools.unsupportedVideo'));
    } finally {
      setLoading(false);
    }
  };

  const acceptVideos = (nextFiles: File[]) => {
    if (nextFiles.some((nextFile) => nextFile.size > MAX_MEDIA_FILE_SIZE)) {
      setError(t('mediaTools.tooLarge'));
      return;
    }
    setFiles(nextFiles);
    setError(null);
    clearResult();
  };

  const publishResponse = async (
    response: Awaited<ReturnType<typeof runMediaWorker>>,
  ) => {
    clearResult();
    if (response.type === 'stored') {
      const output = await readStoredMedia(response.result.fileName);
      const next = {
        ...response.result,
        url: URL.createObjectURL(output),
      };
      resultRef.current = next;
      setResult(next);
      return;
    }
    if (response.type === 'blob') {
      const next = {
        fileName: response.fileName,
        mimeType: response.blob.type,
        size: response.blob.size,
        url: URL.createObjectURL(response.blob),
      };
      resultRef.current = next;
      setResult(next);
      return;
    }
    throw new Error('INVALID_RESPONSE');
  };

  const execute = async () => {
    setError(null);
    setLoading(true);
    setProgress(0);
    try {
      let response: Awaited<ReturnType<typeof runMediaWorker>>;
      if (tab === 'merge') {
        if (files.length < 2) throw new Error('FILES_REQUIRED');
        response = await runMediaWorker(
          { type: 'merge-video', files },
          setProgress,
        );
      } else {
        if (!file) throw new Error('FILE_REQUIRED');
        if (tab === 'audio') {
          response =
            audioAction === 'extract'
              ? await runMediaWorker(
                  { type: 'extract-audio', file },
                  setProgress,
                )
              : await runMediaWorker(
                  {
                    type: 'replace-audio',
                    video: file,
                    audio:
                      replacementAudio ??
                      (() => {
                        throw new Error('AUDIO_REQUIRED');
                      })(),
                  },
                  setProgress,
                );
        } else if (tab === 'thumbnail') {
          response = await runMediaWorker({
            type: 'thumbnail',
            file,
            timestamp,
          });
        } else {
          response = await runMediaWorker(
            {
              type: 'video-transform',
              file,
              rotation: Number(rotation) as 0 | 90 | 180 | 270,
              aspect,
              mute,
              clearMetadata,
            },
            setProgress,
          );
        }
      }
      await publishResponse(response);
      setProgress(1);
    } catch {
      setError(t('mediaTools.processError'));
    } finally {
      setLoading(false);
    }
  };

  const needsSingleVideo = tab !== 'merge' && tab !== 'manifest';
  const sourceIsVideo = info?.tracks.some((track) => track.type === 'video');

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Video className="size-6 text-red-500" />
        {t('videoEditor.title')}
      </h1>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const nextTab = value as VideoTab;
          setTab(nextTab);
          if (nextTab !== 'info' && file && !sourceIsVideo) {
            if (sourceRef.current) URL.revokeObjectURL(sourceRef.current);
            sourceRef.current = null;
            setSourceUrl(null);
            setFile(null);
            setInfo(null);
          }
        }}
      >
        <TabsList className="h-auto flex-wrap">
          {(
            [
              'transform',
              'merge',
              'audio',
              'thumbnail',
              'info',
              'manifest',
            ] as const
          ).map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`videoEditor.tabs.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {tab === 'manifest' && <StreamingManifestPanel />}

      {needsSingleVideo && !file && (
        <FileDropzone
          accept={tab === 'info' ? 'video/*,audio/*' : 'video/*'}
          disabled={loading}
          onFiles={(selected) => {
            const next = selected[0]?.file;
            if (next) void selectVideo(next);
          }}
          className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl bg-muted/20 p-8 text-center"
        >
          {loading ? (
            <LoaderCircle className="size-10 animate-spin text-red-500" />
          ) : (
            <UploadCloud className="size-10 text-red-500" />
          )}
          <span className="font-medium">
            {t(
              tab === 'info'
                ? 'videoEditor.selectMedia'
                : 'videoEditor.selectVideo',
            )}
          </span>
        </FileDropzone>
      )}

      {tab === 'merge' && (
        <Card>
          <CardContent className="space-y-4">
            <FileDropzone
              accept="video/*"
              multiple
              disabled={loading}
              onFiles={(selected) =>
                acceptVideos(selected.map((item) => item.file))
              }
              className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl p-6 text-center"
            >
              <Layers className="size-9 text-red-500" />
              <span className="font-medium">
                {t('videoEditor.selectVideos')}
              </span>
            </FileDropzone>
            {files.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="truncate">
                  {index + 1}. {item.name}
                </span>
                <span className="text-muted-foreground">
                  {formatMediaBytes(item.size)}
                </span>
              </div>
            ))}
            <Button disabled={loading || files.length < 2} onClick={execute}>
              {loading && <LoaderCircle className="animate-spin" />}
              {t('videoEditor.merge')}
            </Button>
          </CardContent>
        </Card>
      )}

      {file && tab !== 'merge' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="break-all text-lg">{file.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {sourceIsVideo ? (
                <video
                  src={sourceUrl ?? ''}
                  controls
                  className="max-h-[460px] w-full rounded-xl bg-black"
                />
              ) : (
                <audio src={sourceUrl ?? ''} controls className="w-full" />
              )}

              {tab === 'transform' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('videoEditor.rotation')}</Label>
                    <Select
                      value={rotation}
                      onValueChange={(value) => setRotation(value as Rotation)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['0', '90', '180', '270'] as const).map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}°
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('videoEditor.aspect')}</Label>
                    <Select
                      value={aspect}
                      onValueChange={(value) => setAspect(value as Aspect)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['original', '16:9', '9:16', '1:1'] as const).map(
                          (value) => (
                            <SelectItem key={value} value={value}>
                              {value === 'original'
                                ? t('videoEditor.original')
                                : value}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={mute}
                      onCheckedChange={(value) => setMute(value === true)}
                    />
                    {t('videoEditor.mute')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={clearMetadata}
                      onCheckedChange={(value) =>
                        setClearMetadata(value === true)
                      }
                    />
                    {t('videoEditor.clearMetadata')}
                  </label>
                  <Button
                    disabled={loading}
                    onClick={execute}
                    className="sm:col-span-2 sm:w-fit"
                  >
                    {loading && <LoaderCircle className="animate-spin" />}
                    {t('mediaTools.process')}
                  </Button>
                </div>
              )}

              {tab === 'audio' && (
                <div className="space-y-4">
                  <Select
                    value={audioAction}
                    onValueChange={(value) =>
                      setAudioAction(value as AudioAction)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="extract">
                        {t('videoEditor.extractAudio')}
                      </SelectItem>
                      <SelectItem value="replace">
                        {t('videoEditor.replaceAudio')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {audioAction === 'replace' && (
                    <FileDropzone
                      accept="audio/*"
                      onFiles={(selected) =>
                        setReplacementAudio(selected[0]?.file ?? null)
                      }
                      className="flex min-h-32 items-center justify-center gap-2 rounded-xl p-4"
                    >
                      <AudioLines className="size-5" />
                      {replacementAudio?.name ?? t('videoEditor.selectAudio')}
                    </FileDropzone>
                  )}
                  <Button
                    disabled={
                      loading ||
                      (audioAction === 'replace' && !replacementAudio)
                    }
                    onClick={execute}
                  >
                    {loading && <LoaderCircle className="animate-spin" />}
                    {t('mediaTools.process')}
                  </Button>
                </div>
              )}

              {tab === 'thumbnail' && info && (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-2">
                    <Label>{t('videoEditor.timestamp')}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={info.duration}
                      step="0.1"
                      value={timestamp}
                      onChange={(event) =>
                        setTimestamp(
                          Math.max(
                            0,
                            Math.min(info.duration, Number(event.target.value)),
                          ),
                        )
                      }
                    />
                  </div>
                  <Button disabled={loading} onClick={execute}>
                    <ImageIcon />
                    {t('videoEditor.capture')}
                  </Button>
                </div>
              )}

              {tab === 'info' && info && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <InfoItem
                      label={t('mediaTools.duration')}
                      value={formatMediaTime(info.duration)}
                    />
                    <InfoItem
                      label={t('mediaTools.format')}
                      value={info.mimeType}
                    />
                    <InfoItem
                      label={t('mediaTools.tracks')}
                      value={String(info.tracks.length)}
                    />
                  </div>
                  {info.tracks.map((track, index) => (
                    <div key={index} className="rounded-lg border p-4 text-sm">
                      <p className="font-medium">
                        {track.type.toUpperCase()} · {track.codec}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {track.width && track.height
                          ? `${track.width}×${track.height} · `
                          : ''}
                        {track.frameRate
                          ? `${track.frameRate.toFixed(2)} FPS · `
                          : ''}
                        {track.sampleRate ? `${track.sampleRate} Hz · ` : ''}
                        {track.channels ? `${track.channels} ch · ` : ''}
                        {track.bitrate
                          ? `${Math.round(track.bitrate / 1000)} kbps`
                          : ''}
                      </p>
                    </div>
                  ))}
                  {info.tags.length > 0 && (
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      {info.tags.map((tag) => (
                        <div
                          key={`${tag.key}-${tag.value}`}
                          className="rounded-md border px-3 py-2"
                        >
                          <span className="text-muted-foreground">
                            {tag.key}:{' '}
                          </span>
                          {tag.value}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {loading && progress > 0 && (
        <progress
          className="h-2 w-full accent-red-500"
          max={1}
          value={progress}
        />
      )}
      {result && <MediaResult {...result} />}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-medium">{value}</p>
    </div>
  );
}
