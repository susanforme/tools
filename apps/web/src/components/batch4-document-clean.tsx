import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StringParam,
  NumberParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { cleanTable, parseCleanupCsv } from '@/lib/batch4-document-data';
import { downloadBlob } from '@/lib/download';
import { csvFile } from '@/lib/organizer-tools';
import { ChoiceField } from './calculator-ui';
import { PracticalText, useLatestJob } from './practical-ui';
import { Button } from './ui/button';
import { DocumentError } from './batch4-document-ui';
export function TableCleaner() {
  const { t } = useTranslation();
  const [source, setSource] = useState(
    'name,date,city\nAlice,2026/9/23,New York\nalice,2026.09.23,New-York\nBob,2026-09-24,',
  );
  const [history, setHistory] = useState<
    { rows: string[][]; action: string }[]
  >([]);
  const [query, setQuery] = useQueryParams<{
    op: string;
    col: number;
    other: number;
  }>({ op: StringParam, col: NumberParam, other: NumberParam });
  const op = query.op ?? 'dedup';
  const col = query.col ?? 0,
    other = query.other ?? 1;
  const [value, setValue] = useState(' ');
  const [error, setError] = useState<string | null>(null);
  const load = useLatestJob<string[][]>(source);
  const rows = history.at(-1)?.rows ?? load.result;
  const apply = () => {
    try {
      if (!rows) throw new Error('table');
      setHistory([
        ...history,
        {
          rows: cleanTable(rows, { operation: op, column: col, other, value }),
          action: op,
        },
      ]);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('batch4Documents.cleanLimit')}
      </p>
      <PracticalText
        multiline
        label="CSV"
        value={source}
        onChange={(v) => {
          setSource(v);
          setHistory([]);
          setError(null);
        }}
        maxLength={500000}
      />
      <Button
        disabled={load.busy}
        onClick={() => {
          setHistory([]);
          void load.run(async () => {
            const data = await parseCleanupCsv(source);
            if (
              data.length < 2 ||
              data.some((row) => row.length !== data[0].length)
            )
              throw new Error('table');
            return data;
          });
        }}
      >
        {t('batch4Documents.load')}
      </Button>
      {rows && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <ChoiceField
              label={t('batch4Documents.operation')}
              value={op}
              options={[
                'dedup',
                'split',
                'merge',
                'fill',
                'trim',
                'date',
                'cluster',
              ].map((value) => ({
                value,
                label: t(`batch4Documents.${value}`),
              }))}
              onChange={(op) => setQuery({ op })}
            />
            <ChoiceField
              label={t('batch4Documents.column')}
              value={String(col)}
              options={rows[0].map((label, index) => ({
                value: String(index),
                label: label || String(index + 1),
              }))}
              onChange={(v) => setQuery({ col: +v })}
            />
            {op === 'merge' && (
              <ChoiceField
                label={t('batch4Documents.otherColumn')}
                value={String(other)}
                options={rows[0].map((label, index) => ({
                  value: String(index),
                  label: label || String(index + 1),
                }))}
                onChange={(v) => setQuery({ other: +v })}
              />
            )}
          </div>
          {['split', 'merge', 'fill'].includes(op) && (
            <PracticalText
              label={t(
                op === 'fill'
                  ? 'batch4Documents.fillValue'
                  : 'batch4Documents.separator',
              )}
              value={value}
              onChange={setValue}
              maxLength={100}
            />
          )}
          <p className="text-sm text-muted-foreground">
            {t(`batch4Documents.${op}Hint`, { defaultValue: '' })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={history.length >= 30} onClick={apply}>
              {t('batch4Documents.apply')}
            </Button>
            <Button
              variant="outline"
              disabled={!history.length}
              onClick={() => {
                setHistory(history.slice(0, -1));
                setError(null);
              }}
            >
              {t('batch4Documents.undo')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([csvFile(rows)], { type: 'text/csv;charset=utf-8' }),
                  'cleaned.csv',
                )
              }
            >
              {t('batch4Documents.exportCsv')}
            </Button>
          </div>
          <p className="text-sm">
            {t('batch4Documents.rowCount', { count: rows.length - 1 })}
          </p>
          <div className="max-h-96 overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {rows[0].map((cell, index) => (
                    <th key={index} className="border-b p-2 text-left">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1, 101).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="max-w-64 break-words border-b p-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="list-inside list-decimal text-sm">
            {history.map((entry, i) => (
              <li key={i}>
                {t(`batch4Documents.${entry.action}`)} · {entry.rows.length - 1}
              </li>
            ))}
          </ol>
        </>
      )}
      <DocumentError error={error ?? load.error} />
    </div>
  );
}
