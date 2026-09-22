import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParam } from '../hooks/useQueryParams';
import { useBoundedWorker } from '../hooks/use-bounded-worker';
import type {
  ImportKind,
  ImportRequest,
  ImportResult,
} from '../lib/performance-import.worker';
import ImportResultsTable from './import-results-table';
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
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
const createWorker = () =>
  new Worker(new URL('../lib/performance-import.worker.ts', import.meta.url), {
    type: 'module',
  });
const EXAMPLES = {
  coverage: JSON.stringify(
    [
      {
        url: 'https://example.com/app.js',
        text: 'function used() {}\nfunction unused() {}\nused();',
        ranges: [
          { start: 0, end: 18 },
          { start: 39, end: 46 },
        ],
      },
    ],
    null,
    2,
  ),
  react: JSON.stringify(
    {
      version: 5,
      dataForRoots: [
        {
          rootID: 1,
          displayName: 'App',
          snapshots: [
            [2, { displayName: 'List' }],
            [3, { displayName: 'Row' }],
          ],
          commitData: [
            {
              duration: 12,
              timestamp: 0,
              fiberActualDurations: [
                [2, 12],
                [3, 5],
              ],
              fiberSelfDurations: [
                [2, 7],
                [3, 5],
              ],
            },
            {
              duration: 3,
              timestamp: 100,
              fiberActualDurations: [[3, 3]],
              fiberSelfDurations: [[3, 3]],
            },
          ],
        },
      ],
    },
    null,
    2,
  ),
  ax: JSON.stringify(
    {
      nodes: [
        {
          nodeId: '1',
          role: { value: 'RootWebArea' },
          name: { value: 'Example' },
          ignored: false,
          childIds: ['2'],
        },
        {
          nodeId: '2',
          parentId: '1',
          role: { value: 'button' },
          name: { value: 'Save' },
          ignored: false,
          properties: [{ name: 'focusable', value: { value: true } }],
        },
      ],
    },
    null,
    2,
  ),
  pprof: '',
};
export default function PerformanceImportPanel({ kind }: { kind: ImportKind }) {
  const { t } = useTranslation();
  const tr = (key: string) => t(`performanceImport.${key}`);
  const [input, setInput] = useState(EXAMPLES[kind]),
    [comparison, setComparison] = useState('');
  const [bytes, setBytes] = useState<Uint8Array | null>(null),
    [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null),
    [reading, setReading] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useQueryParam<string>(
    'reportView',
    StringParam,
    'summary',
  );
  const [metric, setMetric] = useState<number | null>(null);
  const generation = useRef(0);
  const { result, error, busy, run, clear, cancel } = useBoundedWorker<
    ImportRequest,
    ImportResult
  >(createWorker, 15000);
  const upload = async (file: File | undefined, second = false) => {
    if (!file) return;
    const id = ++generation.current;
    clear();
    setFileError(null);
    setReading(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('sizeLimit');
      if (kind === 'pprof') {
        const data = new Uint8Array(await file.arrayBuffer());
        if (id === generation.current) {
          setBytes(data);
          setFileName(file.name);
        }
      } else {
        const text = await file.text();
        if (id === generation.current) {
          if (second) setComparison(text);
          else setInput(text);
        }
      }
    } catch (cause) {
      if (id === generation.current) setFileError((cause as Error).message);
    } finally {
      if (id === generation.current) setReading(false);
    }
  };
  const filter = (value: string) =>
    value.toLowerCase().includes(search.toLowerCase());
  const failed = error ?? fileError;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{tr(`${kind}Hint`)}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${kind}-upload`}>{tr('file')}</Label>
          <Input
            id={`${kind}-upload`}
            type="file"
            accept={
              kind === 'pprof' ? '.pb,.gz,.pprof,.prof,.profile' : '.json'
            }
            disabled={reading || busy}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          {fileName && <p className="text-sm">{fileName}</p>}
          {kind !== 'pprof' && (
            <Textarea
              aria-label={tr('input')}
              value={input}
              onChange={(e) => {
                clear();
                setInput(e.target.value);
              }}
              className="min-h-48 font-mono text-xs"
            />
          )}
        </div>
        {kind === 'coverage' && (
          <div className="space-y-2">
            <Label htmlFor="coverage-compare">{tr('compareFile')}</Label>
            <Input
              id="coverage-compare"
              type="file"
              accept=".json"
              disabled={reading || busy}
              onChange={(e) => void upload(e.target.files?.[0], true)}
            />
            <Textarea
              aria-label={tr('compareFile')}
              value={comparison}
              onChange={(e) => {
                clear();
                setComparison(e.target.value);
              }}
              className="min-h-48 font-mono text-xs"
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            reading || busy || (kind === 'pprof' ? !bytes : !input.trim())
          }
          onClick={() => {
            setMetric(null);
            run({ kind, text: input, comparison, bytes });
          }}
        >
          {tr(reading || busy ? 'loading' : 'analyze')}
        </Button>
        {busy && (
          <Button variant="outline" onClick={cancel}>
            {tr('cancel')}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            generation.current++;
            clear();
            setInput('');
            setComparison('');
            setBytes(null);
            setFileName('');
            setFileError(null);
            setReading(false);
          }}
        >
          {tr('clear')}
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {tr('failed')}：
          {t(`performanceImport.errors.${failed}`, { defaultValue: failed })}
        </p>
      )}
      {result && (
        <>
          <Input
            aria-label={tr('search')}
            placeholder={tr('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {result.kind === 'coverage' && (
            <>
              <p className="text-sm text-muted-foreground">
                {tr('coverageUnits')}
              </p>
              <ImportResultsTable
                headers={[
                  tr('url'),
                  tr('total'),
                  tr('used'),
                  tr('unused'),
                  tr('ratio'),
                  tr('details'),
                ]}
                rows={result.files
                  .filter((row) => filter(row.url))
                  .map((row) => [
                    row.url,
                    row.total ?? '—',
                    row.used,
                    row.unused ?? '—',
                    row.total
                      ? `${((100 * row.used) / row.total).toFixed(2)}%`
                      : '—',
                    <details>
                      <summary className="cursor-pointer">
                        {tr('unusedRanges')} ({row.uncovered.length})
                      </summary>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                        {row.uncovered
                          .slice(0, 100)
                          .map(
                            (range) =>
                              `[${range.start}, ${range.end})\n${row.text?.slice(range.start, Math.min(range.end, range.start + 1000))}`,
                          )
                          .join('\n\n')}
                      </pre>
                      {row.uncovered.length > 100 && (
                        <p>{tr('previewLimit')}</p>
                      )}
                    </details>,
                  ])}
              />
              {result.comparison && (
                <>
                  <h2 className="font-semibold">{tr('comparison')}</h2>
                  <ImportResultsTable
                    headers={[
                      tr('url'),
                      tr('status'),
                      tr('beforeUnused'),
                      tr('afterUnused'),
                      tr('delta'),
                    ]}
                    rows={result.comparison
                      .filter((row) => filter(row.url))
                      .map((row) => [
                        row.url,
                        tr(row.status),
                        row.before ?? '—',
                        row.after ?? '—',
                        row.delta ?? '—',
                      ])}
                  />
                </>
              )}
            </>
          )}
          {result.kind === 'react' && (
            <>
              <Tabs value={view} onValueChange={setView}>
                <TabsList>
                  <TabsTrigger value="summary">{tr('components')}</TabsTrigger>
                  <TabsTrigger value="commits">{tr('commits')}</TabsTrigger>
                </TabsList>
              </Tabs>
              {result.data.unnamed > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('performanceImport.unnamed', {
                    count: result.data.unnamed,
                  })}
                </p>
              )}
              {view === 'commits' ? (
                <ImportResultsTable
                  headers={[
                    tr('root'),
                    '#',
                    tr('timestamp'),
                    tr('duration'),
                    tr('effects'),
                    tr('passive'),
                    tr('components'),
                  ]}
                  rows={result.data.commits
                    .filter((row) => filter(row.root))
                    .map((row) => [
                      row.root,
                      row.index,
                      row.timestamp.toFixed(3),
                      row.duration.toFixed(3),
                      row.effects.toFixed(3),
                      row.passive.toFixed(3),
                      row.fibers,
                    ])}
                />
              ) : (
                <ImportResultsTable
                  headers={[
                    tr('component'),
                    'ID',
                    tr('renders'),
                    tr('selfMs'),
                    tr('totalMs'),
                    tr('maxMs'),
                  ]}
                  rows={result.data.fibers
                    .filter((row) => filter(`${row.name} ${row.id}`))
                    .map((row) => [
                      row.name,
                      row.id,
                      row.renders,
                      row.self.toFixed(3),
                      row.total.toFixed(3),
                      row.max.toFixed(3),
                    ])}
                />
              )}
            </>
          )}
          {result.kind === 'ax' && (
            <ImportResultsTable
              headers={[
                'ID',
                tr('parent'),
                tr('depth'),
                tr('role'),
                tr('name'),
                tr('ignored'),
                tr('properties'),
              ]}
              rows={result.nodes
                .filter((row) =>
                  filter(`${row.id} ${row.role} ${row.name} ${row.properties}`),
                )
                .map((row) => [
                  row.id,
                  row.parent ?? '—',
                  row.depth,
                  row.role,
                  <span title={row.description}>{row.name}</span>,
                  tr(row.ignored ? 'yes' : 'no'),
                  row.properties,
                ])}
            />
          )}
          {result.kind === 'pprof' &&
            (() => {
              const selected = metric ?? result.data.defaultMetric;
              const current = result.data.metrics[selected]!;
              const sorted = [...result.data.rows].sort((a, b) =>
                BigInt(a.self[selected]!) > BigInt(b.self[selected]!)
                  ? -1
                  : BigInt(a.self[selected]!) < BigInt(b.self[selected]!)
                    ? 1
                    : 0,
              );
              return (
                <>
                  <Select
                    value={String(selected)}
                    onValueChange={(v) => setMetric(Number(v))}
                  >
                    <SelectTrigger aria-label={tr('metric')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {result.data.metrics.map((m, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {m.name} ({m.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p>
                    {tr('samples')}: {result.data.samples} · {tr('total')}:{' '}
                    {current.total} {current.unit}
                  </p>
                  <ImportResultsTable
                    headers={[
                      tr('function'),
                      tr('file'),
                      tr('self'),
                      tr('inclusive'),
                    ]}
                    rows={sorted
                      .filter((row) => filter(`${row.name} ${row.file}`))
                      .map((row) => [
                        row.name,
                        row.file,
                        row.self[selected],
                        row.total[selected],
                      ])}
                  />
                  <details>
                    <summary className="cursor-pointer">{tr('stacks')}</summary>
                    <ImportResultsTable
                      headers={[tr('stacks'), current.unit]}
                      rows={result.data.stacks
                        .filter((row) => filter(row.names.join(' ')))
                        .map((row) => [
                          row.names.join(' → '),
                          row.values[selected],
                        ])}
                    />
                  </details>
                </>
              );
            })()}
        </>
      )}
    </div>
  );
}
