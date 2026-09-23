import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrayParam,
  NumberParam,
  useQueryParams,
  withDefault,
} from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import type { PhotoBatchRequest } from '@/lib/batch4-organizer-photo';
import { downloadBytes } from '@/lib/download';
import { OrganizerInput } from './organizer-store';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
const createWorker = () =>
  new Worker(
    new URL('../workers/batch4-organizer-photo.worker.ts', import.meta.url),
    { type: 'module' },
  );
export function PhotoMetadataEditor() {
  const { t } = useTranslation();
  const tr = (k: string) => t(`batch4Organizers.${k}`);
  const [query, setQuery] = useQueryParams<{
    minutes: number;
    remove: string[];
  }>({
    minutes: withDefault<number>(NumberParam, 0),
    remove: withDefault<string[]>(ArrayParam, []),
  });
  const remove = query.remove ?? [];
  const [author, setAuthor] = useState(''),
    [copyright, setCopyright] = useState(''),
    [description, setDescription] = useState(''),
    [keywords, setKeywords] = useState('');
  const [files, setFiles] = useState<File[]>([]),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(false);
  const version = useRef(0);
  const task = useBoundedWorker<
    PhotoBatchRequest,
    { zip: Uint8Array; names: string[] }
  >(createWorker, 20000);
  useEffect(() => {
    version.current++;
    setLoading(false);
    task.clear();
  }, [
    files,
    query.minutes,
    JSON.stringify(query.remove),
    author,
    copyright,
    description,
    keywords,
    task.clear,
  ]);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  async function run() {
    const current = ++version.current;
    setError(null);
    setLoading(true);
    task.clear();
    try {
      if (
        !files.length ||
        files.length > 50 ||
        files.some((f) => f.size > 20 * 1024 * 1024) ||
        files.reduce((s, f) => s + f.size, 0) > 100 * 1024 * 1024
      )
        throw Error('photoSize');
      const input = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          data: new Uint8Array(await f.arrayBuffer()),
        })),
      );
      if (current === version.current)
        task.run({
          files: input,
          options: {
            minutes: query.minutes ?? 0,
            remove,
            author,
            copyright,
            description,
            keywords,
          },
        });
    } catch (cause) {
      if (current === version.current) setError((cause as Error).message);
    } finally {
      if (current === version.current) setLoading(false);
    }
  }
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">{tr('photo.hint')}</p>
      <OrganizerInput
        label={tr('photo.upload')}
        type="file"
        accept=".jpg,.jpeg,image/jpeg"
        multiple
        onChange={(e) => {
          setFiles(Array.from(e.target.files ?? []));
          setError(null);
        }}
      />
      <p className="break-words text-sm">
        {files.map((f) => f.name).join(' · ')}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <OrganizerInput
          label={tr('photo.offset')}
          type="number"
          min={-5256000}
          max={5256000}
          value={query.minutes}
          onChange={(e) => setQuery({ minutes: Number(e.target.value) })}
        />
        {[
          ['author', author, setAuthor],
          ['copyright', copyright, setCopyright],
          ['description', description, setDescription],
          ['keywords', keywords, setKeywords],
        ].map(([key, value, set]) => (
          <OrganizerInput
            key={key as string}
            label={tr(`photo.${key as string}`)}
            value={value as string}
            maxLength={2000}
            onChange={(e) => (set as (v: string) => void)(e.target.value)}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{tr('photo.blank')}</p>
      <fieldset className="space-y-3">
        <legend className="mb-3 font-medium">{tr('photo.remove')}</legend>
        <div className="flex flex-wrap gap-4">
          {[
            'gps',
            'date',
            'author',
            'copyright',
            'description',
            'keywords',
            'device',
          ].map((key) => (
            <Label key={key} className="flex items-center gap-2">
              <Checkbox
                checked={remove.includes(key)}
                onCheckedChange={(v) =>
                  setQuery({
                    remove: v
                      ? [...remove, key]
                      : remove.filter((k) => k !== key),
                  })
                }
              />
              {tr(`photo.${key}`)}
            </Label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-3">
        <Button
          disabled={loading || task.busy || !files.length}
          onClick={() => void run()}
        >
          {tr('photo.process')}
        </Button>
        {task.busy && (
          <Button variant="outline" onClick={task.cancel}>
            {tr('cancel')}
          </Button>
        )}
      </div>
      {(error || task.error) && (
        <p role="alert" className="text-destructive">
          {t(`batch4Organizers.${error ?? task.error!}`, {
            defaultValue: tr('processError'),
          })}
        </p>
      )}
      {task.result && (
        <div className="space-y-2">
          <p>
            {tr('photo.done')}: {task.result.names.length}
          </p>
          <Button
            onClick={() =>
              downloadBytes(
                task.result!.zip,
                'edited-photos.zip',
                'application/zip',
              )
            }
          >
            {tr('photo.download')}
          </Button>
        </div>
      )}
    </section>
  );
}
