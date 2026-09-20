import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  matchCoverageSource,
  type CoverageMetric,
  type LcovResult,
} from '../lib/lcov-report';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
const metric = (value: CoverageMetric | null): string =>
  value
    ? `${value.percent === null ? '—' : `${value.percent.toFixed(1)}%`} (${value.hit}/${value.found})`
    : '—';
const delta = (value: number | null): string =>
  value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
const FILTERS = ['all', 'uncovered', 'regressed'];
type Source = { path: string; lines: string[] };
export default function LcovReportPanel({
  result,
  filter,
  onFilter,
}: {
  result: LcovResult;
  filter: string;
  onFilter: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [linePage, setLinePage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  useEffect(() => {
    setPage(0);
    setSelected(null);
    setLinePage(0);
  }, [result, filter]);
  const readSources = async (files: File[]): Promise<void> => {
    const currentEpoch = ++epoch.current;
    setReading(true);
    setSourceError(null);
    setSources([]);
    setLinePage(0);
    try {
      if (
        files.length > 100 ||
        files.reduce((size, file) => size + file.size, 0) > 5 * 1024 * 1024
      )
        throw new Error('SOURCE_LIMIT');
      const next = await Promise.all(
        files.map(async (file): Promise<Source> => {
          const lines = (await file.text()).split(/\r?\n/);
          if (lines.length > 100_000) throw new Error('SOURCE_LIMIT');
          return { path: file.webkitRelativePath || file.name, lines };
        }),
      );
      if (epoch.current === currentEpoch) setSources(next);
    } catch (cause) {
      if (epoch.current === currentEpoch)
        setSourceError((cause as Error).message);
    } finally {
      if (epoch.current === currentEpoch) setReading(false);
    }
  };
  const actualFilter = FILTERS.includes(filter) ? filter : 'all';
  const rows = result.changes.filter(
    (item) =>
      actualFilter === 'all' ||
      (actualFilter === 'uncovered'
        ? item.after &&
          item.after.lineCoverage.hit < item.after.lineCoverage.found
        : (item.lineDelta ?? 0) < 0 || (item.branchDelta ?? 0) < 0),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const safePage = Math.min(page, pages - 1);
  const selectedFile =
    result.current.files.find((file) => file.path === selected) ?? null;
  const sourceIndex = selectedFile
    ? matchCoverageSource(
        selectedFile.path,
        sources.map((source) => source.path),
        result.current.files.map((file) => file.path),
      )
    : null;
  const source = sourceIndex === null ? null : sources[sourceIndex];
  const coverageLines = useMemo(
    () =>
      new Map(selectedFile?.lines.map((line) => [line.line, line.hits]) ?? []),
    [selectedFile],
  );
  const lineCount = source?.lines.length ?? selectedFile?.lines.length ?? 0;
  const linePages = Math.max(1, Math.ceil(lineCount / 100));
  const safeLinePage = Math.min(linePage, linePages - 1);
  const visibleLines = source
    ? source.lines
        .slice(safeLinePage * 100, safeLinePage * 100 + 100)
        .map((code, index) => ({
          line: safeLinePage * 100 + index + 1,
          code,
          hits: coverageLines.get(safeLinePage * 100 + index + 1) ?? null,
        }))
    : (selectedFile?.lines
        .slice(safeLinePage * 100, safeLinePage * 100 + 100)
        .map((line) => ({ line: line.line, hits: line.hits, code: '' })) ?? []);
  return (
    <section className="min-w-0 space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(['fileCoverage', 'lineCoverage', 'branchCoverage'] as const).map(
          (key, index) => (
            <div key={key} className="min-w-0 rounded-md border p-3">
              <p className="text-sm text-muted-foreground">
                {t(`testReport.${['files', 'lines', 'branches'][index]}`)}
              </p>
              <p className="font-mono text-lg">{metric(result.current[key])}</p>
              {result.baseline && (
                <p className="text-xs text-muted-foreground">
                  {t('testReport.before')}: {metric(result.baseline[key])}
                </p>
              )}
            </div>
          ),
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('testReport.metricNote')}
      </p>
      <div className="flex items-center gap-2">
        <Label htmlFor="coverage-filter">{t('testReport.filter')}</Label>
        <Select value={actualFilter} onValueChange={onFilter}>
          <SelectTrigger id="coverage-filter" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`testReport.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('testReport.file')}</TableHead>
            <TableHead>{t('testReport.lines')}</TableHead>
            <TableHead>{t('testReport.branches')}</TableHead>
            {result.baseline && <TableHead>{t('testReport.change')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(safePage * 50, safePage * 50 + 50).map((item) => (
            <TableRow key={item.path}>
              <TableCell className="max-w-72 whitespace-normal break-all">
                <Button
                  variant="link"
                  className="h-auto max-w-full justify-start whitespace-normal p-0 text-left break-all"
                  disabled={!item.after}
                  onClick={() => {
                    setSelected(item.path);
                    setLinePage(0);
                  }}
                >
                  {item.path}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t('testReport.records')}: {item.after?.records ?? '—'}
                </p>
                {result.baseline && (!item.before || !item.after) && (
                  <Badge variant="outline">
                    {t(item.before ? 'testReport.removed' : 'testReport.added')}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <p>{metric(item.after?.lineCoverage ?? null)}</p>
                {result.baseline && (
                  <p className="text-xs text-muted-foreground">
                    {t('testReport.before')}:{' '}
                    {metric(item.before?.lineCoverage ?? null)}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <p>{metric(item.after?.branchCoverage ?? null)}</p>
                {result.baseline && (
                  <p className="text-xs text-muted-foreground">
                    {t('testReport.before')}:{' '}
                    {metric(item.before?.branchCoverage ?? null)}
                  </p>
                )}
              </TableCell>
              {result.baseline && (
                <TableCell>
                  <p>
                    {t('testReport.lines')}: {delta(item.lineDelta)}
                  </p>
                  <p>
                    {t('testReport.branches')}: {delta(item.branchDelta)}
                  </p>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && (
        <p className="text-sm text-muted-foreground">
          {t('testReport.noResults')}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={safePage === 0}
          onClick={() => setPage(safePage - 1)}
        >
          {t('testReport.previous')}
        </Button>
        <span className="text-sm">
          {t('testReport.page', { page: safePage + 1, total: pages })}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={safePage + 1 >= pages}
          onClick={() => setPage(safePage + 1)}
        >
          {t('testReport.next')}
        </Button>
      </div>
      <div className="min-w-0 space-y-2 rounded-md border p-3">
        <h2 className="font-medium">{t('testReport.source')}</h2>
        <p className="text-xs text-muted-foreground">
          {t('testReport.sourceNote')}
        </p>
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
          {[false, true].map((directory) => (
            <div key={String(directory)} className="min-w-0 space-y-2">
              <Label htmlFor={directory ? 'source-dir' : 'source-files'}>
                {t(
                  directory
                    ? 'testReport.sourceDirectory'
                    : 'testReport.sourceUpload',
                )}
              </Label>
              <Input
                id={directory ? 'source-dir' : 'source-files'}
                type="file"
                multiple
                ref={(element) => {
                  if (element) element.webkitdirectory = directory;
                }}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length) void readSources(files);
                  event.target.value = '';
                }}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {reading
            ? t('testReport.running')
            : t('testReport.sourceLoaded', { count: sources.length })}
        </p>
        {sourceError && (
          <p role="alert" className="text-sm text-destructive">
            {t('testReport.failureMessage', {
              message: t(`testReport.errors.${sourceError}`, {
                defaultValue: sourceError,
              }),
            })}
          </p>
        )}
      </div>
      {selectedFile ? (
        <div className="min-w-0 space-y-3">
          <h2 className="font-medium break-all">
            {t('testReport.selected', { path: selectedFile.path })}
          </h2>
          {!source && (
            <p className="text-sm text-muted-foreground">
              {t('testReport.sourceMissing')}
            </p>
          )}
          {source &&
            selectedFile.lines.some(
              (line) => line.line > source.lines.length,
            ) && (
              <p role="alert" className="text-sm text-destructive">
                {t('testReport.sourceRange')}
              </p>
            )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('testReport.line')}</TableHead>
                <TableHead>{t('testReport.hits')}</TableHead>
                {source && <TableHead>{t('testReport.code')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLines.map((line) => (
                <TableRow
                  key={line.line}
                  className={line.hits === 0 ? 'bg-destructive/10' : ''}
                >
                  <TableCell className="font-mono">{line.line}</TableCell>
                  <TableCell
                    className="font-mono"
                    title={
                      line.hits === null
                        ? t('testReport.uninstrumented')
                        : undefined
                    }
                  >
                    {line.hits ?? '—'}
                  </TableCell>
                  {source && (
                    <TableCell className="max-w-3xl">
                      <pre className="overflow-x-auto text-xs">
                        {line.code || ' '}
                      </pre>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={safeLinePage === 0}
              onClick={() => setLinePage(safeLinePage - 1)}
            >
              {t('testReport.previous')}
            </Button>
            <span className="text-sm">
              {t('testReport.page', {
                page: safeLinePage + 1,
                total: linePages,
              })}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={safeLinePage + 1 >= linePages}
              onClick={() => setLinePage(safeLinePage + 1)}
            >
              {t('testReport.next')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('testReport.selectFile')}
        </p>
      )}
    </section>
  );
}
