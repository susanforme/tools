import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

// ─── useFavorites Hook ────────────────────────────────────────────────────

/**
 * 管理用户收藏的工具列表。
 * 基于 Dexie useLiveQuery 实现实时响应，收藏/取消后首页自动更新。
 *
 * @returns
 *   - favoritePaths: 已收藏的工具路径数组，按 addedAt 降序（最新在前）
 *   - isFavorite: 判断指定路径是否已收藏
 *   - toggleFavorite: 收藏/取消收藏，接受路径字符串
 */
export function useFavorites() {
  // 实时订阅 favorites 表，按 addedAt 降序
  const favoritePaths = useLiveQuery(async () => {
    const rows = await db.favorites.orderBy('addedAt').reverse().toArray();
    return rows.map((r) => r.toolPath);
  }, []);

  function isFavorite(path: string): boolean {
    return (favoritePaths ?? []).includes(path);
  }

  async function toggleFavorite(path: string): Promise<void> {
    const existing = await db.favorites.where('toolPath').equals(path).first();
    if (existing) {
      await db.favorites.delete(existing.id!);
    } else {
      await db.favorites.add({ toolPath: path, addedAt: Date.now() });
    }
  }

  return {
    /** 已收藏的工具路径，按收藏时间降序；undefined 表示 DB 查询尚未完成 */
    favoritePaths: favoritePaths ?? [],
    isFavorite,
    toggleFavorite,
  };
}
