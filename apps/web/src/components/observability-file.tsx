import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { REPORT_MAX_BYTES } from '@/lib/observability-report';
import { FileDropzone } from './file-dropzone';
import { Button } from './ui/button';
const createWorker = (): Worker =>
  new Worker(
    new URL('../workers/observability-report.worker.ts', import.meta.url),
    { type: 'module' },
  );
export function useReportFile<Result>(
  kind: 'lighthouse' | 'otel' | 'explain' | 'rrweb',
) {
  const task = useBoundedWorker<{ kind: typeof kind; file: File }, Result>(
    createWorker,
    20_000,
  );
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = (file: File): void => {
    task.clear();
    setError(null);
    setName(file.name);
    if (file.size > REPORT_MAX_BYTES) setError('sizeLimit');
    else task.run({ kind, file });
  };
  return {
    ...task,
    name,
    error: error ?? task.error,
    load,
    clear: (): void => {
      task.clear();
      setError(null);
      setName('');
    },
  };
}
export function ReportFileInput({
  task,
  label,
  sample,
}: {
  task: ReturnType<typeof useReportFile<unknown>>;
  label: string;
  sample?: unknown;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 space-y-2">
      <FileDropzone
        accept=".json"
        className="block rounded-md p-4 text-sm break-all"
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
              task.load(
                new File([JSON.stringify(sample)], 'example.json', {
                  type: 'application/json',
                }),
              )
            }
          >
            {t('observability.sample')}
          </Button>
        )}
        {task.busy ? (
          <Button size="sm" variant="outline" onClick={task.cancel}>
            {t('observability.cancel')}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={task.clear}>
            {t('observability.clear')}
          </Button>
        )}
      </div>
      {task.busy && (
        <p role="status" className="text-sm">
          {t('observability.loading')}
        </p>
      )}
      {task.error && (
        <p role="alert" className="break-all text-sm text-destructive">
          {t('observability.failed', {
            message: t(`observability.errors.${task.error}`, {
              defaultValue: task.error,
            }),
          })}
        </p>
      )}
    </div>
  );
}
