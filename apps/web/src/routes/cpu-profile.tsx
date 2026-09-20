import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  StringParam,
  useQueryParams,
  withDefault,
} from '../hooks/useQueryParams';
import type { CpuNode, CpuProfile } from '../lib/cpu-profile';
import { layoutCpuFlame } from '../lib/cpu-profile-view';

export const Route = createFileRoute('/cpu-profile')({
  component: CpuProfilePage,
});
const PAGE_SIZE = 50;
const QUERY = {
  sort: withDefault<string>(StringParam, 'self'),
  q: withDefault<string>(StringParam, ''),
};
const ms = (value: number): string =>
  (value / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 });

function CpuProfilePage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ sort: string; q: string }>(QUERY);
  const search = query.q ?? '';
  const sort = query.sort === 'total' ? 'total' : 'self';
  const [profile, setProfile] = useState<CpuProfile | null>(null);
  const [fileName, setFileName] = useState('');
  const [focus, setFocus] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [childPage, setChildPage] = useState(0);
  const zoom = (id: number | null) => {
    setFocus(id);
    setChildPage(0);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      worker.current?.terminate();
    },
    [],
  );

  const stop = () => {
    generation.current++;
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
  };
  const load = (file: File) => {
    stop();
    const current = generation.current;
    setError(null);
    setProfile(null);
    zoom(null);
    setFileName(file.name);
    setPage(0);
    if (file.size > 20 * 1024 * 1024) {
      setError(
        t('cpuProfile.failed', { message: t('cpuProfile.errors.sizeLimit') }),
      );
      return;
    }
    setBusy(true);
    const fail = (message: string) => {
      if (current !== generation.current) return;
      worker.current?.terminate();
      worker.current = null;
      setBusy(false);
      setError(
        t('cpuProfile.failed', {
          message: t(`cpuProfile.errors.${message}`, { defaultValue: message }),
        }),
      );
    };
    try {
      const next = new Worker(
        new URL('../workers/cpu-profile.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.current = next;
      next.onmessage = (
        event: MessageEvent<{ result?: CpuProfile; error?: string }>,
      ) => {
        if (current !== generation.current) return;
        if (event.data.error) {
          fail(event.data.error);
          return;
        }
        if (event.data.result) {
          setProfile(event.data.result);
          zoom(event.data.result.rootId);
          setBusy(false);
          next.terminate();
          worker.current = null;
        }
      };
      next.onerror = () => fail('worker');
      next.onmessageerror = () => fail('worker');
      next.postMessage(file);
    } catch (cause) {
      fail((cause as Error).message);
    }
  };

  const nodes = useMemo(
    () => new Map(profile?.nodes.map((node) => [node.id, node]) ?? []),
    [profile],
  );
  const selected = focus === null ? null : (nodes.get(focus) ?? null);
  const selectedFunction =
    selected && profile ? profile.functions[selected.functionIndex]! : null;
  const chart = useMemo(
    () =>
      profile && focus !== null
        ? layoutCpuFlame(profile.nodes, focus)
        : { frames: [], clipped: false },
    [profile, focus],
  );
  const matches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return (profile?.functions ?? [])
      .map((entry, index) => ({ ...entry, index }))
      .filter(
        (entry) =>
          !term ||
          `${entry.name} ${entry.url}`.toLocaleLowerCase().includes(term),
      )
      .sort((left, right) => right[sort] - left[sort]);
  }, [profile, search, sort]);
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const childIds =
    selected?.children.filter((id) => nodes.get(id)!.total > 0) ?? [];
  const childPages = Math.max(1, Math.ceil(childIds.length / PAGE_SIZE));
  const path: CpuNode[] = [];
  for (
    let node = selected;
    node;
    node = node.parent === null ? null : (nodes.get(node.parent) ?? null)
  )
    path.unshift(node);
  const source = (node: CpuNode): string => {
    const fn = profile!.functions[node.functionIndex]!;
    return fn.url
      ? `${fn.url}${fn.line > 0 ? `:${fn.line}:${fn.column}` : ''}`
      : t('cpuProfile.internal');
  };
  const label = (node: CpuNode): string =>
    `${profile!.functions[node.functionIndex]!.name} · ${t('cpuProfile.self')} ${ms(node.self)} ms · ${t('cpuProfile.total')} ${ms(node.total)} ms`;
  const percentage = (value: number): string =>
    profile ? `${((value / profile.sampled) * 100).toFixed(2)}%` : '';

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('cpuProfile.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('cpuProfile.limits')}</p>
      <FileDropzone
        accept=".cpuprofile,.json,application/json"
        onFiles={(files) => {
          if (files[0]) load(files[0].file);
        }}
        className="flex min-h-28 items-center justify-center rounded-lg p-4 text-sm"
      >
        <span>{t('cpuProfile.upload')}</span>
      </FileDropzone>
      {fileName && <p className="break-all text-sm">{fileName}</p>}
      {busy && (
        <div className="flex items-center gap-2">
          <p role="status">{t('cpuProfile.loading')}</p>
          <Button variant="outline" onClick={stop}>
            {t('cpuProfile.cancel')}
          </Button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {profile && selected && (
        <>
          <p role="status" className="text-sm">
            {t('cpuProfile.summary', {
              duration: ms(profile.duration),
              sampled: ms(profile.sampled),
              uncovered: ms(profile.uncovered),
              count: profile.sampleCount,
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('cpuProfile.timing')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="cpu-search">{t('cpuProfile.search')}</Label>
            <Input
              id="cpu-search"
              value={search}
              className="w-full md:w-80"
              onChange={(event) => {
                setQuery({ q: event.target.value });
                setPage(0);
              }}
            />
            <Button
              variant="outline"
              disabled={focus === profile.rootId}
              onClick={() => zoom(profile.rootId)}
            >
              {t('cpuProfile.reset')}
            </Button>
            <Button
              variant="outline"
              disabled={selected.parent === null}
              onClick={() => zoom(selected.parent)}
            >
              {t('cpuProfile.parent')}
            </Button>
          </div>
          <section className="space-y-2" aria-label={t('cpuProfile.flame')}>
            <h2 className="font-semibold">{t('cpuProfile.flame')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('cpuProfile.flameHint')}
            </p>
            <div className="max-h-[560px] overflow-auto rounded-md border p-2">
              <svg
                viewBox={`0 0 1000 ${Math.max(1, ...chart.frames.map((frame) => frame.depth + 1)) * 28}`}
                className="w-full min-w-[720px]"
                aria-label={t('cpuProfile.flame')}
              >
                {chart.frames.map((frame) => {
                  const node = nodes.get(frame.nodeId)!;
                  const fn = profile.functions[node.functionIndex]!;
                  const highlighted =
                    search.trim() &&
                    `${fn.name} ${fn.url}`
                      .toLocaleLowerCase()
                      .includes(search.trim().toLocaleLowerCase());
                  return (
                    <g
                      key={frame.nodeId}
                      role="button"
                      tabIndex={0}
                      aria-label={label(node)}
                      onClick={() => zoom(node.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          zoom(node.id);
                        }
                      }}
                      className="group cursor-pointer outline-none"
                    >
                      <title>{`${label(node)}\n${source(node)}`}</title>
                      <rect
                        className="group-focus:stroke-foreground group-focus:stroke-2"
                        x={frame.x}
                        y={frame.depth * 28}
                        width={Math.max(0.5, frame.width - 0.6)}
                        height={25}
                        rx={2}
                        fill={`hsl(${((node.functionIndex * 37) % 60) + 10} 78% ${highlighted ? 48 : 74}%)`}
                        stroke={highlighted ? 'currentColor' : 'none'}
                        strokeWidth={2}
                      />
                      {frame.width > 22 && (
                        <text
                          x={frame.x + 3}
                          y={frame.depth * 28 + 17}
                          fontSize={11}
                          fill="#1f2937"
                          pointerEvents="none"
                        >
                          {fn.name.slice(
                            0,
                            Math.max(1, Math.floor((frame.width - 8) / 7)),
                          )}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
            {chart.clipped && (
              <p className="text-sm text-muted-foreground">
                {t('cpuProfile.clipped')}
              </p>
            )}
          </section>
          <section className="space-y-3 rounded-md border p-3">
            <h2 className="font-semibold">{t('cpuProfile.callTree')}</h2>
            <nav
              aria-label={t('cpuProfile.path')}
              className="flex flex-wrap items-center gap-1"
            >
              {path.map((node) => (
                <Button
                  key={node.id}
                  variant={node.id === focus ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => zoom(node.id)}
                >
                  {profile.functions[node.functionIndex]!.name}
                </Button>
              ))}
            </nav>
            <p className="break-all font-mono text-xs">{source(selected)}</p>
            <p className="text-sm">{label(selected)}</p>
            {selectedFunction && selectedFunction.nodeIds.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const ids = selectedFunction.nodeIds;
                  zoom(ids[(ids.indexOf(selected.id) + 1) % ids.length]!);
                }}
              >
                {t('cpuProfile.nextOccurrence', {
                  count: selectedFunction.nodeIds.length,
                })}
              </Button>
            )}
            <div className="flex max-h-48 flex-wrap gap-2 overflow-auto">
              {childIds
                .slice(childPage * PAGE_SIZE, (childPage + 1) * PAGE_SIZE)
                .map((id) => (
                  <Button
                    key={id}
                    variant="outline"
                    size="sm"
                    onClick={() => zoom(id)}
                  >
                    {profile.functions[nodes.get(id)!.functionIndex]!.name} ·{' '}
                    {ms(nodes.get(id)!.total)} ms
                  </Button>
                ))}
            </div>
            {childPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={childPage === 0}
                  onClick={() => setChildPage(childPage - 1)}
                >
                  {t('cpuProfile.previous')}
                </Button>
                <span className="text-sm">
                  {childPage + 1} / {childPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={childPage + 1 === childPages}
                  onClick={() => setChildPage(childPage + 1)}
                >
                  {t('cpuProfile.next')}
                </Button>
              </div>
            )}
          </section>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">
                {t('cpuProfile.functions', { count: matches.length })}
              </h2>
              <Label htmlFor="cpu-sort">{t('cpuProfile.sort')}</Label>
              <Select
                value={sort}
                onValueChange={(value) => {
                  setQuery({ sort: value });
                  setPage(0);
                }}
              >
                <SelectTrigger id="cpu-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">{t('cpuProfile.self')}</SelectItem>
                  <SelectItem value="total">{t('cpuProfile.total')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('cpuProfile.function')}</TableHead>
                  <TableHead>{t('cpuProfile.self')}</TableHead>
                  <TableHead>{t('cpuProfile.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches
                  .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                  .map((fn) => (
                    <TableRow key={fn.key}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="max-w-96 justify-start truncate"
                          onClick={() =>
                            zoom(
                              fn.nodeIds.reduce(
                                (best, id) =>
                                  nodes.get(id)!.total > nodes.get(best)!.total
                                    ? id
                                    : best,
                                fn.nodeIds[0]!,
                              ),
                            )
                          }
                        >
                          {fn.name}
                        </Button>
                        <p
                          className="max-w-96 truncate text-xs text-muted-foreground"
                          title={fn.url}
                        >
                          {fn.url}
                          {fn.line > 0 && `:${fn.line}`}
                        </p>
                      </TableCell>
                      <TableCell>
                        {ms(fn.self)} ms{' '}
                        <span className="text-muted-foreground">
                          ({percentage(fn.self)})
                        </span>
                      </TableCell>
                      <TableCell>
                        {ms(fn.total)} ms{' '}
                        <span className="text-muted-foreground">
                          ({percentage(fn.total)})
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                {t('cpuProfile.previous')}
              </Button>
              <span className="text-sm">
                {currentPage + 1} / {pages}
              </span>
              <Button
                variant="outline"
                disabled={currentPage + 1 >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                {t('cpuProfile.next')}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
