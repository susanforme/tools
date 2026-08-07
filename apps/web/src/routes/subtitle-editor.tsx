import { FileDropzone } from '@/components/file-dropzone';
import { MediaResult } from '@/components/media-result';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  MAX_MEDIA_FILE_SIZE,
  readStoredMedia,
  runMediaWorker,
} from '@/lib/media-tools';
import {
  detectSubtitleFormat,
  parseSubtitles,
  serializeSubtitles,
  type SubtitleFormat,
} from '@/lib/subtitles';
import { createFileRoute } from '@tanstack/react-router';
import { Captions, LoaderCircle, UploadCloud, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/subtitle-editor')({
  component: SubtitleEditorPage,
});

type SubtitleTab = 'convert' | 'burn';
type Result = { url: string; fileName: string; mimeType: string; size: number };

function SubtitleEditorPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<SubtitleTab>(
    'tab',
    StringParam,
    'convert',
  );
  const [format, setFormat] = useQueryParam<SubtitleFormat>(
    'format',
    StringParam,
    'vtt',
  );
  const [text, setText] = useState('');
  const [video, setVideo] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void runMediaWorker({ type: 'cleanup' }).catch(() => undefined);
    return () => {
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    };
  }, []);

  const publishResult = (next: Result) => {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    resultRef.current = next;
    setResult(next);
  };

  const selectSubtitle = async (file: File) => {
    try {
      const content = await file.text();
      setText(content);
      setFormat(detectSubtitleFormat(content) === 'srt' ? 'vtt' : 'srt');
      setError(null);
    } catch {
      setError(t('subtitleEditor.invalid'));
    }
  };

  const convert = () => {
    setError(null);
    try {
      const content = serializeSubtitles(parseSubtitles(text), format);
      setText(content);
      const blob = new Blob([content], {
        type: format === 'vtt' ? 'text/vtt' : 'application/x-subrip',
      });
      publishResult({
        fileName: `subtitles.${format}`,
        mimeType: blob.type,
        size: blob.size,
        url: URL.createObjectURL(blob),
      });
    } catch {
      setError(t('subtitleEditor.invalid'));
    }
  };

  const burn = async () => {
    if (!video) return;
    setLoading(true);
    setProgress(0);
    setError(null);
    try {
      const response = await runMediaWorker(
        { type: 'burn-subtitles', file: video, cues: parseSubtitles(text) },
        setProgress,
      );
      if (response.type !== 'stored') throw new Error('INVALID_RESPONSE');
      const output = await readStoredMedia(response.result.fileName);
      publishResult({
        ...response.result,
        url: URL.createObjectURL(output),
      });
    } catch {
      setError(t('subtitleEditor.burnError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Captions className="size-6 text-sky-500" />
        {t('subtitleEditor.title')}
      </h1>
      <Tabs value={tab} onValueChange={(value) => setTab(value as SubtitleTab)}>
        <TabsList>
          <TabsTrigger value="convert">
            {t('subtitleEditor.convert')}
          </TabsTrigger>
          <TabsTrigger value="burn">{t('subtitleEditor.burn')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('subtitleEditor.placeholder')}
          className="min-h-[480px] resize-y font-mono"
        />
        <div className="space-y-4">
          <FileDropzone
            accept=".srt,.vtt,text/vtt,application/x-subrip"
            onFiles={(files) => {
              const file = files[0]?.file;
              if (file) void selectSubtitle(file);
            }}
            className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl p-4 text-center"
          >
            <UploadCloud className="size-6 text-sky-500" />
            <span className="text-sm font-medium">
              {t('subtitleEditor.select')}
            </span>
          </FileDropzone>
          {tab === 'convert' ? (
            <Card>
              <CardContent className="space-y-4">
                <Select
                  value={format}
                  onValueChange={(value) => setFormat(value as SubtitleFormat)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="srt">SRT</SelectItem>
                    <SelectItem value="vtt">WebVTT</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  disabled={!text.trim()}
                  onClick={convert}
                  className="w-full"
                >
                  {t('subtitleEditor.convert')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-4">
                <FileDropzone
                  accept="video/*"
                  disabled={loading}
                  onFiles={(files) => {
                    const file = files[0]?.file;
                    if (!file) return;
                    if (file.size > MAX_MEDIA_FILE_SIZE) {
                      setError(t('mediaTools.tooLarge'));
                      return;
                    }
                    setVideo(file);
                  }}
                  className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl p-4 text-center"
                >
                  <Video className="size-6 text-sky-500" />
                  <span className="break-all text-sm font-medium">
                    {video?.name ?? t('subtitleEditor.selectVideo')}
                  </span>
                </FileDropzone>
                <Button
                  disabled={loading || !video || !text.trim()}
                  onClick={burn}
                  className="w-full"
                >
                  {loading && <LoaderCircle className="animate-spin" />}
                  {t('subtitleEditor.burn')}
                </Button>
                {loading && (
                  <progress
                    className="h-2 w-full accent-sky-500"
                    max={1}
                    value={progress}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {result && <MediaResult {...result} />}
    </div>
  );
}
