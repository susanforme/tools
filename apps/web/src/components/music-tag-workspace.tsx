import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import type {
  TagsRequest,
  TagsResponse,
  TaggedFile,
} from '@/lib/music-tags.worker';
import type { MusicTags, TagEdit } from '@/lib/music-tags';
import { downloadBytes } from '@/lib/download';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PracticalText } from './practical-ui';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ChoiceField } from './calculator-ui';
const worker = () =>
  new Worker(new URL('../lib/music-tags.worker.ts', import.meta.url), {
    type: 'module',
  });
function Cover({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url ? <img src={url} alt="" className="size-16 object-cover" /> : null;
}
export default function MusicTagEditor() {
  const { t } = useTranslation(),
    label = (key: string) => t(`mediaWorkspace.${key}`);
  const [files, setFiles] = useState<File[]>([]),
    [metadata, setMetadata] = useState<TaggedFile[]>([]),
    [enabled, setEnabled] = useState<string[]>([]),
    [values, setValues] = useState<MusicTags>({
      title: '',
      artist: '',
      album: '',
      track: '',
    }),
    [coverMode, setCoverMode] = useState('keep'),
    [cover, setCover] = useState<File | null>(null),
    [error, setError] = useState<string | null>(null);
  const [pattern, setPattern] = useQueryParam<string>(
    'filename',
    StringParam,
    '{artist} - {title}',
  );
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  const read = useBoundedWorker<TagsRequest, TagsResponse>(worker, 30000),
    write = useBoundedWorker<TagsRequest, TagsResponse>(worker, 60000);
  useEffect(() => {
    if (read.result && 'files' in read.result) setMetadata(read.result.files);
  }, [read.result]);
  useEffect(() => {
    revision.current++;
    write.clear();
  }, [files, enabled, values, coverMode, cover, pattern, write.clear]);
  async function generate() {
    const id = ++revision.current;
    setError(null);
    try {
      const edit: TagEdit = {};
      for (const key of enabled as (keyof MusicTags)[]) edit[key] = values[key];
      if (coverMode === 'remove') edit.cover = null;
      if (coverMode === 'replace') {
        if (!cover || cover.size > 5_000_000) throw new Error('coverLimit');
        edit.cover = new Uint8Array(await cover.arrayBuffer());
      }
      if (id !== revision.current) return;
      write.run({
        type: 'write',
        files,
        tags: metadata.map((m) => m.tags),
        edit,
        pattern,
      });
    } catch (e) {
      if (id === revision.current) setError((e as Error).message);
    }
  }
  return (
    <div className="space-y-4">
      <Label htmlFor="music-tag-files">{label('mp3Files')}</Label>
      <Input
        id="music-tag-files"
        type="file"
        accept=".mp3,audio/mpeg"
        multiple
        disabled={read.busy || write.busy}
        onChange={(e) => {
          const next = Array.from(e.target.files ?? []);
          setFiles(next);
          setMetadata([]);
          setError(null);
          if (next.length) read.run({ type: 'read', files: next });
          e.target.value = '';
        }}
      />
      <p className="text-sm text-muted-foreground">{label('tagHint')}</p>
      <fieldset
        className="min-w-0 space-y-4"
        disabled={write.busy || read.busy}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {(['title', 'artist', 'album', 'track'] as const).map((key) => (
            <div key={key} className="space-y-2">
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={enabled.includes(key)}
                  onCheckedChange={(checked) =>
                    setEnabled(
                      checked
                        ? [...enabled, key]
                        : enabled.filter((k) => k !== key),
                    )
                  }
                />
                {label(`tags.${key}`)}
              </Label>
              <Input
                aria-label={label(`tags.${key}`)}
                disabled={!enabled.includes(key)}
                maxLength={1000}
                value={values[key]}
                onChange={(e) =>
                  setValues({ ...values, [key]: e.target.value })
                }
              />
            </div>
          ))}
        </div>
        <ChoiceField
          label={label('cover')}
          value={coverMode}
          options={['keep', 'replace', 'remove'].map((value) => ({
            value,
            label: label(value),
          }))}
          onChange={setCoverMode}
        />
        {coverMode === 'replace' && (
          <Input
            aria-label={label('cover')}
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          />
        )}
        <PracticalText
          label={label('filename')}
          value={pattern}
          onChange={setPattern}
        />
        <p className="text-sm text-muted-foreground">
          {'{artist} · {title} · {album} · {track}'}
        </p>
      </fieldset>
      <div className="space-y-2">
        {metadata.map((item, i) => (
          <div key={i} className="flex gap-3 rounded border p-3">
            {item.cover && <Cover blob={item.cover} />}
            <div className="min-w-0 text-sm">
              <p className="break-all font-medium">{item.name}</p>
              <p className="break-all">
                {item.tags.artist} · {item.tags.title}
              </p>
              <p>
                {item.tags.album} · {item.tags.track}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          disabled={read.busy || write.busy || !metadata.length}
          onClick={() => void generate()}
        >
          {label('exportZip')}
        </Button>
        {(read.busy || write.busy) && (
          <Button
            variant="outline"
            onClick={() => {
              read.cancel();
              write.cancel();
            }}
          >
            {label('cancel')}
          </Button>
        )}
        {write.result && 'zip' in write.result && (
          <Button
            onClick={() => {
              if (write.result && 'zip' in write.result)
                downloadBytes(
                  write.result.zip,
                  'tagged-music.zip',
                  'application/zip',
                );
            }}
          >
            {label('download')}
          </Button>
        )}
      </div>
      {(read.busy || write.busy) && <p role="status">{label('processing')}</p>}
      {(error || read.error || write.error) && (
        <p role="alert" className="text-destructive">
          {t('mediaWorkspace.failed', {
            msg: t(`mediaWorkspace.errors.${error || read.error || write.error}`, {
              defaultValue: error || read.error || write.error || '',
            }),
          })}
        </p>
      )}
    </div>
  );
}
