import { api } from '@/lib/api';
import { db } from '@/lib/db';
import {
  assertSessionActive,
  type OptionalAuthOperation,
} from '@/lib/optional-auth';

async function readLocalFavorites(): Promise<string[]> {
  const rows = await db.favorites.orderBy('sortOrder').toArray();
  return rows.map((row) => row.toolPath);
}

async function toggleLocalFavorite(path: string): Promise<string[]> {
  const existing = await db.favorites.where('toolPath').equals(path).first();
  if (existing) {
    await db.favorites.delete(existing.id!);
  } else {
    const last = await db.favorites.orderBy('sortOrder').last();
    await db.favorites.add({
      addedAt: Date.now(),
      sortOrder: (last?.sortOrder ?? -1) + 1,
      toolPath: path,
    });
  }
  return readLocalFavorites();
}

async function reorderLocalFavorites(paths: string[]): Promise<string[]> {
  const current = await readLocalFavorites();
  const currentSet = new Set(current);
  const requestedSet = new Set(paths);
  const ordered = [
    ...paths.filter((path) => currentSet.has(path)),
    ...current.filter((path) => !requestedSet.has(path)),
  ];

  await db.transaction('rw', db.favorites, async () => {
    await Promise.all(
      ordered.map((path, sortOrder) =>
        db.favorites.where('toolPath').equals(path).modify({ sortOrder }),
      ),
    );
  });
  return ordered;
}

export function loadFavorites(): OptionalAuthOperation<string[]> {
  return {
    local: readLocalFavorites,
    remote: async () => {
      const response = await api.favorites.$get();
      assertSessionActive(response);
      if (!response.ok) throw new Error('favorite request failed');
      return (await response.json()).favorites;
    },
  };
}

export function toggleFavorite(
  paths: string[],
  path: string,
): OptionalAuthOperation<string[]> {
  return {
    local: () => toggleLocalFavorite(path),
    remote: async () => {
      const favorite = !paths.includes(path);
      const response = await api.favorites.$post({ json: { favorite, path } });
      assertSessionActive(response);
      if (!response.ok) throw new Error('favorite request failed');
      return favorite
        ? paths.includes(path)
          ? paths
          : [...paths, path]
        : paths.filter((item) => item !== path);
    },
  };
}

export function reorderFavorites(
  paths: string[],
): OptionalAuthOperation<string[]> {
  return {
    local: () => reorderLocalFavorites(paths),
    remote: async () => {
      const response = await api.favorites.order.$put({ json: { paths } });
      assertSessionActive(response);
      if (!response.ok) throw new Error('favorite reorder failed');
      return paths;
    },
  };
}
