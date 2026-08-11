import { FileDropzone, type DroppedFile } from '@/components/file-dropzone';
import { NumberField } from '@/components/calculator-ui';
import { FileSplitMergePanel } from '@/components/recommended-tool-panels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { renamedFileName, sha256, type RenameOptions } from '@/lib/batch-files';
import { downloadBytes } from '@/lib/download';
import { createFileRoute } from '@tanstack/react-router';
import { Download, Files, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/batch-files')({
  component: BatchFilesPage,
});

function BatchFilesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<'rename' | 'split'>(
    'tab',
    StringParam,
    'rename',
  );
  const [files, setFiles] = useState<DroppedFile[]>([]);
  const [options, setOptions] = useState<RenameOptions>({
    extension: '',
    find: '',
    prefix: '',
    replace: '',
    start: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = <Key extends keyof RenameOptions>(
    key: Key,
    value: RenameOptions[Key],
  ) => setOptions((current) => ({ ...current, [key]: value }));

  const download = async () => {
    setLoading(true);
    setError(null);
    try {
      const hashes = await Promise.all(files.map(({ file }) => sha256(file)));
      const entries: Record<string, Uint8Array<ArrayBuffer>> = {};
      for (let index = 0; index < files.length; index += 1) {
        entries[renamedFileName(files[index]!.file.name, index, options)] =
          new Uint8Array(await files[index]!.file.arrayBuffer());
      }
      entries['SHA256SUMS.txt'] = new TextEncoder().encode(
        hashes
          .map(
            (hash, index) =>
              `${hash}  ${renamedFileName(files[index]!.file.name, index, options)}`,
          )
          .join('\n'),
      );
      entries['files.json'] = new TextEncoder().encode(
        JSON.stringify(
          files.map(({ file }, index) => ({
            name: renamedFileName(file.name, index, options),
            originalName: file.name,
            size: file.size,
            type: file.type,
            sha256: hashes[index],
          })),
          null,
          2,
        ),
      );
      const { zipSync } = await import('fflate');
      downloadBytes(zipSync(entries), 'renamed-files.zip', 'application/zip');
    } catch (cause) {
      setError(t('batchFiles.error', { msg: (cause as Error).message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('batchFiles.title')}</h1>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as 'rename' | 'split')}
      >
        <TabsList>
          <TabsTrigger value="rename">{t('batchFiles.rename')}</TabsTrigger>
          <TabsTrigger value="split">{t('recommended.splitMerge')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'split' ? (
        <FileSplitMergePanel />
      ) : (
        <>
          <FileDropzone
            multiple
            onFiles={setFiles}
            className="flex min-h-36 items-center justify-center rounded-xl p-6 text-center"
          >
            <div>
              <Files className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
              {t('batchFiles.drop')}
            </div>
          </FileDropzone>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <TextField
              label={t('batchFiles.prefix')}
              value={options.prefix}
              onChange={(value) => update('prefix', value)}
            />
            <NumberField
              label={t('batchFiles.start')}
              value={options.start}
              min={0}
              step={1}
              onChange={(value) => update('start', value)}
            />
            <TextField
              label={t('batchFiles.find')}
              value={options.find}
              onChange={(value) => update('find', value)}
            />
            <TextField
              label={t('batchFiles.replace')}
              value={options.replace}
              onChange={(value) => update('replace', value)}
            />
            <TextField
              label={t('batchFiles.extension')}
              value={options.extension}
              onChange={(value) => update('extension', value)}
            />
          </div>
          {!!files.length && (
            <div className="divide-y rounded-xl border">
              {files.map(({ file }, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-2"
                >
                  <span className="truncate text-muted-foreground">
                    {file.name}
                  </span>
                  <span className="truncate font-medium">
                    {renamedFileName(file.name, index, options)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}
          <Button
            disabled={!files.length || loading}
            onClick={() => void download()}
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('batchFiles.download')}
          </Button>
        </>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
