import { db } from '@/lib/db';
import { useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── 辅助 ─────────────────────────────────────────────────────────────────

/** 从路由 pathname 中提取工具名，如 '/json' → 'json' */
function pathnameToTool(pathname: string): string {
  return pathname.replace(/^\//, '').split('/')[0] || 'root';
}

// ─── 核心操作函数（不依赖 React） ──────────────────────────────────────────

/**
 * 读取工具偏好配置，返回解析后的对象；不存在时返回 null
 */
export async function getPreference<T extends Record<string, unknown>>(
  tool: string,
): Promise<T | null> {
  const record = await db.preferences.get(tool);
  if (!record) return null;
  try {
    return JSON.parse(record.data) as T;
  } catch {
    return null;
  }
}

/**
 * 写入工具偏好配置（upsert，覆盖旧值）
 */
export async function setPreference<T extends Record<string, unknown>>(
  tool: string,
  data: T,
): Promise<void> {
  await db.preferences.put({
    tool,
    data: JSON.stringify(data),
    updatedAt: Date.now(),
  });
}

/**
 * 删除工具偏好配置
 */
export async function deletePreference(tool: string): Promise<void> {
  await db.preferences.delete(tool);
}

// ─── React Hook ────────────────────────────────────────────────────────────

/**
 * 在组件中读写工具偏好配置，tool 自动从当前路由获取，无需手动传入。
 *
 * - 首次加载时从 DB 读取，自动合并到 defaultValue
 * - `save(partial)` 只更新传入的字段，其余字段保留
 * - `reset()` 删除 DB 中的配置，恢复为 defaultValue
 * - `ready` 为 true 时表示已完成首次 DB 读取，可安全渲染依赖偏好的 UI
 *
 * @example
 * interface HashPref { algorithms: string[] }
 * const { pref, save, reset, ready } = useToolPreference<HashPref>({
 *   algorithms: ['md5', 'sha256'],
 * });
 */
export function useToolPreference<T extends Record<string, unknown>>(
  defaultValue: T,
) {
  // 从路由状态自动获取工具名
  const tool = useRouterState({
    select: (s) => pathnameToTool(s.location.pathname),
  });

  const [pref, setPref] = useState<T>(defaultValue);
  const [ready, setReady] = useState(false);
  // 用 ref 记录最新 pref，避免 save 闭包捕获旧值
  const prefRef = useRef<T>(pref);
  prefRef.current = pref;

  // 路由切换时重置为 defaultValue，再从 DB 加载新工具的偏好
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setPref(defaultValue);
    void getPreference<T>(tool).then((stored) => {
      if (cancelled) return;
      if (stored) {
        const merged = { ...defaultValue, ...stored };
        setPref(merged);
        prefRef.current = merged;
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // defaultValue 为对象字面量，刻意只依赖 tool 避免无限循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  /** 更新偏好（部分更新，未传字段保留当前值） */
  const save = useCallback(
    async (partial: Partial<T>) => {
      const next = { ...prefRef.current, ...partial };
      setPref(next);
      prefRef.current = next;
      await setPreference(tool, next);
    },
    [tool],
  );

  /** 重置为 defaultValue 并清除 DB 中的记录 */
  const reset = useCallback(async () => {
    setPref(defaultValue);
    prefRef.current = defaultValue;
    await deletePreference(tool);
  }, [tool, defaultValue]);

  return {
    pref: [pref, save] as const,
    reset,
    ready,
  };
}
