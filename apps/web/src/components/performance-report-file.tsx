import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { PERFORMANCE_MAX_BYTES } from '@/lib/performance-reports';
import { FileDropzone } from './file-dropzone';
import { Button } from './ui/button';
const createWorker = (): Worker =>
  new Worker(
    new URL('../workers/performance-reports.worker.ts', import.meta.url),
    { type: 'module' },
  );
export function usePerformanceReport<Result>(
  kind: 'heap' | 'trace' | 'netlog' | 'playwright',
) {
  const task = useBoundedWorker<{ kind: typeof kind; file: File }, Result>(
    createWorker,
    30_000,
  );
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = (file: File): void => {
    task.clear();
    setError(null);
    setName(file.name);
    if (file.size > PERFORMANCE_MAX_BYTES) setError('sizeLimit');
    else task.run({ kind, file });
  };
  return {
    ...task,
    name,
    load,
    error: error ?? task.error,
    clear: (): void => {
      task.clear();
      setError(null);
      setName('');
    },
  };
}
export function PerformanceReportFile({
  task,
  label,
  accept = '.json',
  sample,
}: {
  task: ReturnType<typeof usePerformanceReport<unknown>>;
  label: string;
  accept?: string;
  sample?: unknown;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 space-y-2">
      <FileDropzone
        accept={accept}
        className="block break-all rounded-md p-4 text-sm"
        onFiles={(files) => {
          if (files[0]) task.load(files[0].file);
        }}
      >
        {task.name || label}
      </FileDropzone>
      <div className="flex flex-wrap gap-2">
        {sample !== undefined && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              task.load(new File([JSON.stringify(sample)], 'example.json'))
            }
          >
            {t('performanceReports.sample')}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={task.busy ? task.cancel : task.clear}
        >
          {t(
            task.busy
              ? 'performanceReports.cancel'
              : 'performanceReports.clear',
          )}
        </Button>
      </div>
      {task.busy && (
        <p role="status" className="text-sm">
          {t('performanceReports.loading')}
        </p>
      )}
      {task.error && (
        <p role="alert" className="break-all text-sm text-destructive">
          {t('performanceReports.failed', {
            message: t(`performanceReports.errors.${task.error}`, {
              defaultValue: task.error,
            }),
          })}
        </p>
      )}
    </div>
  );
}
export function ReportPagination({
  page,
  count,
  onPage,
}: {
  page: number;
  count: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        {t('performanceReports.previous')}
      </Button>
      <span className="text-sm">
        {page + 1} / {Math.max(1, Math.ceil(count / 100))} · {count}
      </span>
      <Button
        variant="outline"
        disabled={(page + 1) * 100 >= count}
        onClick={() => onPage(page + 1)}
      >
        {t('performanceReports.next')}
      </Button>
    </div>
  );
}
