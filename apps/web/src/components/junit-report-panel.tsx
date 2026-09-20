import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { JunitResult } from '../lib/junit-report';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
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
const FILTERS = [
  'all',
  'passed',
  'failure',
  'error',
  'skipped',
  'new',
  'ambiguous',
];
export default function JunitReportPanel({
  result,
  filter,
  onFilter,
}: {
  result: JunitResult;
  filter: string;
  onFilter: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const actualFilter = FILTERS.includes(filter) ? filter : 'all';
  const rows = result.current.cases.filter(
    (item) =>
      actualFilter === 'all' ||
      item.status === actualFilter ||
      item.regression === actualFilter,
  );
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const safePage = Math.min(page, pages - 1);
  useEffect(() => setPage(0), [result, filter]);
  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['passed', 'failure', 'error', 'skipped'] as const).map((status) => (
          <Badge key={status} variant="secondary">
            {t(`testReport.${status}`)}: {result.current[status]}
          </Badge>
        ))}
      </div>
      <p className="text-sm">
        {t('testReport.totalTime', {
          seconds: result.current.seconds.toFixed(3),
          missing: result.current.missingTime,
        })}
      </p>
      {result.baseline && (
        <p className="text-sm">
          {t('testReport.baselineCount', {
            count: result.baseline.cases.length,
            fresh: result.newFailures,
            ambiguous: result.ambiguousFailures,
          })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t('testReport.identityNote')}
      </p>
      {(result.current.duplicates > 0 ||
        (result.baseline?.duplicates ?? 0) > 0) && (
        <p className="text-sm">
          {t('testReport.duplicateCount', {
            current: result.current.duplicates,
            baseline: result.baseline?.duplicates ?? 0,
          })}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Label htmlFor="junit-filter">{t('testReport.filter')}</Label>
        <Select value={actualFilter} onValueChange={onFilter}>
          <SelectTrigger id="junit-filter" className="w-48">
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
            <TableHead>{t('testReport.name')}</TableHead>
            <TableHead>{t('testReport.status')}</TableHead>
            <TableHead>{t('testReport.time')}</TableHead>
            <TableHead>{t('testReport.details')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(safePage * 50, safePage * 50 + 50).map((item) => (
            <TableRow key={item.key}>
              <TableCell className="max-w-72 whitespace-normal break-all">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[item.suite, item.classname, item.file]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {item.duplicate && (
                  <Badge variant="outline">{t('testReport.duplicate')}</Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    item.status === 'error' || item.status === 'failure'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {t(`testReport.${item.status}`)}
                </Badge>
                {item.regression && (
                  <p className="mt-1 text-xs">
                    {t(`testReport.${item.regression}`)}
                  </p>
                )}
              </TableCell>
              <TableCell>{item.seconds ?? '—'}</TableCell>
              <TableCell className="max-w-96 whitespace-normal">
                <details>
                  <summary className="cursor-pointer text-sm">
                    {t('testReport.details')}
                  </summary>
                  <pre className="mt-2 max-h-72 max-w-80 overflow-auto whitespace-pre-wrap break-all text-xs">
                    {item.details || t('testReport.noDetails')}
                  </pre>
                </details>
              </TableCell>
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
    </section>
  );
}
