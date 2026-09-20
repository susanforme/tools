import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportFileInput,
  useReportFile,
} from '@/components/observability-file';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import {
  compareLighthouse,
  type LighthouseReport,
} from '@/lib/lighthouse-report';
export const Route = createFileRoute('/lighthouse-report')({
  component: LighthousePage,
});
const SAMPLE = {
  lighthouseVersion: '13.0.0',
  finalUrl: 'https://example.com',
  fetchTime: '2026-01-01T00:00:00Z',
  configSettings: { formFactor: 'mobile', throttlingMethod: 'simulate' },
  categories: {
    performance: {
      title: 'Performance',
      score: 0.7,
      auditRefs: [
        { id: 'largest-contentful-paint', weight: 25 },
        { id: 'total-blocking-time', weight: 30 },
      ],
    },
  },
  audits: {
    'largest-contentful-paint': {
      title: 'Largest Contentful Paint',
      numericValue: 3200,
      numericUnit: 'millisecond',
      score: 0.7,
      scoreDisplayMode: 'numeric',
      displayValue: '3.2 s',
      details: { type: 'debugdata' },
    },
    'total-blocking-time': {
      title: 'Total Blocking Time',
      numericValue: 300,
      numericUnit: 'millisecond',
      score: 0.6,
      scoreDisplayMode: 'numeric',
      displayValue: '300 ms',
    },
  },
};
const AFTER = {
  ...SAMPLE,
  fetchTime: '2026-01-02T00:00:00Z',
  categories: { performance: { ...SAMPLE.categories.performance, score: 0.9 } },
  audits: {
    ...SAMPLE.audits,
    'largest-contentful-paint': {
      ...SAMPLE.audits['largest-contentful-paint'],
      numericValue: 2000,
      score: 0.95,
      displayValue: '2.0 s',
    },
  },
};
const value = (number: number | null | undefined): string =>
  number === undefined || number === null
    ? '—'
    : Number(number.toFixed(3)).toLocaleString();
function LighthousePage() {
  const { t } = useTranslation();
  const before = useReportFile<LighthouseReport>('lighthouse');
  const after = useReportFile<LighthouseReport>('lighthouse');
  const [query, setQuery] = useQueryParams<{
    category: string;
    search: string;
  }>({ category: StringParam, search: StringParam });
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const categories = [
    ...new Map(
      [
        ...(before.result?.categories ?? []),
        ...(after.result?.categories ?? []),
      ].map((category) => [category.id, category]),
    ).values(),
  ];
  const rows = useMemo(
    () => compareLighthouse(before.result, after.result),
    [before.result, after.result],
  );
  const allowed = new Set([
    ...(before.result?.categories.find(
      (category) => category.id === query.category,
    )?.audits ?? []),
    ...(after.result?.categories.find(
      (category) => category.id === query.category,
    )?.audits ?? []),
  ]);
  const filtered = rows.filter(
    (row) =>
      (!query.category || query.category === 'all' || allowed.has(row.id)) &&
      `${row.id} ${row.left?.title ?? ''} ${row.right?.title ?? ''}`
        .toLowerCase()
        .includes((query.search ?? '').toLowerCase()),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 100) - 1),
  );
  const detail = filtered.find((row) => row.id === selected);
  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('lighthouseReport.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('lighthouseReport.description')}
      </p>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <ReportFileInput
          task={before}
          label={t('lighthouseReport.before')}
          sample={SAMPLE}
        />
        <ReportFileInput
          task={after}
          label={t('lighthouseReport.after')}
          sample={AFTER}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t('observability.limits')}
      </p>
      {(before.result || after.result) && (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            {[before.result, after.result].map((report, i) => (
              <div key={i} className="min-w-0 break-all text-sm">
                {report && (
                  <>
                    <p>{report.url}</p>
                    <p>
                      {report.time} · Lighthouse {report.version}
                    </p>
                    {report.warnings.map((warning, index) => (
                      <p key={index} className="text-destructive">
                        {warning}
                      </p>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
          {before.result &&
            after.result &&
            (before.result.environment !== after.result.environment ||
              before.result.version !== after.result.version ||
              before.result.url !== after.result.url) && (
              <p className="text-sm text-destructive">
                {t('lighthouseReport.environmentWarning')}
              </p>
            )}
          <div className="min-w-0 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('lighthouseReport.category')}</TableHead>
                  <TableHead>{t('lighthouseReport.before')}</TableHead>
                  <TableHead>{t('lighthouseReport.after')}</TableHead>
                  <TableHead>Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => {
                  const a = before.result?.categories.find(
                    (row) => row.id === category.id,
                  )?.score;
                  const b = after.result?.categories.find(
                    (row) => row.id === category.id,
                  )?.score;
                  return (
                    <TableRow key={category.id}>
                      <TableCell>{category.title}</TableCell>
                      <TableCell>{value(a == null ? null : a * 100)}</TableCell>
                      <TableCell>{value(b == null ? null : b * 100)}</TableCell>
                      <TableCell>
                        {value(a == null || b == null ? null : (b - a) * 100)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label>{t('lighthouseReport.category')}</Label>
              <Select
                value={query.category ?? 'all'}
                onValueChange={(category) => {
                  setQuery({ category });
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('observability.all')}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-search">
                {t('lighthouseReport.search')}
              </Label>
              <Input
                id="audit-search"
                value={query.search ?? ''}
                onChange={(event) => {
                  setQuery({ search: event.target.value });
                  setPage(0);
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('lighthouseReport.delta')}
          </p>
          <div className="min-w-0 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    'audit',
                    'before',
                    'after',
                    'numericDelta',
                    'scoreDelta',
                  ].map((key) => (
                    <TableHead key={key}>
                      {t(`lighthouseReport.${key}`)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered
                  .slice(currentPage * 100, currentPage * 100 + 100)
                  .map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="min-w-44 max-w-64 whitespace-normal break-all">
                        <Button
                          className="h-auto whitespace-normal text-left"
                          variant="link"
                          onClick={() => setSelected(row.id)}
                        >
                          {row.right?.title ?? row.left?.title}
                        </Button>
                        <p className="text-xs">{row.id}</p>
                      </TableCell>
                      <TableCell className="max-w-48 whitespace-normal break-all">
                        {row.left
                          ? row.left.display || value(row.left.value)
                          : '—'}
                      </TableCell>
                      <TableCell className="max-w-48 whitespace-normal break-all">
                        {row.right
                          ? row.right.display || value(row.right.value)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {value(row.numericDelta)}{' '}
                        {row.numericDelta !== null && row.right?.unit}
                      </TableCell>
                      <TableCell>{value(row.scoreDelta)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              {t('observability.previous')}
            </Button>
            <span>
              {currentPage + 1} /{' '}
              {Math.max(1, Math.ceil(filtered.length / 100))} ·{' '}
              {filtered.length}
            </span>
            <Button
              variant="outline"
              disabled={(currentPage + 1) * 100 >= filtered.length}
              onClick={() => setPage(currentPage + 1)}
            >
              {t('observability.next')}
            </Button>
          </div>
          {detail && (
            <section className="grid min-w-0 grid-cols-1 gap-4 rounded-md border p-4 md:grid-cols-2">
              {[detail.left, detail.right].map((audit, i) => (
                <div key={i} className="min-w-0 space-y-2">
                  <h2 className="font-semibold">
                    {t(
                      i === 0
                        ? 'lighthouseReport.before'
                        : 'lighthouseReport.after',
                    )}
                  </h2>
                  {audit ? (
                    <>
                      <p className="break-all">{audit.description}</p>
                      <p>
                        {audit.mode} ·{' '}
                        {value(audit.score == null ? null : audit.score * 100)}
                      </p>
                      <p className="break-all text-destructive">
                        {audit.error}
                      </p>
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">
                        {audit.details}
                      </pre>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
