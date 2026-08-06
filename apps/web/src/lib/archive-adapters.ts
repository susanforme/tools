import {
  MAX_7Z_INPUT_BYTES,
  MAX_ARCHIVE_ENTRIES,
  MAX_EXTRACTED_BYTES,
  type ArchiveFormat,
} from './archive';
import type { FileSystem } from '7z-wasm';

type AdapterFile = {
  data: Uint8Array;
  directory: boolean;
  name: string;
};

export type ArchiveAdapter = {
  readonly format: ArchiveFormat;
  readonly supportsMultipleFiles: boolean;
  compress(files: AdapterFile[]): Promise<Uint8Array>;
  decompress(source: Uint8Array, sourceName: string): Promise<AdapterFile[]>;
};

function safePath(path: string): string {
  const parts = path
    .replaceAll('\\', '/')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .map((part) => part.replaceAll('\0', '_'));
  return parts.join('/') || 'file';
}

function singleFile(files: AdapterFile[]): AdapterFile {
  if (files.length !== 1 || files[0]!.directory) {
    throw new Error('SINGLE_FILE_ONLY');
  }
  return files[0]!;
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function removeSuffix(name: string, suffixes: readonly string[]): string {
  const lower = name.toLowerCase();
  const suffix = suffixes.find((item) => lower.endsWith(item));
  return suffix ? name.slice(0, -suffix.length) || 'file' : `${name}.out`;
}

function assertZipOutputLimit(source: Uint8Array): void {
  const view = new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength,
  );
  const minimum = Math.max(0, source.byteLength - 65_557);
  let end = -1;
  for (let offset = source.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error('INVALID_ARCHIVE');

  const count = view.getUint16(end + 10, true);
  const centralOffset = view.getUint32(end + 16, true);
  if (count === 0xffff || count > MAX_ARCHIVE_ENTRIES) {
    throw new Error('ARCHIVE_TOO_LARGE');
  }

  let offset = centralOffset;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (
      offset + 46 > source.byteLength ||
      view.getUint32(offset, true) !== 0x02014b50
    ) {
      throw new Error('INVALID_ARCHIVE');
    }
    const size = view.getUint32(offset + 24, true);
    if (size === 0xffffffff) throw new Error('ARCHIVE_TOO_LARGE');
    total += size;
    if (total > MAX_EXTRACTED_BYTES) throw new Error('ARCHIVE_TOO_LARGE');
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
}

class ZipArchiveAdapter implements ArchiveAdapter {
  readonly format = 'zip';
  readonly supportsMultipleFiles = true;

  async compress(files: AdapterFile[]): Promise<Uint8Array> {
    const { zipSync } = await import('fflate');
    const entries: Record<string, Uint8Array> = {};
    files.forEach((file, index) => {
      let name = safePath(file.name);
      if (file.directory) name += '/';
      while (entries[name]) name = `${index + 1}-${name}`;
      entries[name] = file.data;
    });
    return zipSync(entries, { level: 6 });
  }

  async decompress(source: Uint8Array): Promise<AdapterFile[]> {
    assertZipOutputLimit(source);
    const { unzipSync } = await import('fflate');
    return Object.entries(unzipSync(source)).map(([name, data]) => ({
      data,
      directory: name.endsWith('/'),
      name: safePath(name),
    }));
  }
}

abstract class SingleStreamArchiveAdapter implements ArchiveAdapter {
  abstract readonly format: 'gzip' | 'deflate';
  readonly supportsMultipleFiles = false;

  abstract compress(files: AdapterFile[]): Promise<Uint8Array>;
  abstract decompress(
    source: Uint8Array,
    sourceName: string,
  ): Promise<AdapterFile[]>;

  protected collect(
    createStream: (onData: (chunk: Uint8Array, final: boolean) => void) => {
      push(source: Uint8Array, final: boolean): void;
    },
    source: Uint8Array,
  ): Uint8Array {
    const chunks: Uint8Array[] = [];
    let total = 0;
    const stream = createStream((chunk) => {
      total += chunk.byteLength;
      if (total > MAX_EXTRACTED_BYTES) throw new Error('ARCHIVE_TOO_LARGE');
      chunks.push(chunk.slice());
    });
    stream.push(source, true);
    return concatChunks(chunks, total);
  }
}

class GzipArchiveAdapter extends SingleStreamArchiveAdapter {
  readonly format = 'gzip';

  async compress(files: AdapterFile[]): Promise<Uint8Array> {
    const { gzipSync } = await import('fflate');
    return gzipSync(singleFile(files).data, { level: 6 });
  }

  async decompress(
    source: Uint8Array,
    sourceName: string,
  ): Promise<AdapterFile[]> {
    const { Gunzip } = await import('fflate');
    return [
      {
        name: removeSuffix(sourceName, ['.gzip', '.gz']),
        data: this.collect((onData) => new Gunzip(onData), source),
        directory: false,
      },
    ];
  }
}

class DeflateArchiveAdapter extends SingleStreamArchiveAdapter {
  readonly format = 'deflate';

  async compress(files: AdapterFile[]): Promise<Uint8Array> {
    const { deflateSync } = await import('fflate');
    return deflateSync(singleFile(files).data, { level: 6 });
  }

  async decompress(
    source: Uint8Array,
    sourceName: string,
  ): Promise<AdapterFile[]> {
    const { Inflate } = await import('fflate');
    return [
      {
        name: removeSuffix(sourceName, ['.deflate']),
        data: this.collect((onData) => new Inflate(onData), source),
        directory: false,
      },
    ];
  }
}

function removeTree(fs: FileSystem, path: string): void {
  for (const name of fs.readdir(path)) {
    if (name === '.' || name === '..') continue;
    const child = `${path}/${name}`;
    if (fs.isDir(fs.stat(child).mode)) removeTree(fs, child);
    else fs.unlink(child);
  }
  fs.rmdir(path);
}

function readSevenZipFiles(
  fs: FileSystem,
  directory: string,
  relative = '',
  state: { files: AdapterFile[]; total: number } = { files: [], total: 0 },
): AdapterFile[] {
  for (const name of fs.readdir(directory)) {
    if (name === '.' || name === '..') continue;
    const path = `${directory}/${name}`;
    const nextRelative = relative ? `${relative}/${name}` : name;
    if (fs.isDir(fs.stat(path).mode)) {
      if (state.files.length >= MAX_ARCHIVE_ENTRIES) {
        throw new Error('ARCHIVE_TOO_LARGE');
      }
      state.files.push({
        data: new Uint8Array(),
        directory: true,
        name: safePath(nextRelative),
      });
      readSevenZipFiles(fs, path, nextRelative, state);
    } else {
      if (state.files.length >= MAX_ARCHIVE_ENTRIES) {
        throw new Error('ARCHIVE_TOO_LARGE');
      }
      const data = fs.readFile(path).slice();
      state.total += data.byteLength;
      if (state.total > MAX_EXTRACTED_BYTES) {
        throw new Error('ARCHIVE_TOO_LARGE');
      }
      state.files.push({
        data,
        directory: false,
        name: safePath(nextRelative),
      });
    }
  }
  return state.files;
}

function ensureSevenZipDirectory(fs: FileSystem, root: string, path: string) {
  let current = root;
  for (const part of path.split('/').filter(Boolean)) {
    current = `${current}/${part}`;
    try {
      fs.stat(current);
    } catch {
      fs.mkdir(current);
    }
  }
}

class SevenZipArchiveAdapter implements ArchiveAdapter {
  readonly format = '7z';
  readonly supportsMultipleFiles = true;

  async createModule(logs: string[]) {
    const { default: createSevenZip } = await import('7z-wasm');
    return createSevenZip({
      print: (line) => logs.push(line),
      printErr: (line) => logs.push(line),
    });
  }

  run(
    module: Awaited<ReturnType<SevenZipArchiveAdapter['createModule']>>,
    args: string[],
  ) {
    const exitCode = module.callMain(args) as unknown as number;
    if (typeof exitCode === 'number' && exitCode !== 0) {
      throw new Error('INVALID_ARCHIVE');
    }
  }

  async compress(files: AdapterFile[]): Promise<Uint8Array> {
    const inputSize = files.reduce(
      (total, file) => total + file.data.byteLength,
      0,
    );
    if (inputSize > MAX_7Z_INPUT_BYTES) throw new Error('ARCHIVE_TOO_LARGE');
    const logs: string[] = [];
    const module = await this.createModule(logs);
    const root = `/job-${crypto.randomUUID()}`;
    const input = `${root}/input`;
    module.FS.mkdir(root);
    module.FS.mkdir(input);
    try {
      files.forEach((file) => {
        const name = safePath(file.name);
        const parts = name.split('/');
        if (file.directory) {
          ensureSevenZipDirectory(module.FS, input, name);
          return;
        }
        ensureSevenZipDirectory(module.FS, input, parts.slice(0, -1).join('/'));
        module.FS.writeFile(`${input}/${name}`, file.data);
      });
      module.FS.chdir(input);
      this.run(module, ['a', '-t7z', '-mx=5', '../archive.7z', '.']);
      return module.FS.readFile(`${root}/archive.7z`).slice();
    } finally {
      module.FS.chdir('/');
      removeTree(module.FS, root);
    }
  }

  async decompress(source: Uint8Array): Promise<AdapterFile[]> {
    if (source.byteLength > MAX_7Z_INPUT_BYTES) {
      throw new Error('ARCHIVE_TOO_LARGE');
    }
    const logs: string[] = [];
    const module = await this.createModule(logs);
    const root = `/job-${crypto.randomUUID()}`;
    const output = `${root}/output`;
    module.FS.mkdir(root);
    module.FS.mkdir(output);
    module.FS.writeFile(`${root}/archive.7z`, source);
    try {
      module.FS.chdir(root);
      this.run(module, ['l', '-slt', 'archive.7z']);
      const sizes = logs.flatMap((line) => {
        const match = /^Size = (\d+)$/.exec(line.trim());
        return match ? [Number(match[1])] : [];
      });
      if (
        sizes.length > MAX_ARCHIVE_ENTRIES ||
        sizes.reduce((total, size) => total + size, 0) > MAX_EXTRACTED_BYTES
      ) {
        throw new Error('ARCHIVE_TOO_LARGE');
      }
      logs.length = 0;
      this.run(module, ['x', '-y', 'archive.7z', '-ooutput']);
      return readSevenZipFiles(module.FS, output);
    } finally {
      module.FS.chdir('/');
      removeTree(module.FS, root);
    }
  }
}

const ADAPTERS: Record<ArchiveFormat, ArchiveAdapter> = {
  zip: new ZipArchiveAdapter(),
  gzip: new GzipArchiveAdapter(),
  deflate: new DeflateArchiveAdapter(),
  '7z': new SevenZipArchiveAdapter(),
};

export function getArchiveAdapter(format: ArchiveFormat): ArchiveAdapter {
  return ADAPTERS[format];
}
