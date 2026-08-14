import { db } from './db';

export type StoredDataUsage = {
  totalBytes: number;
  opfsBytes: number;
  recordBytes: number;
};

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('DELETE_FAILED'));
    request.onblocked = () => reject(new Error('DELETE_BLOCKED'));
  });
}

export async function clearStoredRecords(): Promise<void> {
  db.close();
  let cleared = false;
  try {
    const names = new Set<string>([db.name]);
    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      for (const database of databases) {
        if (database.name) names.add(database.name);
      }
    }
    await Promise.all([...names].map(deleteDatabase));
    cleared = true;
  } finally {
    if (cleared) await db.open();
  }
}

export async function clearDirectoryContents(
  directory: FileSystemDirectoryHandle,
): Promise<void> {
  for await (const [name] of directory.entries()) {
    await directory.removeEntry(name, { recursive: true });
  }
}

export async function getDirectorySize(
  directory: FileSystemDirectoryHandle,
): Promise<number> {
  let size = 0;
  for await (const [, entry] of directory.entries()) {
    size +=
      entry.kind === 'file'
        ? (await entry.getFile()).size
        : await getDirectorySize(entry);
  }
  return size;
}

export async function getStoredDataUsage(): Promise<StoredDataUsage> {
  const estimate = await navigator.storage?.estimate?.();
  let opfsBytes = 0;
  if (typeof navigator.storage?.getDirectory === 'function') {
    opfsBytes = await getDirectorySize(await navigator.storage.getDirectory());
  }
  const totalBytes = Math.max(estimate?.usage ?? 0, opfsBytes);
  return {
    totalBytes,
    opfsBytes,
    recordBytes: Math.max(0, totalBytes - opfsBytes),
  };
}

export async function clearStoredFiles(): Promise<void> {
  if (typeof navigator.storage?.getDirectory !== 'function') return;
  await clearDirectoryContents(await navigator.storage.getDirectory());
}
