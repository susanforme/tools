import { ArchiveFileBrowser } from '@/components/archive-file-browser';
import { FileDropzone, type DroppedFile } from '@/components/file-dropzone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import {
  detectArchiveFormat,
  MAX_7Z_INPUT_BYTES,
  MAX_ARCHIVE_INPUT_BYTES,
  MAX_COMPRESS_INPUT_BYTES,
  MAX_EXTRACTED_BYTES,
  type ArchiveFormat,
  type ArchiveWorkerRequest,
  type ArchiveWorkerResponse,
  type ExtractedArchiveFile,
} from '@/lib/archive';
import {
  addArchiveFiles,
  archiveTreeEntries,
  createArchiveTree,
  extractedFilesToTree,
} from '@/lib/archive-tree';
import { createFileRoute } from '@tanstack/react-router';
import {
  Archive as ArchiveIcon,
  Download,
  FileArchive,
  LoaderCircle,
  PackageOpen,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/archive')({ component: ArchivePage });

type ArchiveTab = 'compress' | 'decompress';
type CompressedResult = { url: string; name: string; size: number };

const FORMATS = ['zip', 'gzip', 'deflate', '7z'] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function runArchiveWorker(
  request: ArchiveWorkerRequest,
): Promise<ArchiveWorkerResponse> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/archive.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (event: MessageEvent<ArchiveWorkerResponse>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('WORKER_FAILED'));
    };
    const transfers =
      request.type === 'compress'
        ? request.files.map((file) => file.data)
        : [request.data];
    worker.postMessage(request, transfers);
  });
}

function outputName(format: ArchiveFormat, firstFile?: File): string {
  if (format === 'zip' || format === '7z') return `archive.${format}`;
  const name = firstFile?.name ?? 'archive';
  return `${name}.${format === 'gzip' ? 'gz' : 'deflate'}`;
}

function downloadBytes(data: ArrayBuffer, name: string): void {
  const url = URL.createObjectURL(new Blob([data]));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url));
}

function ArchivePage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    tab: ArchiveTab;
    format: ArchiveFormat;
  }>({ tab: StringParam, format: StringParam });
  const tab: ArchiveTab =
    query.tab === 'decompress' ? 'decompress' : 'compress';
  const format: ArchiveFormat = FORMATS.includes(query.format as ArchiveFormat)
    ? (query.format as ArchiveFormat)
    : 'zip';
  const [nodes, setNodes] = useState(createArchiveTree);
  const [archive, setArchive] = useState<File | null>(null);
  const [compressed, setCompressed] = useState<CompressedResult | null>(null);
  const [extracted, setExtracted] = useState<ExtractedArchiveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entries = archiveTreeEntries(nodes);
  const inputFiles = entries.filter((entry) => !entry.directory);
  const streamCompatible = entries.length === 1 && inputFiles.length === 1;
  const extractedTree = useMemo(
    () => extractedFilesToTree(extracted),
    [extracted],
  );

  useEffect(
    () => () => {
      if (compressed) URL.revokeObjectURL(compressed.url);
    },
    [compressed],
  );

  useEffect(() => {
    if (!streamCompatible && (format === 'gzip' || format === 'deflate')) {
      setQuery({ format: 'zip' });
    }
  }, [format, setQuery, streamCompatible]);

  const resetResults = () => {
    if (compressed) URL.revokeObjectURL(compressed.url);
    setCompressed(null);
    setExtracted([]);
    setError(null);
  };

  const selectFiles = (selected: DroppedFile[]) => {
    resetResults();
    const next = addArchiveFiles(nodes, selected);
    const nextEntries = archiveTreeEntries(next);
    const total = nextEntries.reduce((sum, entry) => sum + entry.size, 0);
    if (total > MAX_COMPRESS_INPUT_BYTES) {
      setError(t('archive.tooLarge'));
      return;
    }
    setNodes(next);
    if (
      (format === 'gzip' || format === 'deflate') &&
      nextEntries.length !== 1
    ) {
      setQuery({ format: 'zip' });
    }
  };

  const selectArchive = (selected: File) => {
    resetResults();
    if (selected.size > MAX_ARCHIVE_INPUT_BYTES) {
      setError(t('archive.archiveTooLarge'));
      return;
    }
    if (!detectArchiveFormat(selected)) {
      setError(t('archive.unsupported'));
      return;
    }
    setArchive(selected);
  };

  const compress = async () => {
    if (inputFiles.length === 0) return;
    const total = inputFiles.reduce((sum, entry) => sum + entry.size, 0);
    if (format === '7z' && total > MAX_7Z_INPUT_BYTES) {
      setError(t('archive.sevenZipTooLarge'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const request: ArchiveWorkerRequest = {
        type: 'compress',
        format,
        files: await Promise.all(
          entries.map(async (entry) => ({
            data: entry.directory
              ? new ArrayBuffer(0)
              : await entry.file!.arrayBuffer(),
            directory: entry.directory,
            name: entry.path,
          })),
        ),
      };
      const response = await runArchiveWorker(request);
      if (!response.ok) throw new Error(response.error);
      if (response.type !== 'compressed') throw new Error('INVALID_RESULT');
      const name = outputName(format, inputFiles[0]?.file);
      const blob = new Blob([response.data], {
        type: format === 'zip' ? 'application/zip' : 'application/octet-stream',
      });
      setCompressed({ url: URL.createObjectURL(blob), name, size: blob.size });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(
        t(
          message === 'SINGLE_FILE_ONLY'
            ? 'archive.singleFileOnly'
            : message === 'ARCHIVE_TOO_LARGE'
              ? 'archive.outputTooLarge'
              : 'archive.failed',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const decompress = async () => {
    if (!archive) return;
    const archiveFormat = detectArchiveFormat(archive);
    if (!archiveFormat) return;
    setLoading(true);
    setError(null);
    try {
      const response = await runArchiveWorker({
        type: 'decompress',
        format: archiveFormat,
        fileName: archive.name,
        data: await archive.arrayBuffer(),
      });
      if (!response.ok) throw new Error(response.error);
      if (response.type !== 'decompressed') throw new Error('INVALID_RESULT');
      setExtracted(response.files);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(
        t(
          message === 'ARCHIVE_TOO_LARGE'
            ? 'archive.outputTooLarge'
            : 'archive.failed',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadAll = async () => {
    const files = extracted.filter((file) => !file.directory);
    if (files.length === 0) return;
    if (files.length === 1 && extracted.length === 1) {
      downloadBytes(files[0]!.data.slice(0), files[0]!.name);
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      const response = await runArchiveWorker({
        type: 'compress',
        format: 'zip',
        files: extracted.map((file) => ({
          data: file.data.slice(0),
          directory: file.directory,
          name: file.name,
        })),
      });
      if (!response.ok || response.type !== 'compressed') {
        throw new Error('DOWNLOAD_FAILED');
      }
      downloadBytes(response.data, 'extracted-files.zip');
    } catch {
      setError(t('archive.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <ArchiveIcon className="h-6 w-6 text-amber-500" />
        {t('archive.title')}
      </h1>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setQuery({ tab: value as ArchiveTab });
          resetResults();
        }}
      >
        <TabsList>
          <TabsTrigger value="compress">{t('archive.compress')}</TabsTrigger>
          <TabsTrigger value="decompress">
            {t('archive.decompress')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {tab === 'compress' ? (
        <>
          <ArchiveFileBrowser
            editable
            nodes={nodes}
            setNodes={(update) => {
              resetResults();
              setNodes(update);
            }}
            onFiles={selectFiles}
          />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Select
              value={format}
              onValueChange={(value) => {
                setQuery({ format: value as ArchiveFormat });
                resetResults();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((item) => (
                  <SelectItem
                    key={item}
                    value={item}
                    disabled={
                      !streamCompatible &&
                      (item === 'gzip' || item === 'deflate')
                    }
                  >
                    {item === 'gzip' ? 'GZIP' : item.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={compress}
              disabled={loading || inputFiles.length === 0}
            >
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileArchive className="h-4 w-4" />
              )}
              {t('archive.createArchive')}
            </Button>
          </div>
          {compressed && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
              <div>
                <p className="font-medium">{compressed.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatBytes(compressed.size)}
                </p>
              </div>
              <Button asChild>
                <a href={compressed.url} download={compressed.name}>
                  <Download className="h-4 w-4" />
                  {t('archive.download')}
                </a>
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <FileDropzone
            accept=".zip,.gz,.gzip,.deflate,.7z"
            onFiles={(files) => {
              const selected = files[0]?.file;
              if (selected) selectArchive(selected);
            }}
            className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl bg-muted/20 p-6"
          >
            <PackageOpen className="h-8 w-8 text-amber-500" />
            <span className="text-sm font-medium">
              {archive?.name ?? t('archive.selectArchive')}
            </span>
            {archive && (
              <Badge variant="secondary">{formatBytes(archive.size)}</Badge>
            )}
          </FileDropzone>
          <Button onClick={decompress} disabled={loading || !archive}>
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {t('archive.extract')}
          </Button>
          {extracted.length > 0 && (
            <ArchiveFileBrowser
              nodes={extractedTree}
              busy={downloading}
              onDownloadAll={() => void downloadAll()}
              onDownloadFile={(node) => {
                if (node.data) downloadBytes(node.data.slice(0), node.name);
              }}
            />
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {t('archive.limitHint', {
          input: formatBytes(MAX_COMPRESS_INPUT_BYTES),
          sevenZip: formatBytes(MAX_7Z_INPUT_BYTES),
          archive: formatBytes(MAX_ARCHIVE_INPUT_BYTES),
          output: formatBytes(MAX_EXTRACTED_BYTES),
        })}
      </p>
    </div>
  );
}
