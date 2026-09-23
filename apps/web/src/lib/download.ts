export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

export function downloadBytes(
  bytes: Uint8Array,
  name: string,
  type = 'application/octet-stream',
): void {
  downloadBlob(new Blob([new Uint8Array(bytes)], { type }), name);
}
