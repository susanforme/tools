import { FileDropzone } from '@/components/file-dropzone';
import { analyzeBundleFiles, type BundleEntry } from '@/lib/developer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/bundle-inspector')({
  component: BundleInspectorPage,
});

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function BundleInspectorPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<BundleEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const total = useMemo(
    () => entries.reduce((sum, item) => sum + item.size, 0),
    [entries],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('bundleInspector.title')}</h1>
      <FileDropzone
        multiple
        accept=".map,.js,.css,.wasm"
        onFiles={(files) => {
          setError(null);
          void analyzeBundleFiles(files.map(({ file }) => file))
            .then(setEntries)
            .catch((cause: unknown) =>
              setError(
                t('bundleInspector.failed', { msg: (cause as Error).message }),
              ),
            );
        }}
        className="flex min-h-40 items-center justify-center rounded-lg p-6"
      >
        <div className="text-center text-sm text-muted-foreground">
          <Upload className="mx-auto mb-2 h-6 w-6" />
          {t('bundleInspector.drop')}
        </div>
      </FileDropzone>
      <div className="space-y-2">
        {entries.map((entry) => {
          const percentage = total === 0 ? 0 : (entry.size / total) * 100;
          return (
            <div
              key={`${entry.name}-${entry.size}`}
              className="rounded-lg border p-3"
            >
              <div className="mb-2 flex justify-between gap-3 text-sm">
                <span className="truncate font-mono">{entry.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatBytes(entry.size)} · {percentage.toFixed(1)}%
                </span>
              </div>
              <progress
                max={100}
                value={percentage}
                className="h-2 w-full accent-primary"
              />
            </div>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
