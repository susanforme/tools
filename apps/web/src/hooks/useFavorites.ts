import { api } from '@/lib/api';
import { db } from '@/lib/db';
import { atom, getDefaultStore, useAtom } from 'jotai';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type FavoritesMode = 'error' | 'loading' | 'local' | 'remote';

type FavoritesState = {
  mode: FavoritesMode;
  paths: string[];
};

const favoritesAtom = atom<FavoritesState>({ mode: 'loading', paths: [] });
const favoritesStore = getDefaultStore();
let loading = false;
let loadId = 0;

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

async function reorderLocalFavorites(paths: string[]): Promise<void> {
  await db.transaction('rw', db.favorites, async () => {
    await Promise.all(
      paths.map((path, sortOrder) =>
        db.favorites.where('toolPath').equals(path).modify({ sortOrder }),
      ),
    );
  });
}

export function resetFavorites(): void {
  loadId += 1;
  loading = false;
  favoritesStore.set(favoritesAtom, { mode: 'loading', paths: [] });
}

export function useFavorites() {
  const { t } = useTranslation();
  const [favorites, setFavorites] = useAtom(favoritesAtom);

  useEffect(() => {
    if (favorites.mode !== 'loading' || loading) return;
    loading = true;
    const currentLoadId = ++loadId;

    void api.favorites
      .$get()
      .then(async (response) => {
        if (response.status === 200) {
          const body = await response.json();
          return { mode: 'remote', paths: body.favorites } as const;
        }
        if (response.status === 401) {
          return { mode: 'local', paths: await readLocalFavorites() } as const;
        }
        throw new Error('favorite request failed');
      })
      .then((next) => {
        if (currentLoadId === loadId) setFavorites(next);
      })
      .catch(() => {
        if (currentLoadId === loadId) {
          setFavorites({ mode: 'error', paths: [] });
          toast.error(t('home.favoriteError'));
        }
      })
      .finally(() => {
        if (currentLoadId === loadId) loading = false;
      });
  }, [favorites.mode, setFavorites, t]);

  function isFavorite(path: string): boolean {
    return favorites.paths.includes(path);
  }

  async function toggleFavorite(path: string): Promise<void> {
    const current = favoritesStore.get(favoritesAtom);

    try {
      if (current.mode === 'local') {
        setFavorites({ mode: 'local', paths: await toggleLocalFavorite(path) });
        return;
      }
      if (current.mode !== 'remote') throw new Error('favorites unavailable');

      const favorite = !current.paths.includes(path);
      const response = await api.favorites.$post({
        json: { favorite, path },
      });
      if (response.status === 401) {
        setFavorites({
          mode: 'local',
          paths: await toggleLocalFavorite(path),
        });
        return;
      }
      if (!response.ok) throw new Error('favorite request failed');

      setFavorites((state) => ({
        mode: 'remote',
        paths: favorite
          ? state.paths.includes(path)
            ? state.paths
            : [...state.paths, path]
          : state.paths.filter((item) => item !== path),
      }));
    } catch {
      toast.error(t('home.favoriteError'));
    }
  }

  async function reorderFavorites(paths: string[]): Promise<void> {
    const current = favoritesStore.get(favoritesAtom);

    try {
      if (current.mode === 'local') {
        await reorderLocalFavorites(paths);
        setFavorites({ mode: 'local', paths });
        return;
      }
      if (current.mode !== 'remote') throw new Error('favorites unavailable');

      const response = await api.favorites.order.$put({ json: { paths } });
      if (response.status === 401) {
        setFavorites({ mode: 'local', paths: await readLocalFavorites() });
        return;
      }
      if (!response.ok) throw new Error('favorite reorder failed');
      setFavorites({ mode: 'remote', paths });
    } catch {
      toast.error(t('home.favoriteError'));
    }
  }

  return {
    ready: favorites.mode !== 'loading',
    favoritePaths: favorites.paths,
    isFavorite,
    toggleFavorite,
    reorderFavorites,
  };
}
