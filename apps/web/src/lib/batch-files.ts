export type RenameOptions = {
  extension: string;
  find: string;
  prefix: string;
  replace: string;
  start: number;
};

export function renamedFileName(
  original: string,
  index: number,
  options: RenameOptions,
): string {
  const dot = original.lastIndexOf('.');
  const stem = dot > 0 ? original.slice(0, dot) : original;
  const originalExtension = dot > 0 ? original.slice(dot + 1) : '';
  const replaced = options.find
    ? stem.replaceAll(options.find, options.replace)
    : stem;
  const extension =
    options.extension.trim().replace(/^\./, '') || originalExtension;
  const numbered = `${options.prefix}${options.start + index}-${replaced}`;
  return extension ? `${numbered}.${extension}` : numbered;
}

export async function sha256(file: Blob): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
