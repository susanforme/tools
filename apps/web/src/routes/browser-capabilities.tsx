import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  inspectCodecs,
  inspectGpu,
  type CodecRow,
  type GpuReport,
} from '@/lib/browser-capabilities';
import { downloadBlob } from '@/lib/download';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/browser-capabilities')({
  component: BrowserCapabilitiesPage,
});
function BrowserCapabilitiesPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    tab: string;
    width: number;
    height: number;
    rate: number;
    codec: string;
  }>({
    tab: StringParam,
    width: NumberParam,
    height: NumberParam,
    rate: NumberParam,
    codec: StringParam,
  });
  const tab = query.tab === 'codecs' ? 'codecs' : 'gpu';
  const [gpu, setGpu] = useState<GpuReport | null>(null);
  const [codecs, setCodecs] = useState<CodecRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  function clear() {
    epoch.current++;
    setBusy(false);
    setError(null);
    setGpu(null);
    setCodecs(null);
  }
  async function run() {
    clear();
    const version = epoch.current;
    setBusy(true);
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const result = await Promise.race([
        tab === 'gpu'
          ? inspectGpu()
          : inspectCodecs({
              width: query.width ?? 1920,
              height: query.height ?? 1080,
              rate: query.rate ?? 30,
              custom: query.codec ?? '',
            }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('TIMEOUT')), 10000);
        }),
      ]);
      if (epoch.current !== version) return;
      if (Array.isArray(result)) setCodecs(result);
      else setGpu(result);
    } catch (cause) {
      if (version === epoch.current) setError((cause as Error).message);
    } finally {
      if (timer) clearTimeout(timer);
      if (version === epoch.current) setBusy(false);
    }
  }
  const result = gpu ?? codecs;
  const status = (value: boolean | null) =>
    t(
      value === null
        ? 'communityVisual.capabilities.unsupported'
        : value
          ? 'communityVisual.capabilities.supported'
          : 'communityVisual.capabilities.unavailable',
    );
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">
        {t('communityVisual.capabilities.title')}
      </h1>
      <Tabs
        value={tab}
        onValueChange={(tab) => {
          clear();
          setQuery({ tab });
        }}
      >
        <TabsList>
          <TabsTrigger value="gpu">WebGPU</TabsTrigger>
          <TabsTrigger value="codecs">WebCodecs</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="text-sm text-muted-foreground">
        {t(
          tab === 'gpu'
            ? 'communityVisual.capabilities.gpuNote'
            : 'communityVisual.capabilities.note',
        )}
      </p>
      {tab === 'codecs' && (
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['width', 1920],
              ['height', 1080],
              ['rate', 30],
            ] as const
          ).map(([key, fallback]) => (
            <div className="space-y-2" key={key}>
              <Label htmlFor={`codec-${key}`}>
                {t(`communityVisual.capabilities.${key}`)}
              </Label>
              <Input
                id={`codec-${key}`}
                type="number"
                value={query[key] ?? fallback}
                onChange={(e) => {
                  clear();
                  setQuery({ [key]: e.target.valueAsNumber });
                }}
              />
            </div>
          ))}
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="codec-custom">
              {t('communityVisual.capabilities.custom')}
            </Label>
            <Input
              id="codec-custom"
              value={query.codec ?? ''}
              onChange={(e) => {
                clear();
                setQuery({ codec: e.target.value });
              }}
            />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => void run()}>
          {t(
            busy
              ? 'communityVisual.loading'
              : 'communityVisual.capabilities.detect',
          )}
        </Button>
        {result && (
          <Button
            variant="outline"
            onClick={() =>
              downloadBlob(
                new Blob(
                  [
                    JSON.stringify(
                      { detectedAt: new Date().toISOString(), query, result },
                      null,
                      2,
                    ),
                  ],
                  { type: 'application/json' },
                ),
                'capabilities.json',
              )
            }
          >
            {t('communityVisual.download')}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('communityVisual.failed', {
            msg:
              error === 'UNSUPPORTED'
                ? t('communityVisual.capabilities.unsupported')
                : t(`communityVisual.errors.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
      {gpu && (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {(['adapter', 'features', 'limits'] as const).map((key) => (
            <section className="min-w-0 space-y-2" key={key}>
              <h2 className="font-semibold">
                {t(`communityVisual.capabilities.${key}`)}
              </h2>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md border p-3 text-xs">
                {JSON.stringify(gpu[key], null, 2)}
              </pre>
            </section>
          ))}
        </div>
      )}
      {codecs && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('communityVisual.capabilities.codec')}</TableHead>
              <TableHead>{t('communityVisual.capabilities.encode')}</TableHead>
              <TableHead>{t('communityVisual.capabilities.decode')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codecs.map((row) => (
              <TableRow key={row.codec}>
                <TableCell className="break-all font-mono">
                  {row.codec}
                </TableCell>
                <TableCell>{status(row.encode)}</TableCell>
                <TableCell>{status(row.decode)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
