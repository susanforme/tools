import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { CompatRequest, CompatResult } from '../lib/browser-compat';
import {
  COMPAT_DATA_DATE,
  COMPAT_DATA_VERSION,
  COMPAT_FEATURES,
} from '../lib/browser-compat-catalog';
export const Route = createFileRoute('/browser-compat')({
  component: BrowserCompatPage,
});
const QUERY = {
  browsers: withDefault<string>(StringParam, 'defaults'),
  feature: withDefault<string>(StringParam, 'css-grid'),
};
const createWorker = () =>
  new Worker(new URL('../workers/browser-compat.worker.ts', import.meta.url), {
    type: 'module',
  });
function BrowserCompatPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    browsers: string;
    feature: string;
  }>(QUERY);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { result, error, busy, run, cancel, clear } = useBoundedWorker<
    CompatRequest,
    CompatResult
  >(createWorker, 20000);
  useEffect(() => {
    clear();
    setPage(0);
  }, [query.browsers, query.feature, clear]);
  const feature = query.feature ?? 'css-grid';
  const options = COMPAT_FEATURES.filter((item) =>
    `${item.id} ${item.title}`.toLowerCase().includes(search.toLowerCase()),
  ).slice(0, 100);
  const selected = COMPAT_FEATURES.find((item) => item.id === feature);
  if (selected && !options.some((item) => item.id === feature))
    options.unshift(selected);
  const pages = Math.max(1, Math.ceil((result?.rows.length ?? 0) / 100));
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">
        {t('developerExpansion.compatTitle')}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t('developerExpansion.compatHint')}
      </p>
      <p className="text-xs text-muted-foreground">
        Can I Use / caniuse-lite {COMPAT_DATA_VERSION} ·{' '}
        {t('developerExpansion.published')}: {COMPAT_DATA_DATE}
      </p>
      <div className="space-y-2">
        <Label htmlFor="compat-query">Browserslist</Label>
        <Input
          id="compat-query"
          value={query.browsers ?? 'defaults'}
          onChange={(e) => setQuery({ browsers: e.target.value })}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="compat-search">
            {t('developerExpansion.featureSearch')}
          </Label>
          <Input
            id="compat-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="CSS Grid, Fetch, WebAssembly…"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <Label>{t('developerExpansion.feature')}</Label>
          <Select
            value={feature}
            onValueChange={(value) => setQuery({ feature: value })}
          >
            <SelectTrigger
              className="w-full min-w-0"
              aria-label={t('developerExpansion.feature')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.title} ({item.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => run({ query: query.browsers ?? 'defaults', feature })}
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
      {result && (
        <>
          <p role="status" className="text-sm">
            {t('developerExpansion.coverage', {
              count: result.rows.length,
              coverage: result.coverage.toFixed(2),
            })}
          </p>
          <p className="text-sm">
            {result.title} ·{' '}
            <a
              className="underline"
              href={`https://caniuse.com/${result.feature}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('developerExpansion.supportNotes')}
            </a>
          </p>
          <p className="text-xs text-muted-foreground">
            {t('developerExpansion.flagsHint')}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('developerExpansion.browser')}</TableHead>
                <TableHead>{t('developerExpansion.version')}</TableHead>
                <TableHead>{t('developerExpansion.support')}</TableHead>
                <TableHead>{t('developerExpansion.globalUsage')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.slice(page * 100, (page + 1) * 100).map((row) => (
                <TableRow key={`${row.browser} ${row.version}`}>
                  <TableCell>{row.browser}</TableCell>
                  <TableCell>{row.version}</TableCell>
                  <TableCell>
                    <span
                      className={
                        row.status === 'unsupported' ? 'text-destructive' : ''
                      }
                    >
                      {t(`developerExpansion.${row.status}`)}
                    </span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {row.flags}
                    </span>
                  </TableCell>
                  <TableCell>{row.coverage.toFixed(3)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pages > 1 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                {t('developerExpansion.previous')}
              </Button>
              <span>
                {page + 1}/{pages}
              </span>
              <Button
                variant="outline"
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
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
