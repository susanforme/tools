import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropzone } from '../components/file-dropzone';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { useBoundedWorker } from '../hooks/use-bounded-worker';
import {
  StringParam,
  useQueryParams,
  withDefault,
} from '../hooks/useQueryParams';
import type { SbomRequest, SbomResult } from '../lib/sbom-viewer';
export const Route = createFileRoute('/sbom-viewer')({
  component: SbomViewerPage,
});
const QUERY = {
  view: withDefault<string>(StringParam, 'components'),
  q: withDefault<string>(StringParam, ''),
  changes: withDefault<string>(StringParam, 'all'),
};
const createWorker = () =>
  new Worker(new URL('../workers/sbom-viewer.worker.ts', import.meta.url), {
    type: 'module',
  });
function SbomViewerPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    view: string;
    q: string;
    changes: string;
  }>(QUERY);
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [page, setPage] = useState(0);
  const { result, error, busy, run, cancel, clear } = useBoundedWorker<
    SbomRequest,
    SbomResult
  >(createWorker, 10000);
  useEffect(() => {
    setPage(0);
  }, [query.q, query.view, query.changes, result]);
  const report = result?.after ?? result?.before;
  const view = query.view ?? 'components';
  const search = (query.q ?? '').toLowerCase();
  const componentNames = new Map(
    report?.components.map((item) => [item.id, item.name]) ?? [],
  );
  const rows: { id: string; cells: string[] }[] =
    view === 'diff'
      ? (result?.changes ?? [])
          .filter(
            (item) =>
              query.changes !== 'changed' || item.status !== 'unchanged',
          )
          .map((item) => ({
            id: item.identity,
            cells: [
              item.name,
              t(`developerExpansion.${item.status}`),
              `${item.before.join(', ') || '—'} → ${item.after.join(', ') || '—'}`,
              `${item.beforeLicenses.join(', ') || '—'} → ${item.afterLicenses.join(', ') || '—'}`,
              [
                item.dependencyChanged
                  ? t('developerExpansion.dependencies')
                  : '',
                item.vulnerabilityChanged
                  ? t('developerExpansion.vulnerabilities')
                  : '',
              ]
                .filter(Boolean)
                .join(', '),
            ],
          }))
      : view === 'dependencies'
        ? (report?.edges ?? []).map((edge, index) => ({
            id: String(index),
            cells: [
              componentNames.get(edge.from) ?? edge.from,
              edge.type,
              componentNames.get(edge.to) ?? edge.to,
            ],
          }))
        : view === 'vulnerabilities'
          ? (report?.vulnerabilities ?? []).map((vuln, index) => ({
              id: String(index),
              cells: [
                vuln.id,
                vuln.severity || '—',
                vuln.state || '—',
                vuln.affected
                  .map((id) => componentNames.get(id) ?? id)
                  .join(', ') || '—',
                vuln.description,
              ],
            }))
          : (report?.components ?? []).map((item) => ({
              id: item.id,
              cells: [
                item.name,
                item.version || '—',
                item.licenses.join(', ') || '—',
                item.purl || item.id,
              ],
            }));
  const filtered = rows.filter((row) =>
    row.cells.some((value) => value.toLowerCase().includes(search)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 100));
  const current = Math.min(page, pages - 1);
  const columns =
    view === 'diff'
      ? ['component', 'result', 'version', 'licenses', 'changedFields']
      : view === 'dependencies'
        ? ['from', 'relation', 'to']
        : view === 'vulnerabilities'
          ? ['vulnerability', 'severity', 'state', 'affected', 'description']
          : ['component', 'version', 'licenses', 'identifier'];
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">
        {t('developerExpansion.sbomTitle')}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t('developerExpansion.sbomHint')}
      </p>
      <p className="text-xs text-muted-foreground">
        {t('developerExpansion.sbomLimits')}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <FileDropzone
          accept=".json,application/json"
          onFiles={(files) => {
            const file = files[0]?.file;
            if (file) {
              setBefore(file);
              clear();
            }
          }}
        >
          <span className="break-all">
            {before?.name ?? t('developerExpansion.sbomBefore')}
          </span>
        </FileDropzone>
        <FileDropzone
          accept=".json,application/json"
          onFiles={(files) => {
            const file = files[0]?.file;
            if (file) {
              setAfter(file);
              clear();
            }
          }}
        >
          <span className="break-all">
            {after?.name ?? t('developerExpansion.sbomAfter')}
          </span>
        </FileDropzone>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!before || busy}
          onClick={() => {
            if (before) run({ before, ...(after ? { after } : {}) });
          }}
        >
          {t(
            busy ? 'developerExpansion.running' : 'developerExpansion.analyze',
          )}
        </Button>
        {busy && (
          <Button variant="outline" onClick={cancel}>
            {t('developerExpansion.cancel')}
          </Button>
        )}
        {after && (
          <Button
            variant="outline"
            onClick={() => {
              setAfter(null);
              clear();
            }}
          >
            {t('developerExpansion.removeComparison')}
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            setBefore(null);
            setAfter(null);
            clear();
          }}
        >
          {t('developerExpansion.clear')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="break-all text-sm text-destructive">
          {t('developerExpansion.failed', {
            message: t(`developerExpansion.errors.${error}`, {
              defaultValue: error,
            }),
          })}
        </p>
      )}
      {report && (
        <>
          <p role="status" className="text-sm">
            {result?.after
              ? `${result.before.format} → ${result.after.format}`
              : report.format}{' '}
            ·{' '}
            {t('developerExpansion.sbomSummary', {
              count: report.components.length,
              edges: report.edges.length,
              vulnerabilities: report.vulnerabilities.length,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('developerExpansion.sbomScope')}
          </p>
          {(report.unresolved > 0 || report.omittedServices > 0) && (
            <p className="text-sm text-muted-foreground">
              {t('developerExpansion.sbomWarnings', {
                references: report.unresolved,
                services: report.omittedServices,
              })}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>{t('developerExpansion.view')}</Label>
              <Select
                value={view}
                onValueChange={(value) => setQuery({ view: value })}
              >
                <SelectTrigger
                  className="w-44"
                  aria-label={t('developerExpansion.view')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    'components',
                    'dependencies',
                    'vulnerabilities',
                    ...(result?.after ? ['diff'] : []),
                  ].map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`developerExpansion.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              aria-label={t('developerExpansion.search')}
              value={query.q ?? ''}
              onChange={(e) => setQuery({ q: e.target.value })}
              placeholder={t('developerExpansion.search')}
              className="w-full sm:w-64"
            />
            {view === 'diff' && (
              <Select
                value={query.changes ?? 'all'}
                onValueChange={(value) => setQuery({ changes: value })}
              >
                <SelectTrigger
                  className="w-44"
                  aria-label={t('developerExpansion.filter')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('developerExpansion.all')}
                  </SelectItem>
                  <SelectItem value="changed">
                    {t('developerExpansion.changesOnly')}
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((key) => (
                  <TableHead key={key}>
                    {t(`developerExpansion.${key}`)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(current * 100, (current + 1) * 100).map((row) => (
                <TableRow key={row.id}>
                  {row.cells.map((value, index) => (
                    <TableCell
                      key={index}
                      className="max-w-80 whitespace-normal break-all align-top text-xs"
                    >
                      {value || '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!filtered.length && (
            <p className="text-sm text-muted-foreground">
              {t('developerExpansion.noRows')}
            </p>
          )}
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                {t('developerExpansion.previous')}
              </Button>
              <span>
                {current + 1}/{pages}
              </span>
              <Button
                variant="outline"
                disabled={current + 1 >= pages}
                onClick={() => setPage(current + 1)}
              >
                {t('developerExpansion.next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
