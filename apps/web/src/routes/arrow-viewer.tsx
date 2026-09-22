import { createFileRoute } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import type { ArrowPreview } from '../lib/arrow-viewer';
import { downloadBlob } from '../lib/download';
export const Route = createFileRoute('/arrow-viewer')({ component: ArrowPage });
function ArrowPage() {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<ArrowPreview | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const load = async (file: File | null, sample = false) => {
    const version = ++generation.current;
    setPreview(null);
    setPage(0);
    setError(null);
    setLoading(false);
    if (!file && !sample) return;
    setLoading(true);
    try {
      if (file && file.size > 50 * 1024 * 1024)
        throw new Error(
          t('dataTools.arrowFileLimit', {
            defaultValue: '文件不能超过 50 MiB',
          }),
        );
      let bytes: Uint8Array;
      if (file) bytes = new Uint8Array(await file.arrayBuffer());
      else {
        const { tableFromArrays, tableToIPC } = await import('apache-arrow');
        bytes = tableToIPC(
          tableFromArrays({ name: ['Alice', 'Bob'], score: [95, 88] }),
          'file',
        );
      }
      const { inspectArrow } = await import('../lib/arrow-viewer');
      const result = await inspectArrow(bytes);
      if (version === generation.current) setPreview(result);
    } catch (cause) {
      if (version === generation.current)
        setError(
          t('dataTools.failed', {
            defaultValue: '处理失败：{{message}}',
            message: (cause as Error).message,
          }),
        );
    } finally {
      if (version === generation.current) setLoading(false);
    }
  };
  const pages = Math.max(1, Math.ceil((preview?.rows.length ?? 0) / 50));
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">
        {t('dataTools.arrowTitle', {
          defaultValue: 'Arrow IPC / Feather 查看器',
        })}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t('dataTools.arrowLimit', {
          defaultValue:
            '最多 50 MiB，预览与导出前 10000 行。支持未压缩 IPC 文件/流；不支持 Feather v1、LZ4/Zstd 压缩批次。大整数导出为字符串。',
        })}
      </p>
      <Label htmlFor="arrow-file">
        {t('dataTools.arrowFile', {
          defaultValue: '选择 Arrow IPC / Feather 文件',
        })}
      </Label>
      <Input
        id="arrow-file"
        type="file"
        accept=".arrow,.ipc,.feather"
        onChange={(event) => {
          void load(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
      <Button
        variant="outline"
        disabled={loading}
        onClick={() => load(null, true)}
      >
        {t('dataTools.sample', { defaultValue: '填入示例' })}
      </Button>
      {loading && (
        <p role="status">
          {t('dataTools.processing', { defaultValue: '处理中…' })}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {preview && (
        <>
          <p role="status">
            {t('dataTools.arrowSummary', {
              defaultValue:
                '共 {{rows}} 行，预览 {{loaded}} 行，{{batches}} 个批次',
              rows: preview.rowCount,
              loaded: preview.rows.length,
              batches: preview.batches.length,
            })}
          </p>
          <details className="rounded-md border p-3">
            <summary>
              {t('dataTools.schema', { defaultValue: 'Schema 与批次' })}
            </summary>
            <pre className="mt-3 max-h-80 overflow-auto text-xs">
              {JSON.stringify(
                { schema: preview.schema, batches: preview.batches },
                null,
                2,
              )}
            </pre>
          </details>
          <div className="flex flex-wrap gap-2">
            {(['json', 'csv'] as const).map((format) => (
              <Button
                key={format}
                variant="outline"
                onClick={() =>
                  downloadBlob(
                    new Blob([preview[format]], {
                      type:
                        format === 'json'
                          ? 'application/json'
                          : 'text/csv;charset=utf-8',
                    }),
                    `arrow-preview.${format}`,
                  )
                }
              >
                {t('dataTools.export', {
                  defaultValue: '导出 {{format}}',
                  format: format.toUpperCase(),
                })}
              </Button>
            ))}
          </div>
          <div className="max-h-[520px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {preview.columns.map((column, index) => (
                    <TableHead key={index}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows
                  .slice(page * 50, (page + 1) * 50)
                  .map((row, index) => (
                    <TableRow key={index}>
                      {row.map((cell, column) => (
                        <TableCell
                          key={column}
                          className="max-w-96 truncate font-mono text-xs"
                          title={cell}
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              {t('dataTools.previous', { defaultValue: '上一页' })}
            </Button>
            <span>
              {page + 1} / {pages}
            </span>
            <Button
              variant="outline"
              disabled={page + 1 >= pages}
              onClick={() => setPage(page + 1)}
            >
              {t('dataTools.next', { defaultValue: '下一页' })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
