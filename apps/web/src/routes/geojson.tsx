import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropzone } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  GEO_MAX_BYTES,
  GEO_SAMPLE,
  type GeoProperties,
  type GeoResult,
} from '@/lib/geojson-tool';

export const Route = createFileRoute('/geojson')({ component: GeoJsonPage });
const GeoJsonMap = lazy(() => import('../components/geojson-map'));
const createWorker = (): Worker =>
  new Worker(new URL('../workers/geojson-tool.worker.ts', import.meta.url), {
    type: 'module',
  });

function GeoJsonPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParam<string>('q', StringParam, '');
  const [input, setInput] = useState('');
  const [result, setResult] = useState<GeoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [properties, setProperties] = useState('');
  const [saved, setSaved] = useState(false);
  const [page, setPage] = useState(0);
  const version = useRef(0);
  const task = useBoundedWorker<{ input: string }, GeoResult>(
    createWorker,
    15000,
  );
  useEffect(() => {
    setResult(task.result);
  }, [task.result]);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  useEffect(() => {
    setPage(0);
  }, [query, result]);
  function edit(value: string) {
    version.current++;
    task.clear();
    setResult(null);
    setError(null);
    setSelected(null);
    setSaved(false);
    setInput(value);
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    edit('');
    const current = version.current;
    try {
      if (file.size > GEO_MAX_BYTES) throw new Error('SIZE');
      const text = await file.text();
      if (current === version.current) edit(text);
    } catch (cause) {
      if (current === version.current) setError((cause as Error).message);
    }
  }
  const rows =
    result?.collection.features
      .map((feature, index) => ({ feature, index }))
      .filter(({ feature }) =>
        JSON.stringify(feature.properties)
          .toLowerCase()
          .includes(query.toLowerCase()),
      ) ?? [];
  const pages = Math.max(1, Math.ceil(rows.length / 40));
  const currentPage = Math.min(page, pages - 1);
  const message = error ?? task.error;
  function saveProperties() {
    if (!result || selected === null) return;
    try {
      const value: unknown = JSON.parse(properties);
      if (value !== null && (typeof value !== 'object' || Array.isArray(value)))
        throw new Error('PROPERTIES');
      const collection = {
        ...result.collection,
        features: result.collection.features.map((feature, index) =>
          index === selected
            ? { ...feature, properties: value as GeoProperties }
            : feature,
        ),
      };
      const text = JSON.stringify(collection, null, 2);
      if (new TextEncoder().encode(text).length > GEO_MAX_BYTES)
        throw new Error('SIZE');
      setResult({ ...result, collection });
      setInput(text);
      setError(null);
      setSaved(true);
    } catch (cause) {
      setSaved(false);
      setError((cause as Error).message);
    }
  }
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('geojson.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('geojson.limits')}</p>
      <FileDropzone
        accept=".geojson,.json,application/geo+json,application/json"
        onFiles={(files) => void upload(files[0]?.file)}
        className="block rounded-lg p-4 text-center"
      >
        {t('geojson.upload')}
      </FileDropzone>
      <Label htmlFor="geojson-input">{t('geojson.input')}</Label>
      <Textarea
        id="geojson-input"
        className="h-64 font-mono text-xs"
        value={input}
        onChange={(event) => edit(event.target.value)}
        spellCheck={false}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={task.busy || !input.trim()}
          onClick={() => {
            setError(null);
            setSelected(null);
            setResult(null);
            task.run({ input });
          }}
        >
          {t('geojson.run')}
        </Button>
        {task.busy && (
          <Button variant="outline" onClick={task.cancel}>
            {t('geojson.cancel')}
          </Button>
        )}
        <Button variant="outline" onClick={() => edit(GEO_SAMPLE)}>
          {t('geojson.sample')}
        </Button>
        <Button variant="outline" onClick={() => edit('')}>
          {t('geojson.clear')}
        </Button>
        {result && (
          <Button
            variant="outline"
            onClick={() =>
              downloadBlob(
                new Blob([JSON.stringify(result.collection, null, 2)], {
                  type: 'application/geo+json',
                }),
                'data.geojson',
              )
            }
          >
            {t('geojson.download')}
          </Button>
        )}
      </div>
      {task.busy && <p role="status">{t('geojson.loading')}</p>}
      {message && (
        <p role="alert" className="break-all text-destructive">
          {t('geojson.failed', {
            message: t(`geojson.errors.${message}`, { defaultValue: message }),
          })}
        </p>
      )}
      {result && (
        <>
          <dl className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {[
              ['features', result.collection.features.length],
              ['coordinates', result.positions],
              ['area', result.area.toFixed(2)],
              ['length', result.length.toFixed(3)],
            ].map(([key, value]) => (
              <div key={key} className="rounded-lg border p-3">
                <dt className="text-sm text-muted-foreground">
                  {t(`geojson.${key}`)}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="break-all font-mono text-sm">
            {t('geojson.bounds')}:{' '}
            {result.bounds?.map((n) => n.toFixed(6)).join(', ') ?? '—'}
          </p>
          <p className="text-sm text-muted-foreground">{t('geojson.note')}</p>
          <Suspense fallback={<p role="status">{t('geojson.loading')}</p>}>
            <GeoJsonMap collection={result.collection} />
          </Suspense>
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            <section className="min-w-0 space-y-3">
              <Label htmlFor="geojson-search">{t('geojson.search')}</Label>
              <Input
                id="geojson-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="max-h-80 space-y-2 overflow-auto">
                {rows
                  .slice(currentPage * 40, (currentPage + 1) * 40)
                  .map(({ feature, index }) => (
                    <Button
                      key={index}
                      variant={selected === index ? 'secondary' : 'outline'}
                      className="h-auto w-full justify-start whitespace-normal break-all text-left"
                      onClick={() => {
                        setSelected(index);
                        setProperties(
                          JSON.stringify(feature.properties, null, 2),
                        );
                        setSaved(false);
                        setError(null);
                      }}
                    >
                      {index + 1}.{' '}
                      {String(
                        feature.properties?.name ??
                          feature.id ??
                          feature.geometry?.type ??
                          t('geojson.nullGeometry'),
                      )}
                    </Button>
                  ))}
                {!rows.length && <p>{t('geojson.empty')}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  {t('geojson.previous')}
                </Button>
                <span>
                  {t('geojson.page', { page: currentPage + 1, pages })}
                </span>
                <Button
                  variant="outline"
                  disabled={currentPage + 1 >= pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {t('geojson.next')}
                </Button>
              </div>
            </section>
            {selected !== null && (
              <section className="min-w-0 space-y-3">
                <Label htmlFor="geojson-properties">
                  {t('geojson.properties')}
                </Label>
                <Textarea
                  id="geojson-properties"
                  className="h-64 font-mono text-xs"
                  value={properties}
                  onChange={(event) => {
                    setProperties(event.target.value);
                    setSaved(false);
                  }}
                />
                <Button onClick={saveProperties}>{t('geojson.save')}</Button>
                {saved && <p role="status">{t('geojson.saved')}</p>}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
