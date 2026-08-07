import { FileDropzone } from '@/components/file-dropzone';
import { MonacoTextEditor } from '@/components/monaco-editor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { parseHar, type HarAnalysis, type HarEntry } from '@/lib/har';
import { createFileRoute } from '@tanstack/react-router';
import {
  AlertTriangle,
  FileSearch,
  Globe,
  HardDrive,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

export const Route = createFileRoute('/har-analyzer')({
  component: HarAnalyzerPage,
});

type View = 'waterfall' | 'failures' | 'slow' | 'size' | 'domains';

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

function HarAnalyzerPage() {
  const { t } = useTranslation();
  const [view, setView] = useQueryParam<View>('view', StringParam, 'waterfall');
  const [analysis, setAnalysis] = useState<HarAnalysis | null>(null);
  const [selected, setSelected] = useState<HarEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entries = useMemo(() => {
    if (!analysis) return [];
    if (view === 'failures')
      return analysis.entries.filter(
        (entry) => entry.status === 0 || entry.status >= 400,
      );
    if (view === 'slow')
      return [...analysis.entries].sort((a, b) => b.duration - a.duration);
    if (view === 'size')
      return [...analysis.entries].sort((a, b) => b.size - a.size);
    return analysis.entries;
  }, [analysis, view]);

  async function load(file: File) {
    setError(null);
    try {
      const next = parseHar(await file.text());
      setAnalysis(next);
      setSelected(next.entries[0] ?? null);
    } catch (cause) {
      setError(t('harAnalyzer.failed', { msg: (cause as Error).message }));
    }
  }

  const span = analysis
    ? Math.max(analysis.endedAt - analysis.startedAt, 1)
    : 1;
  const metrics: Array<[LucideIcon, string, string]> = analysis
    ? [
        [Timer, t('harAnalyzer.requests'), String(analysis.entries.length)],
        [AlertTriangle, t('harAnalyzer.failures'), String(analysis.failures)],
        [HardDrive, t('harAnalyzer.transfer'), bytes(analysis.totalBytes)],
        [Globe, t('harAnalyzer.domains'), String(analysis.domains.length)],
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('harAnalyzer.title')}</h1>
      <FileDropzone
        accept=".har,application/json"
        onFiles={(files) => files[0] && void load(files[0].file)}
        className="flex min-h-28 items-center justify-center rounded-xl p-5 text-center"
      >
        <div>
          <FileSearch className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          {t('harAnalyzer.drop')}
        </div>
      </FileDropzone>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {analysis && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {metrics.map(([Icon, label, value]) => (
              <Card key={String(label)}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {value}
                </CardContent>
              </Card>
            ))}
          </div>
          <Tabs value={view} onValueChange={(value) => setView(value as View)}>
            <TabsList className="flex h-auto flex-wrap">
              <TabsTrigger value="waterfall">
                {t('harAnalyzer.waterfall')}
              </TabsTrigger>
              <TabsTrigger value="failures">
                {t('harAnalyzer.failures')}
              </TabsTrigger>
              <TabsTrigger value="slow">{t('harAnalyzer.slow')}</TabsTrigger>
              <TabsTrigger value="size">{t('harAnalyzer.size')}</TabsTrigger>
              <TabsTrigger value="domains">
                {t('harAnalyzer.domainStats')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {view === 'domains' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {[analysis.domains, analysis.mimeTypes].map(
                (groups, groupIndex) => (
                  <Card key={groupIndex}>
                    <CardContent className="divide-y pt-3">
                      {groups.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center gap-3 py-2 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {item.name}
                          </span>
                          <span>{item.count}</span>
                          <span className="w-24 text-right text-muted-foreground">
                            {bytes(item.bytes)}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ),
              )}
            </div>
          ) : view === 'waterfall' ? (
            <div className="overflow-x-auto rounded-xl border p-3">
              <svg
                viewBox={`0 0 1000 ${Math.max(Math.min(entries.length, 200), 1) * 28}`}
                className="min-w-[900px]"
                role="img"
                aria-label={t('harAnalyzer.waterfall')}
              >
                {entries.slice(0, 200).map((entry, index) => {
                  const x =
                    330 + ((entry.startedAt - analysis.startedAt) / span) * 650;
                  const width = Math.max((entry.duration / span) * 650, 2);
                  return (
                    <g
                      key={`${entry.startedAt}-${index}`}
                      className="cursor-pointer"
                      onClick={() => setSelected(entry)}
                    >
                      <text
                        x="4"
                        y={index * 28 + 18}
                        className="fill-foreground text-[11px]"
                      >{`${entry.method} ${entry.url.slice(0, 48)}`}</text>
                      <rect
                        x={x}
                        y={index * 28 + 6}
                        width={width}
                        height="14"
                        rx="3"
                        className={
                          entry.status >= 400 || entry.status === 0
                            ? 'fill-destructive'
                            : 'fill-blue-500'
                        }
                      >
                        <title>{`${entry.duration.toFixed(0)} ms · ${bytes(entry.size)}`}</title>
                      </rect>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {entries.slice(0, 200).map((entry, index) => (
                <button
                  key={`${entry.startedAt}-${index}`}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => setSelected(entry)}
                >
                  <span className="w-12 font-medium">{entry.method}</span>
                  <span className="min-w-0 flex-1 truncate">{entry.url}</span>
                  <span
                    className={
                      entry.status >= 400 || entry.status === 0
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }
                  >
                    {entry.status}
                  </span>
                  <span className="w-20 text-right tabular-nums">
                    {entry.duration.toFixed(0)} ms
                  </span>
                  <span className="w-20 text-right text-muted-foreground">
                    {bytes(entry.size)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <MonacoTextEditor
              readOnly
              label={t('harAnalyzer.details')}
              language="json"
              height="360px"
              value={JSON.stringify(selected, null, 2)}
            />
          )}
        </>
      )}
    </div>
  );
}
