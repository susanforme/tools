import { FileDropzone } from '@/components/file-dropzone';
import { Badge } from '@/components/ui/badge';
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
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  exportSarifFindings,
  filterSarifFindings,
  SARIF_LEVELS,
  SARIF_MAX_BYTES,
  type SarifFilters,
  type SarifLocation,
  type SarifRegion,
  type SarifReport,
} from '@/lib/sarif-viewer';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/sarif-viewer')({
  component: SarifViewerPage,
});
const createWorker = (): Worker =>
  new Worker(new URL('../workers/sarif-viewer.worker.ts', import.meta.url), {
    type: 'module',
  });
const PREVIEW_ITEMS = 20;
const SAMPLE = {
  version: '2.1.0',
  runs: [
    {
      tool: {
        driver: {
          name: 'Example Scanner',
          rules: [
            {
              id: 'SEC001',
              shortDescription: { text: '避免明文口令' },
              defaultConfiguration: { level: 'error' },
              help: { text: '从环境变量或密钥管理服务读取口令。' },
            },
          ],
        },
      },
      originalUriBaseIds: { ROOT: { uri: 'file:///project/' } },
      artifacts: [{ location: { uri: 'src/config.ts', uriBaseId: 'ROOT' } }],
      results: [
        {
          ruleIndex: 0,
          message: { text: '发现硬编码口令' },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { index: 0 },
                region: {
                  startLine: 12,
                  startColumn: 1,
                  snippet: { text: 'const password = "example";' },
                },
              },
            },
          ],
          relatedLocations: [
            {
              id: 1,
              message: { text: '口令使用位置' },
              physicalLocation: {
                artifactLocation: { uri: 'src/login.ts', uriBaseId: 'ROOT' },
                region: { startLine: 8 },
              },
            },
          ],
          fixes: [
            {
              description: { text: '改为读取环境变量' },
              artifactChanges: [
                {
                  artifactLocation: { index: 0 },
                  replacements: [
                    {
                      deletedRegion: {
                        startLine: 12,
                        startColumn: 1,
                        endLine: 12,
                        endColumn: 28,
                      },
                      insertedContent: {
                        text: 'const password = process.env.PASSWORD;',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      tool: { driver: { name: 'Style Scanner' } },
      results: [
        {
          ruleId: 'STYLE001',
          level: 'note',
          message: { text: '使用更明确的变量名' },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: 'src/utils.ts' },
                region: { startLine: 3 },
              },
            },
          ],
        },
      ],
    },
  ],
};
function preview(value: string): string {
  return value.length > 16384 ? `${value.slice(0, 16384)}…` : value;
}
function regionText(region: SarifRegion): string {
  if (region.startLine === null) return '';
  return `${region.startLine}${region.startColumn === null ? '' : `:${region.startColumn}`}${region.endLine === null ? '' : `–${region.endLine}${region.endColumn === null ? '' : `:${region.endColumn}`}`}`;
}
function SarifViewerPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<SarifFilters>({
    run: StringParam,
    level: StringParam,
    rule: StringParam,
    file: StringParam,
  });
  const task = useBoundedWorker<File, SarifReport>(createWorker, 20_000);
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const report = task.result;
  const filters: SarifFilters = {
    run: query.run ?? 'all',
    level: SARIF_LEVELS.includes(query.level as (typeof SARIF_LEVELS)[number])
      ? query.level!
      : 'all',
    rule: query.rule ?? '',
    file: query.file ?? '',
  };
  const filtered = useMemo(
    () =>
      filterSarifFindings(report?.findings ?? [], {
        run: query.run ?? 'all',
        level: SARIF_LEVELS.includes(
          query.level as (typeof SARIF_LEVELS)[number],
        )
          ? query.level!
          : 'all',
        rule: query.rule ?? '',
        file: query.file ?? '',
      }),
    [report, query.run, query.level, query.rule, query.file],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 100));
  const currentPage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(currentPage * 100, (currentPage + 1) * 100);
  const selected =
    filtered.find((finding) => finding.id === selectedId) ?? null;
  const rule = selected ? report?.rules[selected.ruleKey] : null;
  const error = localError ?? task.error;
  const load = (file: File): void => {
    task.clear();
    setLocalError(null);
    setName(file.name);
    setSelectedId(null);
    setPage(0);
    if (file.size > SARIF_MAX_BYTES) {
      setLocalError('sizeLimit');
      return;
    }
    task.run(file);
  };
  const update = (values: Partial<SarifFilters>): void => {
    setQuery(values);
    setPage(0);
    setSelectedId(null);
  };
  const renderLocations = (locations: SarifLocation[]): React.ReactNode =>
    locations.slice(0, PREVIEW_ITEMS).map((location, index) => (
      <div
        key={index}
        className="min-w-0 space-y-2 rounded-md border p-3 text-sm"
      >
        <p className="break-all font-mono">
          {preview(location.uri || location.logicalName) ||
            t('sarifViewer.noLocation')}
          {regionText(location.region) && ` (${regionText(location.region)})`}
          {location.id !== null && ` #${location.id}`}
        </p>
        {location.message && (
          <p className="whitespace-pre-wrap break-words">
            {preview(location.message)}
          </p>
        )}
        {location.logicalName && location.uri && (
          <p className="break-all">{preview(location.logicalName)}</p>
        )}
        {location.unresolved && (
          <p className="text-destructive">{t('sarifViewer.unresolvedUri')}</p>
        )}
        {location.region.snippet && (
          <div>
            <h4 className="mb-1 text-xs text-muted-foreground">
              {t('sarifViewer.snippet')}
            </h4>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-xs">
              {preview(location.region.snippet)}
            </pre>
          </div>
        )}
      </div>
    ));
  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('sarifViewer.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('sarifViewer.description')}
        </p>
      </div>
      <FileDropzone
        accept=".sarif,.json,application/json"
        onFiles={(files) => {
          if (files[0]) load(files[0].file);
        }}
        className="block min-w-0 rounded-md p-6 text-center text-sm"
      >
        <span className="break-all">{name || t('sarifViewer.upload')}</span>
      </FileDropzone>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            load(
              new File([JSON.stringify(SAMPLE)], 'example.sarif', {
                type: 'application/json',
              }),
            )
          }
        >
          {t('sarifViewer.sample')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            task.clear();
            setLocalError(null);
            setName('');
            setSelectedId(null);
          }}
        >
          {t('sarifViewer.clear')}
        </Button>
        {task.busy && (
          <Button variant="outline" onClick={task.cancel}>
            {t('sarifViewer.cancel')}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t('sarifViewer.limits')}</p>
      {task.busy && (
        <p role="status" className="text-sm">
          {t('sarifViewer.loading')}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="break-words rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {t('sarifViewer.failed', {
            message: t(`sarifViewer.errors.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
      {report && (
        <>
          {report.runs.length === 0 && (
            <p className="text-sm">{t('sarifViewer.emptyRuns')}</p>
          )}
          {report.runs.some((run) => !run.resultsPresent) && (
            <p className="text-sm text-muted-foreground">
              {t('sarifViewer.missingResults', {
                runs: report.runs
                  .filter((run) => !run.resultsPresent)
                  .map((run) => run.index + 1)
                  .join(', '),
              })}
            </p>
          )}
          {report.runs.some((run) => run.externalData) && (
            <p className="text-sm text-muted-foreground">
              {t('sarifViewer.external')}
            </p>
          )}
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="sarif-run">{t('sarifViewer.run')}</Label>
              <Select
                value={filters.run}
                onValueChange={(value) => update({ run: value })}
              >
                <SelectTrigger id="sarif-run" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('sarifViewer.allRuns')}
                  </SelectItem>
                  {report.runs.map((run) => (
                    <SelectItem key={run.index} value={String(run.index)}>
                      {t('sarifViewer.runItem', {
                        index: run.index + 1,
                        tool: run.tool,
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="sarif-level">{t('sarifViewer.level')}</Label>
              <Select
                value={filters.level}
                onValueChange={(value) => update({ level: value })}
              >
                <SelectTrigger id="sarif-level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('sarifViewer.allLevels')}
                  </SelectItem>
                  {SARIF_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {t(`sarifViewer.${level}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="sarif-rule">{t('sarifViewer.rule')}</Label>
              <Input
                id="sarif-rule"
                value={filters.rule}
                onChange={(event) => update({ rule: event.target.value })}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="sarif-file">{t('sarifViewer.file')}</Label>
              <Input
                id="sarif-file"
                value={filters.file}
                onChange={(event) => update({ file: event.target.value })}
              />
            </div>
          </div>
          <p className="text-sm">
            {t('sarifViewer.summary', {
              runs: report.runs.length,
              total: report.findings.length,
              count: filtered.length,
            })}
          </p>
          <div className="min-w-0 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('sarifViewer.level')}</TableHead>
                  <TableHead>{t('sarifViewer.rule')}</TableHead>
                  <TableHead>{t('sarifViewer.message')}</TableHead>
                  <TableHead>{t('sarifViewer.location')}</TableHead>
                  <TableHead>{t('sarifViewer.details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((finding) => (
                  <TableRow
                    key={finding.id}
                    data-state={
                      finding.id === selectedId ? 'selected' : undefined
                    }
                  >
                    <TableCell className="align-top">
                      <Badge
                        variant={
                          finding.level === 'error'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {t(`sarifViewer.${finding.level}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-48 break-all align-top font-mono text-xs">
                      {preview(finding.ruleId) || t('sarifViewer.unnamedRule')}
                    </TableCell>
                    <TableCell className="min-w-48 max-w-96 whitespace-pre-wrap break-all align-top">
                      {preview(finding.message)}
                    </TableCell>
                    <TableCell className="max-w-64 break-all align-top font-mono text-xs">
                      {finding.locations[0]?.uri ||
                        finding.locations[0]?.logicalName ||
                        t('sarifViewer.noLocation')}
                      {finding.locations[0] &&
                        ` ${regionText(finding.locations[0].region)}`}
                    </TableCell>
                    <TableCell className="align-top">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedId(finding.id)}
                      >
                        {t('sarifViewer.open')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!filtered.length && (
            <p className="text-sm text-muted-foreground">
              {t('sarifViewer.noResults')}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => {
                setPage(currentPage - 1);
                setSelectedId(null);
              }}
            >
              {t('sarifViewer.previous')}
            </Button>
            <span className="text-sm">
              {t('sarifViewer.page', {
                page: currentPage + 1,
                total: pageCount,
              })}
            </span>
            <Button
              variant="outline"
              disabled={currentPage + 1 >= pageCount}
              onClick={() => {
                setPage(currentPage + 1);
                setSelectedId(null);
              }}
            >
              {t('sarifViewer.next')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([exportSarifFindings(report, filters)], {
                    type: 'application/json',
                  }),
                  'sarif-findings.json',
                )
              }
            >
              {t('sarifViewer.export')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('sarifViewer.exportFormat')}
          </p>
          {selected && (
            <section
              aria-label={t('sarifViewer.details')}
              className="min-w-0 space-y-4 rounded-md border p-4"
            >
              <h2 className="font-semibold">
                {t('sarifViewer.details')} ·{' '}
                {t('sarifViewer.sourceResult', {
                  run: selected.runIndex + 1,
                  result: selected.resultIndex + 1,
                })}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('sarifViewer.detailLimit')}
              </p>
              <p className="whitespace-pre-wrap break-all text-sm">
                {preview(selected.message)}
              </p>
              <p className="break-all text-xs text-muted-foreground">
                {t('sarifViewer.kind')}: {selected.kind}
                {selected.baselineState &&
                  ` · ${t('sarifViewer.baseline')}: ${selected.baselineState}`}
              </p>
              {selected.suppressions.length > 0 && (
                <p className="break-all text-xs">
                  {t('sarifViewer.suppressions')}:{' '}
                  {selected.suppressions.join(', ')}
                </p>
              )}
              {selected.warnings.map((warning) => (
                <p key={warning} className="text-sm text-destructive">
                  {t(`sarifViewer.${warning}`)}
                </p>
              ))}
              {rule && (rule.description || rule.help || rule.helpUri) && (
                <div className="space-y-2">
                  <h3 className="font-medium">{t('sarifViewer.ruleInfo')}</h3>
                  <p className="whitespace-pre-wrap break-all text-sm">
                    {preview(rule.description)}
                  </p>
                  <p className="whitespace-pre-wrap break-all text-sm">
                    {preview(rule.help)}
                  </p>
                  {rule.helpUri && (
                    <p className="break-all font-mono text-xs">
                      {t('sarifViewer.helpUri')}: {preview(rule.helpUri)}
                    </p>
                  )}
                </div>
              )}
              <h3 className="font-medium">
                {t('sarifViewer.location')} ({selected.locations.length})
              </h3>
              {selected.locations.length ? (
                renderLocations(selected.locations)
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('sarifViewer.noLocation')}
                </p>
              )}
              {selected.relatedLocations.length > 0 && (
                <>
                  <h3 className="font-medium">
                    {t('sarifViewer.related')} (
                    {selected.relatedLocations.length})
                  </h3>
                  {renderLocations(selected.relatedLocations)}
                </>
              )}
              <h3 className="font-medium">
                {t('sarifViewer.fixes')} ({selected.fixes.length})
              </h3>
              {!selected.fixes.length && (
                <p className="text-sm text-muted-foreground">
                  {t('sarifViewer.noFix')}
                </p>
              )}
              {selected.fixes.slice(0, PREVIEW_ITEMS).map((fix, i) => (
                <div
                  key={i}
                  className="min-w-0 space-y-2 rounded-md bg-muted/30 p-3"
                >
                  <p className="whitespace-pre-wrap break-all text-sm">
                    {preview(fix.description)}
                  </p>
                  {fix.changes.slice(0, PREVIEW_ITEMS).map((change, j) => (
                    <div key={j} className="min-w-0 space-y-2">
                      <p className="break-all font-mono text-xs">
                        {preview(change.uri)}
                      </p>
                      {change.replacements
                        .slice(0, PREVIEW_ITEMS)
                        .map((replacement, k) => (
                          <div key={k} className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                              {t('sarifViewer.delete')}:{' '}
                              {regionText(replacement.deletedRegion)} ·{' '}
                              {t('sarifViewer.insert')}
                            </p>
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border p-2 text-xs">
                              {preview(replacement.insertedText)}
                            </pre>
                            {replacement.binary && (
                              <p className="text-xs">
                                {t('sarifViewer.binary')}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
