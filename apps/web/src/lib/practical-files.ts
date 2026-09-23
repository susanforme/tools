import { sha256 } from './batch-files';
export interface LocalFile {
  file: File;
  path: string;
}
export interface FileRecord {
  path: string;
  size: number;
  hash: string;
}
export interface FileChange {
  path: string;
  status: 'same' | 'added' | 'removed' | 'modified';
  before: number;
  after: number;
}
export interface DuplicateGroup {
  hash: string;
  size: number;
  paths: string[];
}
export function relativeFiles(
  files: LocalFile[],
  stripRoot: boolean,
): LocalFile[] {
  if (
    files.length > 1000 ||
    files.some(({ file }) => file.size > 100 * 1024 ** 2) ||
    files.reduce((sum, { file }) => sum + file.size, 0) > 1024 ** 3
  )
    throw new Error('fileLimit');
  const paths = new Set<string>();
  return files.map(({ file, path }) => {
    const parts = path.replaceAll('\\', '/').split('/');
    if (parts.some((part) => !part || part === '.' || part === '..'))
      throw new Error('invalid');
    const relative = (
      stripRoot && parts.length > 1 ? parts.slice(1) : parts
    ).join('/');
    if (paths.has(relative)) throw new Error('invalid');
    paths.add(relative);
    return { file, path: relative };
  });
}
export async function fileManifest(
  files: LocalFile[],
  stripRoot: boolean,
): Promise<FileRecord[]> {
  const entries = relativeFiles(files, stripRoot);
  const output: FileRecord[] = [];
  for (const entry of entries)
    output.push({
      path: entry.path,
      size: entry.file.size,
      hash: await sha256(entry.file),
    });
  return output;
}
export function compareManifests(
  before: FileRecord[],
  after: FileRecord[],
): FileChange[] {
  const a = new Map(before.map((file) => [file.path, file]));
  const b = new Map(after.map((file) => [file.path, file]));
  return [...new Set([...a.keys(), ...b.keys()])].sort().map((path) => {
    const first = a.get(path),
      second = b.get(path);
    return {
      path,
      status: !first
        ? 'added'
        : !second
          ? 'removed'
          : first.hash === second.hash && first.size === second.size
            ? 'same'
            : 'modified',
      before: first?.size ?? 0,
      after: second?.size ?? 0,
    };
  });
}
export function duplicateGroups(files: FileRecord[]): DuplicateGroup[] {
  const groups = new Map<string, DuplicateGroup>();
  for (const file of files) {
    const key = `${file.hash}:${file.size}`;
    const group = groups.get(key) ?? {
      hash: file.hash,
      size: file.size,
      paths: [],
    };
    group.paths.push(file.path);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter(({ paths }) => paths.length > 1)
    .sort(
      (a, b) => b.size * (b.paths.length - 1) - a.size * (a.paths.length - 1),
    );
}
export const TEXT_ENCODINGS = [
  'utf-8',
  'gb18030',
  'big5',
  'shift_jis',
  'utf-16le',
  'utf-16be',
  'windows-1252',
] as const;
export async function convertTextEncoding(
  bytes: Uint8Array,
  source: string,
  target: string,
  bom: boolean,
  lineEnding: string,
): Promise<{ text: string; bytes: Uint8Array }> {
  if (
    bytes.length > 5 * 1024 ** 2 ||
    !TEXT_ENCODINGS.includes(source as (typeof TEXT_ENCODINGS)[number]) ||
    !TEXT_ENCODINGS.includes(target as (typeof TEXT_ENCODINGS)[number]) ||
    !['keep', 'lf', 'crlf'].includes(lineEnding)
  )
    throw new Error('invalid');
  if (bom && !target.startsWith('utf-')) throw new Error('invalid');
  let text: string;
  try {
    text = new TextDecoder(source, { fatal: true }).decode(bytes);
  } catch {
    throw new Error('replacement');
  }
  if (lineEnding !== 'keep')
    text = text.replace(/\r\n|\r|\n/g, lineEnding === 'lf' ? '\n' : '\r\n');
  const { default: iconv } = await import('iconv-lite');
  const encoded = iconv.encode(text, target, { addBOM: bom });
  if (iconv.decode(encoded, target) !== text) throw new Error('replacement');
  return { text, bytes: new Uint8Array(encoded) };
}
export type FileTask =
  | { kind: 'compare'; before: LocalFile[]; after: LocalFile[] }
  | { kind: 'duplicates'; files: LocalFile[] }
  | {
      kind: 'encoding';
      file: File;
      source: string;
      target: string;
      bom: boolean;
      lineEnding: string;
    };
export type FileTaskResult =
  | { kind: 'compare'; changes: FileChange[] }
  | { kind: 'duplicates'; groups: DuplicateGroup[] }
  | { kind: 'encoding'; text: string; bytes: Uint8Array };
export async function processFileTask(task: FileTask): Promise<FileTaskResult> {
  if (task.kind === 'compare')
    return {
      kind: 'compare',
      changes: compareManifests(
        await fileManifest(task.before, true),
        await fileManifest(task.after, true),
      ),
    };
  if (task.kind === 'duplicates')
    return {
      kind: 'duplicates',
      groups: duplicateGroups(await fileManifest(task.files, false)),
    };
  if (task.file.size > 5 * 1024 ** 2) throw new Error('fileLimit');
  return {
    kind: 'encoding',
    ...(await convertTextEncoding(
      new Uint8Array(await task.file.arrayBuffer()),
      task.source,
      task.target,
      task.bom,
      task.lineEnding,
    )),
  };
}
