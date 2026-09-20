import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '../hooks/use-bounded-worker';
import {
  StringParam,
  useQueryParams,
  withDefault,
} from '../hooks/useQueryParams';
import type {
  PathRuleRequest,
  PathRuleResult,
} from '../lib/path-rule-debugger';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
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
import { Textarea } from './ui/textarea';
const createWorker = () =>
  new Worker(
    new URL('../workers/path-rule-debugger.worker.ts', import.meta.url),
    { type: 'module' },
  );
const QUERY = {
  matcher: withDefault<string>(StringParam, 'gitignore'),
  dot: withDefault<string>(StringParam, 'no'),
  case: withDefault<string>(StringParam, 'yes'),
};
export default function PathRuleDebuggerPanel() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    matcher: string;
    dot: string;
    case: string;
  }>(QUERY);
  const mode = query.matcher === 'glob' ? 'glob' : 'gitignore';
  const [rules, setRules] = useState('dist/\n*.log\n!keep.log');
  const [paths, setPaths] = useState(
    'src/index.ts\ndist/app.js\nerror.log\nkeep.log\n.hidden',
  );
  const [page, setPage] = useState(0);
  const { result, error, busy, run, clear, cancel } = useBoundedWorker<
    PathRuleRequest,
    PathRuleResult
  >(createWorker, 10000);
  useEffect(() => {
    clear();
    setPage(0);
  }, [mode, query.dot, query.case, clear]);
  const rows = result?.rows ?? [];
  const pages = Math.max(1, Math.ceil(rows.length / 100));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t(
          mode === 'glob'
            ? 'developerExpansion.globHint'
            : 'developerExpansion.ignoreHint',
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {t('developerExpansion.ruleLimits')}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={mode}
          onValueChange={(value) => setQuery({ matcher: value })}
        >
          <SelectTrigger
            className="w-40"
            aria-label={t('developerExpansion.matchMode')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gitignore">Gitignore</SelectItem>
            <SelectItem value="glob">Glob</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="rules-case"
            checked={query.case !== 'no'}
            onCheckedChange={(value) =>
              setQuery({ case: value ? 'yes' : 'no' })
            }
          />
          <Label htmlFor="rules-case">
            {t('developerExpansion.caseSensitive')}
          </Label>
        </div>
        {mode === 'glob' && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="rules-dot"
              checked={query.dot === 'yes'}
              onCheckedChange={(value) =>
                setQuery({ dot: value ? 'yes' : 'no' })
              }
            />
            <Label htmlFor="rules-dot">
              {t('developerExpansion.dotfiles')}
            </Label>
          </div>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="path-rules">{t('developerExpansion.rules')}</Label>
          <Textarea
            id="path-rules"
            value={rules}
            onChange={(e) => {
              setRules(e.target.value);
              clear();
            }}
            className="min-h-48 font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="path-inputs">{t('developerExpansion.paths')}</Label>
          <Textarea
            id="path-inputs"
            value={paths}
            onChange={(e) => {
              setPaths(e.target.value);
              clear();
            }}
            className="min-h-48 font-mono text-xs"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => {
            setPage(0);
            run({
              mode,
              rules,
              paths,
              dot: query.dot === 'yes',
              caseSensitive: query.case !== 'no',
            });
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('developerExpansion.path')}</TableHead>
                <TableHead>{t('developerExpansion.result')}</TableHead>
                <TableHead>{t('developerExpansion.matchedRule')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(page * 100, (page + 1) * 100).map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="max-w-64 whitespace-normal break-all font-mono text-xs">
                    {row.path}
                  </TableCell>
                  <TableCell>
                    {t(
                      row.invalid
                        ? 'developerExpansion.invalidPath'
                        : row.matched
                          ? mode === 'glob'
                            ? 'developerExpansion.matched'
                            : 'developerExpansion.ignored'
                          : 'developerExpansion.kept',
                    )}
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-pre-wrap break-all font-mono text-xs">
                    {row.rules.join('\n') || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                {t('developerExpansion.previous')}
              </Button>
              <span>
                {page + 1} / {pages}
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
