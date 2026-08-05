import {
  useOptionalAuthMutation,
  useOptionalAuthQuery,
} from '@/hooks/useOptionalAuth';
import {
  loadFavorites,
  reorderFavorites as reorderFavoritesStorage,
  toggleFavorite as toggleFavoriteStorage,
} from '@/lib/favorites-storage';
import { queryClient } from '@/lib/query-client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const FAVORITES_QUERY_KEY = ['favorites'] as const;

export function resetFavorites(): void {
  void queryClient.resetQueries({ queryKey: FAVORITES_QUERY_KEY });
}

export function useFavorites() {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const reportError = () => toast.error(t('home.favoriteError'));
  const favorites = useOptionalAuthQuery({
    queryKey: FAVORITES_QUERY_KEY,
    operation: loadFavorites(),
    onReportError: reportError,
    staleTime: Infinity,
  });
  const paths = favorites.data?.value ?? [];
  const toggleMutation = useOptionalAuthMutation({
    operation: ({
      currentPaths,
      path,
    }: {
      currentPaths: string[];
      path: string;
    }) => toggleFavoriteStorage(currentPaths, path),
    onReportError: reportError,
  });
  const reorderMutation = useOptionalAuthMutation({
    operation: reorderFavoritesStorage,
    onReportError: reportError,
  });

  function isFavorite(path: string): boolean {
    return paths.includes(path);
  }

  async function toggleFavorite(path: string): Promise<void> {
    const result = await toggleMutation.execute({ currentPaths: paths, path });
    if (result) cache.setQueryData(FAVORITES_QUERY_KEY, result);
  }

  async function reorderFavorites(orderedPaths: string[]): Promise<void> {
    const result = await reorderMutation.execute(orderedPaths);
    if (result) cache.setQueryData(FAVORITES_QUERY_KEY, result);
  }

  return {
    ready: !favorites.isPending,
    favoritePaths: paths,
    isFavorite,
    toggleFavorite,
    reorderFavorites,
  };
}
