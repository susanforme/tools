export type ArchiveFormat = 'zip' | 'gzip' | 'deflate' | '7z';

export type ArchiveInputFile = {
  directory: boolean;
  name: string;
  data: ArrayBuffer;
};

export type ExtractedArchiveFile = {
  directory: boolean;
  name: string;
  data: ArrayBuffer;
  size: number;
};

export type ArchiveWorkerRequest =
  | {
      type: 'compress';
      format: ArchiveFormat;
      files: ArchiveInputFile[];
    }
  | {
      type: 'decompress';
      format: ArchiveFormat;
      fileName: string;
      data: ArrayBuffer;
    };

export type ArchiveWorkerResponse =
  | {
      ok: true;
      type: 'compressed';
      data: ArrayBuffer;
    }
  | {
      ok: true;
      type: 'decompressed';
      files: ExtractedArchiveFile[];
    }
  | { ok: false; error: string };

export const MAX_ARCHIVE_INPUT_BYTES = 64 * 1024 * 1024;
export const MAX_COMPRESS_INPUT_BYTES = 128 * 1024 * 1024;
export const MAX_7Z_INPUT_BYTES = 64 * 1024 * 1024;
export const MAX_EXTRACTED_BYTES = 128 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 2_000;

export function detectArchiveFormat(file: File): ArchiveFormat | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip')) return 'zip';
  if (name.endsWith('.7z')) return '7z';
  if (name.endsWith('.gz') || name.endsWith('.gzip')) return 'gzip';
  if (name.endsWith('.deflate')) return 'deflate';
  return null;
}
