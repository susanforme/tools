import { cn } from '@/lib/utils';
import { useState, type ReactNode } from 'react';

export type DroppedFile = { file: File; path: string };

type FileDropzoneProps = {
  accept?: string;
  children: ReactNode;
  className?: string;
  directory?: boolean;
  dropDirectories?: boolean;
  disabled?: boolean;
  multiple?: boolean;
  onFiles: (files: DroppedFile[]) => void;
};

function readFileEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function readEntry(
  entry: FileSystemEntry,
  parent = '',
): Promise<DroppedFile[]> {
  const path = parent ? `${parent}/${entry.name}` : entry.name;
  if (entry.isFile) {
    return [{ file: await readFileEntry(entry as FileSystemFileEntry), path }];
  }
  if (!entry.isDirectory) return [];

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children: FileSystemEntry[] = [];
  while (true) {
    const batch = await readDirectoryEntries(reader);
    if (batch.length === 0) break;
    children.push(...batch);
  }
  return (
    await Promise.all(children.map((child) => readEntry(child, path)))
  ).flat();
}

async function readDroppedFiles(
  dataTransfer: DataTransfer,
  includeDirectories: boolean,
): Promise<DroppedFile[]> {
  if (includeDirectories) {
    const entries = Array.from(dataTransfer.items)
      .map((item) => item.webkitGetAsEntry())
      .filter((entry): entry is FileSystemEntry => entry !== null);
    if (entries.length > 0) {
      return (
        await Promise.all(entries.map((entry) => readEntry(entry)))
      ).flat();
    }
  }
  return Array.from(dataTransfer.files, (file) => ({ file, path: file.name }));
}

export function FileDropzone({
  accept,
  children,
  className,
  directory = false,
  dropDirectories = directory,
  disabled = false,
  multiple = false,
  onFiles,
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      className={cn(
        'cursor-pointer border-2 border-dashed transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void readDroppedFiles(event.dataTransfer, dropDirectories).then(
          onFiles,
        );
      }}
    >
      {children}
      <input
        ref={(element) => {
          if (element) element.webkitdirectory = directory;
        }}
        type="file"
        accept={accept}
        multiple={multiple || directory}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [], (file) => ({
            file,
            path: file.webkitRelativePath || file.name,
          }));
          if (files.length > 0) onFiles(files);
          event.target.value = '';
        }}
      />
    </label>
  );
}
