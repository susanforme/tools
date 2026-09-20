import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PerformanceReportFile,
  ReportPagination,
  usePerformanceReport,
} from '@/components/performance-report-file';
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
  compareHeapGroups,
  heapReferences,
  type HeapReport,
} from '@/lib/heap-snapshot';
export const Route = createFileRoute('/heap-snapshot')({ component: HeapPage });
const SAMPLE = {
  snapshot: {
    meta: {
      node_fields: ['type', 'name', 'id', 'self_size', 'edge_count'],
      node_types: [
        ['synthetic', 'object', 'string'],
        'string',
        'number',
        'number',
        'number',
      ],
      edge_fields: ['type', 'name_or_index', 'to_node'],
      edge_types: [['property', 'element', 'weak'], 'string_or_number', 'node'],
    },
    node_count: 3,
    edge_count: 2,
  },
  nodes: [0, 0, 1, 0, 1, 1, 1, 3, 32, 1, 2, 2, 5, 24, 0],
  edges: [0, 3, 5, 0, 4, 10],
  strings: ['root', 'Example', 'hello', 'instance', 'message'],
};
function HeapPage() {
  const { t } = useTranslation();
  const before = usePerformanceReport<HeapReport>('heap'),
    after = usePerformanceReport<HeapReport>('heap');
  const [query, setQuery] = useQueryParams<{
    search: string;
    side: string;
    direction: string;
  }>({ search: StringParam, side: StringParam, direction: StringParam });
  const [page, setPage] = useState(0),
    [instancePage, setInstancePage] = useState(0),
    [referencePage, setReferencePage] = useState(0);
  const [group, setGroup] = useState<string | null>(null),
    [nodeIndex, setNodeIndex] = useState<number | null>(null);
  const groups = useMemo(
    () => compareHeapGroups(before.result, after.result),
    [before.result, after.result],
  );
  const filtered = groups.filter((group) =>
    `${group.name} ${group.type}`
      .toLowerCase()
      .includes((query.search ?? '').toLowerCase()),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 100) - 1),
  );
  const report =
    query.side === 'before' ? before.result : (after.result ?? before.result);
  const instances = useMemo(
    () =>
      report?.nodes.flatMap((node, index) =>
        node.group === group ? [index] : [],
      ) ?? [],
    [report, group],
  );
  const currentInstances = Math.min(
    instancePage,
    Math.max(0, Math.ceil(instances.length / 100) - 1),
  );
  const node = nodeIndex === null ? null : report?.nodes[nodeIndex];
  const direction = query.direction === 'incoming' ? 'incoming' : 'outgoing';
  const refs =
    report && nodeIndex !== null
      ? heapReferences(report, nodeIndex, direction, referencePage)
      : { total: 0, rows: [] };
  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('heapSnapshot.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('heapSnapshot.description')}
      </p>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <PerformanceReportFile
          task={before}
          label={t('heapSnapshot.before')}
          accept=".json,.heapsnapshot"
          sample={SAMPLE}
        />
        <PerformanceReportFile
          task={after}
          label={t('heapSnapshot.after')}
          accept=".json,.heapsnapshot"
          sample={{
            ...SAMPLE,
            nodes: [0, 0, 1, 0, 1, 1, 1, 3, 64, 1, 2, 2, 5, 24, 0],
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t('heapSnapshot.limits')}
      </p>
      <p className="text-sm text-muted-foreground">
        {t('heapSnapshot.shallow')}
      </p>
      {(before.result || after.result) && (
        <>
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            {[before.result, after.result].map((report, i) => (
              <p key={i}>
                {t(i === 0 ? 'heapSnapshot.before' : 'heapSnapshot.after')}:{' '}
                {report
                  ? t('heapSnapshot.summary', {
                      nodes: report.nodes.length,
                      edges: report.edgeCount,
                      bytes: report.totalSize.toLocaleString(),
                    })
                  : '—'}
              </p>
            ))}
          </div>
          <Label htmlFor="heap-search">{t('heapSnapshot.search')}</Label>
          <Input
            id="heap-search"
            value={query.search ?? ''}
            onChange={(event) => {
              setQuery({ search: event.target.value });
              setPage(0);
            }}
          />
          <div className="min-w-0 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    'constructor',
                    'beforeCount',
                    'afterCount',
                    'deltaCount',
                    'beforeSize',
                    'afterSize',
                    'deltaSize',
                  ].map((key) => (
                    <TableHead key={key}>{t(`heapSnapshot.${key}`)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered
                  .slice(currentPage * 100, currentPage * 100 + 100)
                  .map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="min-w-44 max-w-72 whitespace-normal break-all">
                        <Button
                          variant="link"
                          className="h-auto whitespace-normal text-left"
                          onClick={() => {
                            setGroup(row.key);
                            setNodeIndex(null);
                            setInstancePage(0);
                          }}
                        >
                          {row.name.slice(0, 500)}
                        </Button>
                        <p className="text-xs">{row.type}</p>
                      </TableCell>
                      <TableCell>
                        {before.result ? row.beforeCount : '—'}
                      </TableCell>
                      <TableCell>
                        {after.result ? row.afterCount : '—'}
                      </TableCell>
                      <TableCell>
                        {before.result && after.result ? row.deltaCount : '—'}
                      </TableCell>
                      <TableCell>
                        {before.result ? row.beforeSize.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        {after.result ? row.afterSize.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        {before.result && after.result
                          ? row.deltaSize.toLocaleString()
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <ReportPagination
            page={currentPage}
            count={filtered.length}
            onPage={setPage}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Label>{t('heapSnapshot.inspect')}</Label>
            <Select
              value={query.side ?? 'after'}
              onValueChange={(side) => {
                setQuery({ side });
                setNodeIndex(null);
                setInstancePage(0);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">
                  {t('heapSnapshot.before')}
                </SelectItem>
                <SelectItem value="after">
                  {t('heapSnapshot.afterFallback')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {group && (
            <>
              <h2 className="font-semibold">{t('heapSnapshot.instances')}</h2>
              <div className="min-w-0 overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>{t('heapSnapshot.name')}</TableHead>
                      <TableHead>Shallow bytes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instances
                      .slice(
                        currentInstances * 100,
                        currentInstances * 100 + 100,
                      )
                      .map((index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Button
                              variant="link"
                              onClick={() => {
                                setNodeIndex(index);
                                setReferencePage(0);
                              }}
                            >
                              @{report!.nodes[index].id}
                            </Button>
                          </TableCell>
                          <TableCell className="max-w-96 whitespace-normal break-all">
                            {report!.nodes[index].name.slice(0, 2000)}
                          </TableCell>
                          <TableCell>{report!.nodes[index].size}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              <ReportPagination
                page={currentInstances}
                count={instances.length}
                onPage={setInstancePage}
              />
            </>
          )}
          {node && (
            <section className="min-w-0 space-y-3 rounded-md border p-4">
              <h2 className="break-all font-semibold">
                @{node.id} · {node.name.slice(0, 2000)}
              </h2>
              <Select
                value={direction}
                onValueChange={(direction) => {
                  setQuery({ direction });
                  setReferencePage(0);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outgoing">
                    {t('heapSnapshot.outgoing')}
                  </SelectItem>
                  <SelectItem value="incoming">
                    {t('heapSnapshot.incoming')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="min-w-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('heapSnapshot.edge')}</TableHead>
                      <TableHead>{t('heapSnapshot.target')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refs.rows.map((ref, index) => (
                      <TableRow key={index}>
                        <TableCell className="max-w-64 whitespace-normal break-all">
                          {ref.type}: {ref.name.slice(0, 2000)}
                        </TableCell>
                        <TableCell className="max-w-80 whitespace-normal break-all">
                          <Button
                            variant="link"
                            className="h-auto whitespace-normal"
                            onClick={() => {
                              setNodeIndex(ref.node);
                              setReferencePage(0);
                            }}
                          >
                            @{report!.nodes[ref.node].id}{' '}
                            {report!.nodes[ref.node].name.slice(0, 500)}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ReportPagination
                page={referencePage}
                count={refs.total}
                onPage={setReferencePage}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
