import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
export default function ImportResultsTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const page = Math.min(offset, Math.max(0, Math.ceil(rows.length / 100) - 1));
  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h, i) => (
              <TableHead key={i}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(page * 100, page * 100 + 100).map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell
                  key={j}
                  className="max-w-lg whitespace-pre-wrap break-all align-top"
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center gap-3 text-sm">
        <span>{t('performanceImport.count', { count: rows.length })}</span>
        {rows.length > 100 && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={!page}
              onClick={() => setOffset(page - 1)}
            >
              {t('performanceImport.previous')}
            </Button>
            <span>
              {page + 1} / {Math.ceil(rows.length / 100)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * 100 >= rows.length}
              onClick={() => setOffset(page + 1)}
            >
              {t('performanceImport.next')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
