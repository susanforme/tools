import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportFileInput, useReportFile } from './observability-file';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { rowEstimateRatio, type ExplainReport } from '@/lib/postgres-explain';
const SAMPLE = [
  {
    Plan: {
      'Node Type': 'Nested Loop',
      'Total Cost': 150,
      'Plan Rows': 10,
      'Actual Rows': 100,
      'Actual Total Time': 12,
      'Actual Loops': 1,
      Plans: [
        {
          'Node Type': 'Seq Scan',
          'Relation Name': 'users',
          'Plan Rows': 10,
          'Actual Rows': 10,
          'Actual Total Time': 2,
          'Actual Loops': 1,
        },
        {
          'Node Type': 'Index Scan',
          'Index Name': 'orders_user_id',
          'Plan Rows': 1,
          'Actual Rows': 10,
          'Actual Total Time': 0.8,
          'Actual Loops': 10,
        },
      ],
    },
    'Planning Time': 0.7,
    'Execution Time': 12.3,
  },
];
export default function PostgresExplainPanel() {
  const { t } = useTranslation();
  const task = useReportFile<ExplainReport>('explain');
  const [statement, setStatement] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const current =
    task.result?.statements[statement] ?? task.result?.statements[0];
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil((current?.nodes.length ?? 0) / 100) - 1),
  );
  const detail = current?.nodes.find((node) => node.id === selected);
  return (
    <div className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('postgresExplain.description')}
      </p>
      <ReportFileInput
        task={task}
        label={t('postgresExplain.upload')}
        sample={SAMPLE}
      />
      <p className="text-xs text-muted-foreground">
        {t('postgresExplain.limits')}
      </p>
      {task.result && (
        <div className="flex flex-wrap gap-2">
          {task.result.statements.map((item) => (
            <Button
              key={item.index}
              size="sm"
              variant={
                item.index === (current?.index ?? 0) ? 'default' : 'outline'
              }
              onClick={() => {
                setStatement(item.index);
                setPage(0);
                setSelected(null);
              }}
            >
              {t('postgresExplain.statement', { index: item.index + 1 })}
            </Button>
          ))}
        </div>
      )}
      {current && (
        <>
          <p className="text-sm">
            {t('postgresExplain.timing', {
              planning: current.planning ?? '—',
              execution: current.execution ?? '—',
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('postgresExplain.semantics')}
          </p>
          <div className="min-w-0 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    'node',
                    'estimated',
                    'actual',
                    'ratio',
                    'loops',
                    'time',
                    'total',
                  ].map((key) => (
                    <TableHead key={key}>
                      {t(`postgresExplain.${key}`)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.nodes
                  .slice(currentPage * 100, currentPage * 100 + 100)
                  .map((node) => (
                    <TableRow key={node.id}>
                      <TableCell className="min-w-64 max-w-96 whitespace-normal break-all">
                        <Button
                          variant="link"
                          className="h-auto whitespace-normal text-left"
                          onClick={() => setSelected(node.id)}
                        >
                          <span className="text-muted-foreground">
                            {'│ '.repeat(Math.min(node.depth, 12))}
                            {node.depth ? '↳ ' : ''}
                          </span>
                          {node.type}
                        </Button>
                        <p className="text-xs">
                          {node.id} {node.parent && `← ${node.parent}`} ·{' '}
                          {node.relation}
                        </p>
                      </TableCell>
                      <TableCell>{node.plannedRows ?? '—'}</TableCell>
                      <TableCell>{node.actualRows ?? '—'}</TableCell>
                      <TableCell>{rowEstimateRatio(node)}</TableCell>
                      <TableCell>{node.loops ?? '—'}</TableCell>
                      <TableCell>{node.time ?? '—'}</TableCell>
                      <TableCell>
                        {node.totalTime == null
                          ? '—'
                          : Number(node.totalTime.toFixed(3))}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              {t('observability.previous')}
            </Button>
            <span>
              {currentPage + 1} /{' '}
              {Math.max(1, Math.ceil(current.nodes.length / 100))}
            </span>
            <Button
              variant="outline"
              disabled={(currentPage + 1) * 100 >= current.nodes.length}
              onClick={() => setPage(currentPage + 1)}
            >
              {t('observability.next')}
            </Button>
          </div>
          {detail && (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md border p-4 text-xs">
              {detail.details}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
