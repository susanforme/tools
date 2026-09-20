import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import type {
  LockfileFormat,
  LockfileRequest,
  LockfileResult,
} from '@/lib/lockfile-diff';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Textarea } from './ui/textarea';

const createWorker = (): Worker =>
  new Worker(new URL('../workers/lockfile-diff.worker.ts', import.meta.url), {
    type: 'module',
  });
const QUERY = { lockFormat: StringParam };
const FORMATS = {
  bun: 'bun.lock',
  pnpm: 'pnpm-lock.yaml',
  npm: 'package-lock.json',
} as const;
const SAMPLE = (version: string): string =>
  JSON.stringify(
    {
      lockfileVersion: 3,
      packages: {
        '': { dependencies: { demo: '^1.0.0' } },
        'node_modules/demo': { version },
        'node_modules/demo/node_modules/helper': { version: '2.0.0' },
      },
    },
    null,
    2,
  );

export default function LockfileDiffPanel() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ lockFormat: string }>(QUERY);
  const format: LockfileFormat =
    query.lockFormat === 'pnpm' || query.lockFormat === 'npm'
      ? query.lockFormat
      : 'bun';
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [page, setPage] = useState(0);
  const [readError, setReadError] = useState<string | null>(null);
  const reads = useRef(0);
  const sideReads = useRef({ before: 0, after: 0 });
  useEffect(
    () => () => {
      reads.current++;
    },
    [],
  );
  const task = useBoundedWorker<LockfileRequest, LockfileResult>(createWorker);
  const clear = (): void => {
    reads.current++;
    task.clear();
    setReadError(null);
    setPage(0);
  };
  const upload = async (
    file: File | undefined,
    side: 'before' | 'after',
  ): Promise<void> => {
    if (!file) return;
    task.clear();
    setReadError(null);
    setPage(0);
    const current = reads.current;
    const sideRead = ++sideReads.current[side];
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
      const text = await file.text();
      if (current !== reads.current || sideRead !== sideReads.current[side])
        return;
      if (side === 'before') setBefore(text);
      else setAfter(text);
    } catch (cause) {
      if (current === reads.current && sideRead === sideReads.current[side])
        setReadError((cause as Error).message);
    }
  };
  const error = readError ?? task.error;
  const pages = Math.max(1, Math.ceil((task.result?.changes.length ?? 0) / 50));
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('lockfileDiff.limits')}
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={format}
          onValueChange={(value) => {
            clear();
            void setQuery({ lockFormat: value });
          }}
        >
          <SelectTrigger aria-label={t('lockfileDiff.format')} className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FORMATS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={task.busy || !before.trim() || !after.trim()}
          onClick={() => {
            clear();
            task.run({ before, after, format });
          }}
        >
          {t(task.busy ? 'lockfileDiff.running' : 'lockfileDiff.compare')}
        </Button>
        {task.busy && (
          <Button variant="outline" onClick={task.cancel}>
            {t('lockfileDiff.cancel')}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            clear();
            void setQuery({ lockFormat: 'npm' });
            setBefore(SAMPLE('1.0.0'));
            setAfter(SAMPLE('1.2.0'));
          }}
        >
          {t('lockfileDiff.sample')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            clear();
            setBefore('');
            setAfter('');
          }}
        >
          {t('lockfileDiff.clear')}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(['before', 'after'] as const).map((side) => (
          <div className="space-y-2" key={side}>
            <Label htmlFor={`lockfile-${side}`}>
              {t(`lockfileDiff.${side}`)}
            </Label>
            <Input
              type="file"
              accept=".json,.yaml,.yml,.lock"
              aria-label={t(`lockfileDiff.${side}`)}
              onChange={(event) => {
                void upload(event.target.files?.[0], side);
                event.target.value = '';
              }}
            />
            <Textarea
              id={`lockfile-${side}`}
              className="min-h-64 font-mono text-sm"
              spellCheck={false}
              value={side === 'before' ? before : after}
              onChange={(event) => {
                clear();
                if (side === 'before') setBefore(event.target.value);
                else setAfter(event.target.value);
              }}
            />
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('lockfileDiff.failure', {
            message: error.replace(/^[A-Z_]+/, (code) =>
              t(`lockfileDiff.errors.${code}`, { defaultValue: code }),
            ),
          })}
        </p>
      )}
      {task.result && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <p>
              {t('lockfileDiff.summary', {
                before: task.result.beforeCount,
                after: task.result.afterCount,
                count: task.result.changes.length,
              })}
            </p>
            <Button
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([JSON.stringify(task.result, null, 2)], {
                    type: 'application/json',
                  }),
                  'lockfile-diff.json',
                )
              }
            >
              {t('lockfileDiff.download')}
            </Button>
          </div>
          {task.result.excluded > 0 && (
            <p className="text-sm text-muted-foreground">
              {t('lockfileDiff.excluded', { count: task.result.excluded })}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {t('lockfileDiff.scopeNote')}
          </p>
          {!task.result.changes.length ? (
            <p>{t('lockfileDiff.noChanges')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('lockfileDiff.package')}</TableHead>
                  <TableHead>{t('lockfileDiff.kind')}</TableHead>
                  <TableHead>{t('lockfileDiff.beforeVersions')}</TableHead>
                  <TableHead>{t('lockfileDiff.afterVersions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {task.result.changes
                  .slice(page * 50, (page + 1) * 50)
                  .map((change) => (
                    <TableRow key={change.name}>
                      <TableCell className="align-top font-mono">
                        {change.name}
                        <p className="font-sans text-xs text-muted-foreground">
                          {t(
                            change.declared
                              ? 'lockfileDiff.declared'
                              : 'lockfileDiff.transitive',
                          )}
                        </p>
                      </TableCell>
                      <TableCell className="align-top">
                        {t(`lockfileDiff.${change.status}`)}
                      </TableCell>
                      {(['before', 'after'] as const).map((side) => (
                        <TableCell key={side} className="align-top">
                          <pre className="max-h-36 max-w-80 overflow-auto whitespace-pre-wrap break-all text-xs">
                            {change[side]
                              .map(
                                (entry) =>
                                  `${entry.version} · ${entry.locator}`,
                              )
                              .join('\n') || '—'}
                          </pre>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
          {pages > 1 && (
            <div className="flex gap-3 items-center">
              <Button
                variant="outline"
                disabled={!page}
                onClick={() => setPage(page - 1)}
              >
                {t('lockfileDiff.previous')}
              </Button>
              <span>
                {page + 1} / {pages}
              </span>
              <Button
                variant="outline"
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
              >
                {t('lockfileDiff.next')}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
