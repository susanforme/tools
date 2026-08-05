import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

// ─── useFavorites Hook ────────────────────────────────────────────────────

/**
 * 管理用户收藏的工具列表。
 * 基于 Dexie useLiveQuery 实现实时响应，收藏/取消/拖拽重排后首页自动更新。
 *
 * @returns
 *   - ready: DB 查询已完成，可以安全渲染收藏区域
 *   - favoritePaths: 已收藏的工具路径数组，按 sortOrder 升序（ready 前为 []）
 *   - isFavorite: 判断指定路径是否已收藏
 *   - toggleFavorite: 收藏/取消收藏
 *   - reorderFavorites: 拖拽后批量重写 sortOrder
 */
export function useFavorites() {
  // 实时订阅 favorites 表，按 sortOrder 升序
  // useLiveQuery 在查询完成前返回 undefined
  const rawPaths = useLiveQuery(async () => {
    const rows = await db.favorites.orderBy('sortOrder').toArray();
    return rows.map((r) => r.toolPath);
  }, []);

  // undefined 表示首次查询尚未完成
  const ready = rawPaths !== undefined;
  const favoritePaths = rawPaths ?? [];

  function isFavorite(path: string): boolean {
    return favoritePaths.includes(path);
  }

  async function toggleFavorite(path: string): Promise<void> {
    const existing = await db.favorites.where('toolPath').equals(path).first();
    if (existing) {
      await db.favorites.delete(existing.id!);
    } else {
      // 新收藏插入到列表末尾：找当前最大 sortOrder + 1
      const all = await db.favorites.orderBy('sortOrder').toArray();
      const maxOrder =
        all.length > 0 ? (all[all.length - 1].sortOrder ?? 0) : -1;
      await db.favorites.add({
        toolPath: path,
        addedAt: Date.now(),
        sortOrder: maxOrder + 1,
      });
    }
  }

  /**
   * 拖拽完成后，传入新顺序的路径数组，批量重写 sortOrder（0, 1, 2, ...）。
   * 在事务中执行，保证原子性。
   */
  async function reorderFavorites(orderedPaths: string[]): Promise<void> {
    await db.transaction('rw', db.favorites, async () => {
      await Promise.all(
        orderedPaths.map((path, idx) =>
          db.favorites
            .where('toolPath')
            .equals(path)
            .modify({ sortOrder: idx }),
        ),
      );
    });
  }

  return {
    /** DB 查询已完成，可安全渲染收藏区域 */
    ready,
    /** 已收藏的工具路径，按 sortOrder 升序 */
    favoritePaths,
    isFavorite,
    toggleFavorite,
    reorderFavorites,
  };
}
